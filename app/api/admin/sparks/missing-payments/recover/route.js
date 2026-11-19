import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const PACKAGES = new Map([[100, 10000], [200, 20000], [300, 30000], [500, 50000], [1000, 100000]]);

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const testMode = process.env.PAYSTACK_TEST_MODE === 'true';
  const correctKeyMode = testMode ? secret?.startsWith('sk_test_') : secret?.startsWith('sk_live_');
  if (!url || !anon || !service || !secret) return fail('Sparks recovery is not configured.', 503);
  if (process.env.SPARKS_ADMIN_ONLY !== 'true' || !correctKeyMode) return fail('Restricted Sparks mode is required.', 503);

  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return fail('Sign in is required.', 401);
  const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: 'Bearer ' + token } } });
  const { data: auth, error: authError } = await userClient.auth.getUser(token);
  if (authError || !auth?.user?.id) return fail('Your session has expired.', 401);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from('profiles').select('role,status').eq('id', auth.user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') return fail('Active administrator access required.', 403);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid request body.'); }
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (!/^PLXSPK_[a-f0-9]{32}$/i.test(reference)) return fail('Invalid Sparks payment reference.');

  let response;
  try {
    response = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
      headers: { Authorization: 'Bearer ' + secret }, cache: 'no-store',
    });
  } catch {
    return fail('Could not reach Paystack to verify this payment.', 502);
  }
  const payload = await response.json().catch(() => null);
  const tx = payload?.data;
  if (!response.ok || !payload?.status || !tx) return fail('Paystack could not verify this transaction.', 502);
  if (tx.reference !== reference) return fail('Paystack returned a different payment reference.', 409);
  if (tx.status !== 'success') return fail('This Paystack payment is not successful.', 409);

  const metadata = tx.metadata || {};
  const sparks = Number(metadata.sparks_amount);
  const expectedAmount = PACKAGES.get(sparks);
  if (metadata.purpose !== 'palixia_sparks_purchase' ||
      typeof metadata.reader_id !== 'string' || !metadata.reader_id ||
      typeof metadata.test_mode !== 'boolean' || metadata.test_mode !== testMode ||
      tx.currency !== 'NGN' || !expectedAmount || tx.amount !== expectedAmount ||
      (!testMode && sparks !== 100)) {
    return fail('Verified transaction metadata or package does not match the permitted Sparks purchase.', 409);
  }

  // Only the trusted server client can execute the recovery RPC. The RPC
  // also checks the authenticated admin ID against the active admin profile.
  const { data: recovered, error: recoveryError } = await admin.rpc('admin_recover_verified_spark_purchase', {
    p_reference: reference,
    p_reader_id: metadata.reader_id,
    p_amount_kobo: expectedAmount,
    p_sparks_amount: sparks,
    p_admin_id: auth.user.id,
  });
  if (recoveryError || !recovered?.success) {
    console.error('[Sparks admin recovery] RPC failed', { reference, code: recoveryError?.code || null, message: recoveryError?.message || null });
    return fail('Paystack verified the payment, but recovery failed. Please investigate before retrying.', 500);
  }
  return NextResponse.json({ ...recovered, paid_at: tx.paid_at || tx.created_at || null });
}
