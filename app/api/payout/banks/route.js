import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: 'Bank services are not configured.' }, { status: 503 });
  try {
    const response = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=100', {
      headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok || !payload?.status || !Array.isArray(payload.data)) {
      return NextResponse.json({ error: 'Could not load supported banks.' }, { status: 502 });
    }
    const banks = payload.data
      .filter((bank) => bank?.name && bank?.code && bank?.active !== false)
      .map(({ name, code }) => ({ name, code }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ banks }, { headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch {
    return NextResponse.json({ error: 'Bank service is temporarily unavailable.' }, { status: 502 });
  }
}
