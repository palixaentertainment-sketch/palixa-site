import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 100;

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const testMode = process.env.PAYSTACK_TEST_MODE === 'true';
  const secretMatchesMode = testMode
    ? paystackSecret?.startsWith('sk_test_')
    : paystackSecret?.startsWith('sk_live_');

  if (!supabaseUrl || !anonKey || !serviceKey || !paystackSecret) {
    return fail('Financial reconciliation is not configured.', 503);
  }
  if (process.env.SPARKS_ADMIN_ONLY !== 'true' || !secretMatchesMode) {
    return fail('Sparks is not configured for the restricted reconciliation mode.', 503);
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return fail('Sign in is required.', 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !userData?.user?.id) return fail('Your session has expired.', 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from('profiles').select('role,status').eq('id', userData.user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') {
    return fail('Active administrator access required.', 403);
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get('days') || 7);
  if (![1, 7, 30].includes(days)) return fail('Choose a supported date range (1, 7, or 30 days).');
  const since = new Date(Date.now() - days * DAY_MS).toISOString();

  const { data: purchases, error: purchaseError } = await admin
    .from('spark_purchases')
    .select('id,reader_id,paystack_reference,amount_kobo,sparks_amount,currency,status,created_at,paid_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);
  if (purchaseError) {
    console.error('[Sparks reconciliation] purchase list failed', purchaseError.message);
    return fail('Palixia purchase records could not be loaded.', 500);
  }

  const rows = Array.isArray(purchases) ? purchases : [];
  const refs = rows.map(row => row.paystack_reference).filter(Boolean);
  const purchaseIds = rows.map(row => row.id);
  let ledgerEntries = [];
  if (purchaseIds.length) {
    const { data, error } = await admin.from('reader_spark_ledger')
      .select('purchase_id,entry_type,reference,sparks_amount')
      .in('purchase_id', purchaseIds);
    if (error) {
      console.error('[Sparks reconciliation] ledger lookup failed', error.message);
      return fail('Wallet ledger records could not be loaded.', 500);
    }
    ledgerEntries = data || [];
  }

  const ledgerByPurchase = new Map();
  for (const entry of ledgerEntries) {
    const current = ledgerByPurchase.get(entry.purchase_id) || [];
    current.push(entry);
    ledgerByPurchase.set(entry.purchase_id, current);
  }

  const verifiedResults = [];
  // Limit concurrency to avoid flooding Paystack with verification calls.
  for (let i = 0; i < refs.length; i += 5) {
    const batch = refs.slice(i, i + 5);
    const verifiedBatch = await Promise.all(batch.map(async reference => {
      try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${paystackSecret}` },
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => null);
        return { reference, ok: response.ok && payload?.status, transaction: payload?.data || null };
      } catch {
        return { reference, ok: false, transaction: null, verifyError: true };
      }
    }));
    verifiedResults.push(...verifiedBatch);
  }
  const verifiedByReference = new Map(verifiedResults.map(result => [result.reference, result]));

  const packages = new Map([[100, 10000], [200, 20000], [300, 30000], [500, 50000], [1000, 100000]]);
  const reconciliationRows = rows.map(purchase => {
    const verified = verifiedByReference.get(purchase.paystack_reference);
    const tx = verified?.transaction;
    const ledger = ledgerByPurchase.get(purchase.id) || [];
    const purchaseCredits = ledger.filter(entry => entry.entry_type === 'purchase_credit');
    const refunds = ledger.filter(entry => entry.entry_type === 'refund_debit');
    let status;
    if (!verified?.ok || !tx) status = verified?.verifyError ? 'verification_error' : 'not_found';
    else if (tx.reference !== purchase.paystack_reference) status = 'reference_mismatch';
    else if (tx.status === 'success' && (Number(tx.amount) !== Number(purchase.amount_kobo) || tx.currency !== purchase.currency || Number(tx.metadata?.sparks_amount) !== Number(purchase.sparks_amount) || tx.metadata?.reader_id !== purchase.reader_id || tx.metadata?.purpose !== 'palixia_sparks_purchase' || packages.get(Number(purchase.sparks_amount)) !== Number(purchase.amount_kobo))) status = 'amount_mismatch';
    else if (tx.status === 'success' && purchase.status === 'refunded') status = 'refunded';
    else if (tx.status === 'success' && (purchase.status !== 'paid' || purchaseCredits.length === 0)) status = 'uncredited';
    else if (tx.status === 'success' && purchase.status === 'paid' && purchaseCredits.length === 1 && Number(purchaseCredits[0].sparks_amount) === Number(purchase.sparks_amount)) status = 'matched';
    else if (tx.status === 'pending' || tx.status === 'ongoing') status = 'pending';
    else if (tx.status === 'failed' || tx.status === 'abandoned') status = 'failed';
    else status = 'review';

    return {
      purchaseId: purchase.id,
      readerId: purchase.reader_id,
      reference: purchase.paystack_reference,
      amountKobo: Number(purchase.amount_kobo),
      sparks: Number(purchase.sparks_amount),
      currency: purchase.currency,
      purchaseStatus: purchase.status,
      paystackStatus: tx?.status || (verified?.verifyError ? 'verification_error' : 'not_found'),
      ledgerCredits: purchaseCredits.length,
      ledgerCreditSparks: purchaseCredits.reduce((sum, entry) => sum + Number(entry.sparks_amount || 0), 0),
      refundDebits: refunds.length,
      reconciliationStatus: status,
      createdAt: purchase.created_at,
      paidAt: purchase.paid_at,
    };
  });

  const counts = reconciliationRows.reduce((result, row) => {
    result[row.reconciliationStatus] = (result[row.reconciliationStatus] || 0) + 1;
    return result;
  }, {});

  return NextResponse.json({
    rangeDays: days,
    since,
    generatedAt: new Date().toISOString(),
    truncated: rows.length === MAX_ROWS,
    total: reconciliationRows.length,
    counts,
    rows: reconciliationRows,
  });
}
