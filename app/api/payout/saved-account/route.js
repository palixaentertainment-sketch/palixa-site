import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Payout account details are unavailable.' }, { status: 503 });
  }

  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

  const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await userClient.auth.getUser(token);
  if (authError || !auth?.user?.id) return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });

  const { data: profile } = await userClient.from('profiles').select('role,status').eq('id', auth.user.id).maybeSingle();
  if (!profile || !['author', 'admin'].includes(profile.role) || profile.status !== 'active') {
    return NextResponse.json({ error: 'Active author access is required.' }, { status: 403 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.from('author_payout_accounts')
    .select('bank_name,account_name,account_last4,verified_at')
    .eq('author_id', auth.user.id).maybeSingle();

  if (error) {
    console.error('[Payout account] Saved account lookup failed', { code: error.code });
    return NextResponse.json({ error: 'Saved bank details could not be loaded.' }, { status: 500 });
  }

  return NextResponse.json({ account: data ? {
    bankName: data.bank_name,
    accountName: data.account_name,
    accountLast4: data.account_last4,
    verifiedAt: data.verified_at,
  } : null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
