import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request) {
  const testMode = process.env.PAYSTACK_TEST_MODE === 'true';
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
  const secretMatchesMode = testMode
    ? paystackSecret.startsWith('sk_test_')
    : paystackSecret.startsWith('sk_live_');

  // The wallet test controls are available only while the explicit admin-only
  // gate is enabled and the configured key matches the selected Paystack mode.
  if (process.env.SPARKS_ADMIN_ONLY !== 'true' || !secretMatchesMode) {
    return NextResponse.json({ enabled: false }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!url || !anon || !service || !token) {
    return NextResponse.json({ enabled: false }, { status: 401 });
  }

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user?.id) {
    return NextResponse.json({ enabled: false }, { status: 401 });
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role,status')
    .eq('id', data.user.id)
    .maybeSingle();

  const enabled = !profileError && profile?.role === 'admin' && profile?.status === 'active';
  return NextResponse.json({
    enabled,
    testing: enabled,
    mode: enabled ? (testMode ? 'test' : 'live') : null,
  });
}
