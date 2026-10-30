import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';

export async function POST(request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (process.env.PAYSTACK_TEST_MODE !== 'true' || !secret || !secret.startsWith('sk_test_')) {
    return NextResponse.json({ error: 'Paystack test mode is not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('x-paystack-signature') || '';
  const rawBody = await request.text();
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');

  const suppliedBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }

  // Deliberately acknowledge only. Persistent transaction processing and ledger
  // posting will be added after the database schema and Paystack model are approved.
  return NextResponse.json({
    received: true,
    event: typeof event.event === 'string' ? event.event : 'unknown',
    processed: false,
    message: 'Signature verified. No wallet or earnings records were changed.',
  });
}
