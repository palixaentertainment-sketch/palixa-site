import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  // This endpoint is deliberately test-only. It cannot initialise live charges.
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (process.env.PAYSTACK_TEST_MODE !== 'true' || !secret || !secret.startsWith('sk_test_')) {
    return jsonError('Paystack test mode is not configured.', 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid request body.');
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const amountNaira = Number(body.amountNaira);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Enter a valid email address.');
  if (!Number.isInteger(amountNaira) || amountNaira < 100 || amountNaira > 10000) {
    return jsonError('Test amount must be a whole naira amount between ₦100 and ₦10,000.');
  }

  const origin = new URL(request.url).origin;
  const callbackUrl = `${origin}/payments/test/callback`;

  let response;
  try {
    response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: String(amountNaira * 100),
        currency: 'NGN',
        callback_url: callbackUrl,
        metadata: {
          purpose: 'palixia_test_checkout',
          test_mode: true,
          custom_fields: [{ display_name: 'Payment purpose', variable_name: 'purpose', value: 'Palixia test checkout — no author earnings' }],
        },
      }),
      cache: 'no-store',
    });
  } catch {
    return jsonError('Could not reach Paystack. Please try again.', 502);
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status || !result?.data?.authorization_url || !result?.data?.reference) {
    return jsonError(result?.message || 'Paystack could not initialise this test payment.', 502);
  }

  return NextResponse.json({
    authorizationUrl: result.data.authorization_url,
    reference: result.data.reference,
  });
}
