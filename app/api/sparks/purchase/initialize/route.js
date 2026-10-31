import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

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

  if (!supabaseUrl || !anonKey || !serviceKey || !paystackSecret) {
    return fail('Sparks payments are not configured on the server.', 503);
  }
  // Fail closed: this release is an admin-only test, never a public/live checkout.
  if (process.env.SPARKS_ADMIN_ONLY !== 'true' || process.env.PAYSTACK_TEST_MODE !== 'true' || !paystackSecret.startsWith('sk_test_')) {
    return fail('Sparks testing is not enabled. Admin-only Paystack test mode is required.', 503);
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!accessToken) return fail('Please sign in before buying Sparks.', 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !userData?.user?.id || !userData.user.email) return fail('Your session has expired. Please sign in again.', 401);

  const gateClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await gateClient.from('profiles').select('role,status').eq('id', userData.user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') return fail('Sparks is currently available to Palixia admins only.', 403);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid request body.'); }
  const amountNaira = Number(body.amountNaira);
  const pack = PACKAGES.get(amountNaira);
  if (!Number.isInteger(amountNaira) || !pack) return fail('Choose one of the available Sparks packages.');

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const reference = `PLXSPK_${randomUUID().replace(/-/g, '')}`;

  const { error: insertError } = await admin.from('spark_purchases').insert({
    reader_id: userData.user.id,
    paystack_reference: reference,
    amount_kobo: pack.amountKobo,
    sparks_amount: pack.sparks,
    currency: 'NGN',
    status: 'pending',
  });
  if (insertError) return fail('Could not create your Sparks purchase. Please try again.', 500);

  let paystackResponse;
  try {
    paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${paystackSecret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userData.user.email,
        amount: String(pack.amountKobo),
        currency: 'NGN',
        reference,
        callback_url: `${new URL(request.url).origin}/sparks/callback`,
        metadata: {
          purpose: 'palixia_sparks_purchase',
          reader_id: userData.user.id,
          sparks_amount: pack.sparks,
          test_mode: paystackSecret.startsWith('sk_test_'),
        },
      }),
      cache: 'no-store',
    });
  } catch {
    await admin.from('spark_purchases').update({ status: 'failed' }).eq('paystack_reference', reference).eq('status', 'pending');
    return fail('Paystack could not be reached. Please try again.', 502);
  }

  const result = await paystackResponse.json().catch(() => null);
  if (!paystackResponse.ok || !result?.status || !result?.data?.authorization_url) {
    await admin.from('spark_purchases').update({ status: 'failed' }).eq('paystack_reference', reference).eq('status', 'pending');
    return fail(result?.message || 'Paystack could not start your payment.', 502);
  }

  return NextResponse.json({ authorizationUrl: result.data.authorization_url, reference });
}
