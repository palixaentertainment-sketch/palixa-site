import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (process.env.PAYSTACK_TEST_MODE !== 'true' || !secret || !secret.startsWith('sk_test_')) {
    return NextResponse.json({ error: 'Paystack test mode is not configured.' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (!/^[A-Za-z0-9._-]{8,100}$/.test(reference)) {
    return NextResponse.json({ error: 'Invalid transaction reference.' }, { status: 400 });
  }

  let response;
  try {
    response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach Paystack. Please try again.' }, { status: 502 });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status || !result?.data) {
    return NextResponse.json({ error: result?.message || 'Could not verify this transaction.' }, { status: 502 });
  }

  const transaction = result.data;
  // Do not create wallet credits here. This is a test-only confirmation screen.
  return NextResponse.json({
    reference: transaction.reference,
    status: transaction.status,
    amountNaira: Number.isInteger(transaction.amount) ? transaction.amount / 100 : null,
    currency: transaction.currency,
    paidAt: transaction.paid_at || null,
    isTest: transaction.metadata?.test_mode === true && transaction.metadata?.purpose === 'palixia_test_checkout',
    message: transaction.status === 'success'
      ? 'Paystack confirmed this test payment. No author earnings were created.'
      : `Paystack reports this transaction as ${transaction.status || 'unconfirmed'}.`,
  });
}
