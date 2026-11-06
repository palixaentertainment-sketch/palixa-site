import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Payout account details are unavailable.' }, { status: 503 });
  }

  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await userClient.auth.getUser(token);
  if (authError || !auth?.user?.id) {
    return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
  }

  const { data, error } = await userClient.rpc('get_my_author_payout_account', {}, {
    headers: { Authorization: 'Bearer ' + token },
  });

  if (error) {
    console.error('[Payout account] Saved account lookup failed', { code: error.code, message: error.message });
    return NextResponse.json({ error: 'Saved bank details could not be loaded.' }, { status: 500 });
  }

  const account = Array.isArray(data) && data.length ? data[0] : null;
  return NextResponse.json({ account: account ? {
    bankName: account.bank_name,
    accountName: account.account_name,
    accountLast4: account.account_last4,
    verifiedAt: account.verified_at,
  } : null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
