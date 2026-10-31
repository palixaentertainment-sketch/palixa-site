import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey || !paystackSecret) return fail('Sparks payments are not configured.', 503);
  // Fail closed: this release is an admin-only test, never a public/live checkout.
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

  const gateClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await gateClient.from('profiles').select('role,status').eq('id', userData.user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') return fail('Sparks is currently available to Palixia admins only.', 403);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid request body.'); }
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (!/^PLXSPK_[a-f0-9]{32}$/i.test(reference)) return fail('Invalid Sparks payment reference.');

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: purchase, error: purchaseError } = await admin
    .from('spark_purchases')
    .select('id,reader_id,amount_kobo,sparks_amount,currency,status')
    .eq('paystack_reference', reference)
    .maybeSingle();

  if (purchaseError || !purchase) return fail('We could not find this Sparks purchase.', 404);
  if (purchase.reader_id !== userData.user.id) return fail('This purchase does not belong to your account.', 403);

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

  if (transaction.status !== 'success') {
    return NextResponse.json({ status: transaction.status || 'pending', credited: false });
  }
  const configuredTestMode = process.env.PAYSTACK_TEST_MODE === 'true';
  const secretIsTest = paystackSecret.startsWith('sk_test_');
  if (configuredTestMode !== secretIsTest ||
      Boolean(transaction.metadata?.test_mode) !== secretIsTest ||
      transaction.reference !== reference ||
      transaction.amount !== Number(purchase.amount_kobo) ||
      transaction.currency !== purchase.currency ||
      transaction.metadata?.purpose !== 'palixia_sparks_purchase' ||
      transaction.metadata?.reader_id !== userData.user.id ||
      Number(transaction.metadata?.sparks_amount) !== purchase.sparks_amount) {
    return fail('Payment details did not match this Sparks purchase. Please contact support.', 409);
  }

  const { data: posted, error: postError } = await admin.rpc('post_verified_spark_purchase', {
    p_reference: reference,
    p_amount_kobo: transaction.amount,
    p_currency: transaction.currency,
  });
  if (postError) return fail('Payment was verified, but Sparks could not be credited automatically. Please contact support with your reference.', 500);

  return NextResponse.json({
    status: 'success',
    credited: Boolean(posted),
    sparks: purchase.sparks_amount,
    message: posted ? 'Your Sparks have been added.' : 'This purchase was already credited.',
  });
}
