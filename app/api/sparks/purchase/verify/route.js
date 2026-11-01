import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const PACKAGES = new Map([
  [100, { amountKobo: 10000, sparks: 100 }],
  [200, { amountKobo: 20000, sparks: 200 }],
  [300, { amountKobo: 30000, sparks: 300 }],
  [500, { amountKobo: 50000, sparks: 500 }],
  [1000, { amountKobo: 100000, sparks: 1000 }],
]);

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey || !paystackSecret) return fail('Sparks payments are not configured.', 503);
  if (process.env.SPARKS_ADMIN_ONLY !== 'true' || process.env.PAYSTACK_TEST_MODE !== 'true' || !paystackSecret.startsWith('sk_test_')) {
    return fail('Sparks testing is not enabled. Admin-only Paystack test mode is required.', 503);
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!accessToken) return fail('Please sign in to verify this purchase.', 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !userData?.user?.id) return fail('Your session has expired. Please sign in again.', 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from('profiles').select('role,status').eq('id', userData.user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') return fail('Sparks is currently available to Palixia admins only.', 403);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid request body.'); }
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (!/^PLXSPK_[a-f0-9]{32}$/i.test(reference)) return fail('Invalid Sparks payment reference.');

  // Verify with Paystack before looking up a local row. This also lets us safely
  // reconstruct a missing pending row from Paystack's independently verified metadata.
  let verifyResponse;
  try {
    verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
      cache: 'no-store',
    });
  } catch {
    return fail('Could not reach Paystack to verify your payment.', 502);
  }
  const verified = await verifyResponse.json().catch(() => null);
  const transaction = verified?.data;
  if (!verifyResponse.ok || !verified?.status || !transaction) return fail('Paystack could not verify this payment.', 502);
  if (transaction.status !== 'success') return NextResponse.json({ status: transaction.status || 'pending', credited: false });

  const sparksAmount = Number(transaction.metadata?.sparks_amount);
  const pack = PACKAGES.get(sparksAmount);
  const testMode = paystackSecret.startsWith('sk_test_');
  if (transaction.reference !== reference ||
      transaction.currency !== 'NGN' ||
      !pack ||
      transaction.amount !== pack.amountKobo ||
      transaction.metadata?.purpose !== 'palixia_sparks_purchase' ||
      transaction.metadata?.reader_id !== userData.user.id ||
      Boolean(transaction.metadata?.test_mode) !== testMode) {
    return fail('Payment details did not match this Sparks purchase. Please contact support with your reference.', 409);
  }

  let { data: purchase, error: purchaseError } = await admin
    .from('spark_purchases')
    .select('id,reader_id,amount_kobo,sparks_amount,currency,status')
    .eq('paystack_reference', reference)
    .maybeSingle();

  if (purchaseError) return fail('Could not read the Sparks purchase record. Please contact support.', 500);

  // Recover an orphaned successful transaction only from Paystack-verified
  // reference, amount, currency, purpose, package, test-mode and signed-in buyer.
  if (!purchase) {
    const { error: recoveryError } = await admin.from('spark_purchases').upsert({
      reader_id: userData.user.id,
      paystack_reference: reference,
      amount_kobo: pack.amountKobo,
      sparks_amount: pack.sparks,
      currency: 'NGN',
      status: 'pending',
    }, { onConflict: 'paystack_reference', ignoreDuplicates: true });
    if (recoveryError) {
      console.error('[Sparks recovery] Could not restore verified purchase row', {
        code: recoveryError.code, message: recoveryError.message, reference,
      });
      return fail('Paystack confirmed the payment, but Palixia could not restore its purchase record. Please contact support with your reference.', 500);
    }
    const recovered = await admin.from('spark_purchases')
      .select('id,reader_id,amount_kobo,sparks_amount,currency,status')
      .eq('paystack_reference', reference)
      .maybeSingle();
    purchase = recovered.data;
    purchaseError = recovered.error;
  }

  if (purchaseError || !purchase) return fail('Paystack confirmed the payment, but its Sparks purchase record is still unavailable. Please contact support.', 500);
  if (purchase.reader_id !== userData.user.id) return fail('This purchase does not belong to your account.', 403);
  if (purchase.amount_kobo !== pack.amountKobo || purchase.sparks_amount !== pack.sparks || purchase.currency !== 'NGN') {
    return fail('Payment details did not match the saved Sparks purchase. Please contact support.', 409);
  }

  const { data: posted, error: postError } = await admin.rpc('post_verified_spark_purchase', {
    p_reference: reference,
    p_amount_kobo: transaction.amount,
    p_currency: transaction.currency,
  });
  if (postError) {
    console.error('[Sparks recovery] Verified payment could not be credited', {
      code: postError.code, message: postError.message, reference,
    });
    return fail('Payment was verified, but Sparks could not be credited automatically. Please contact support with your reference.', 500);
  }

  return NextResponse.json({
    status: 'success',
    credited: Boolean(posted),
    sparks: purchase.sparks_amount,
    message: posted ? 'Your Sparks have been added.' : 'This purchase was already credited.',
  });
}
