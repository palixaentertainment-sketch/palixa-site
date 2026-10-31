import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function response(status = 200) {
  return new NextResponse(null, { status });
}

export async function POST(request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !serviceKey) return response(503);

  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature') || '';
  const expected = createHmac('sha512', secret).update(rawBody).digest();
  let supplied;
  try {
    if (!/^[a-f0-9]{128}$/i.test(signature)) return response(401);
    supplied = Buffer.from(signature, 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return response(401);
  } catch {
    return response(401);
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return response(400); }
  if (event?.event !== 'charge.success') return response(200);

  const reference = event?.data?.reference;
  if (typeof reference !== 'string' || !/^PLXSPK_[a-f0-9]{32}$/i.test(reference)) return response(200);

  // Do not trust webhook payload amounts/status alone: independently verify with Paystack.
  const testMode = process.env.PAYSTACK_TEST_MODE === 'true';
  const secretIsTest = secret.startsWith('sk_test_');
  if (testMode !== secretIsTest) return response(503);

  let verifiedResponse;
  try {
    verifiedResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    });
  } catch {
    return response(502);
  }
  const verified = await verifiedResponse.json().catch(() => null);
  const transaction = verified?.data;
  if (!verifiedResponse.ok || !verified?.status || transaction?.status !== 'success') return response(502);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: purchase, error: purchaseError } = await admin
    .from('spark_purchases')
    .select('reader_id,amount_kobo,sparks_amount,currency,status')
    .eq('paystack_reference', reference)
    .maybeSingle();
  if (purchaseError) return response(500);
  if (!purchase) return response(200);

  if (transaction.reference !== reference ||
      transaction.amount !== Number(purchase.amount_kobo) ||
      transaction.currency !== purchase.currency ||
      transaction.metadata?.purpose !== 'palixia_sparks_purchase' ||
      transaction.metadata?.reader_id !== purchase.reader_id ||
      Number(transaction.metadata?.sparks_amount) !== purchase.sparks_amount ||
      Boolean(transaction.metadata?.test_mode) !== secretIsTest) {
    return response(400);
  }

  const { error } = await admin.rpc('post_verified_spark_purchase', {
    p_reference: reference,
    p_amount_kobo: transaction.amount,
    p_currency: transaction.currency,
  });
  return error ? response(500) : response(200);
}
