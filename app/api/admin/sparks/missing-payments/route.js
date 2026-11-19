import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const MAX_PAGES = 3;
const PER_PAGE = 50;
const PACKAGE_MAP = new Map([[100, 10000], [200, 20000], [300, 30000], [500, 50000], [1000, 100000]]);

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const testMode = process.env.PAYSTACK_TEST_MODE === 'true';
  const correctKeyMode = testMode ? secret?.startsWith('sk_test_') : secret?.startsWith('sk_live_');
  if (!url || !anon || !service || !secret) return fail('Payment discovery is not configured.', 503);
  if (process.env.SPARKS_ADMIN_ONLY !== 'true' || !correctKeyMode) return fail('Restricted Sparks mode is required.', 503);

  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return fail('Sign in is required.', 401);
  const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: 'Bearer ' + token } } });
  const { data: auth, error: authError } = await userClient.auth.getUser(token);
  if (authError || !auth?.user?.id) return fail('Your session has expired.', 401);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from('profiles').select('role,status').eq('id', auth.user.id).maybeSingle();
  if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') return fail('Active administrator access required.', 403);

  const days = Number(new URL(request.url).searchParams.get('days') || 7);
  if (![1, 7, 30].includes(days)) return fail('Choose 1, 7, or 30 days.');
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400000).toISOString();
  const to = now.toISOString();

  // Bounded read-only scan: at most 150 Paystack list results. Never writes to Supabase.
  const transactions = [];
  let pageCount = 1;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const query = new URLSearchParams({ perPage: String(PER_PAGE), page: String(page), from, to, status: 'success' });
    let response;
    try {
      response = await fetch('https://api.paystack.co/transaction?' + query.toString(), { headers: { Authorization: 'Bearer ' + secret }, cache: 'no-store' });
    } catch {
      return fail('Could not reach Paystack transaction listing.', 502);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.status || !Array.isArray(payload.data)) return fail('Paystack transaction listing failed.', 502);
    transactions.push(...payload.data);
    pageCount = Number(payload.meta?.pageCount || page);
    if (page >= pageCount || page >= MAX_PAGES) break;
  }

  const candidates = transactions.filter(tx =>
    tx?.status === 'success' &&
    tx?.currency === 'NGN' &&
    tx?.metadata?.purpose === 'palixia_sparks_purchase' &&
    /^PLXSPK_[a-f0-9]{32}$/i.test(String(tx.reference || ''))
  );
  const candidateRefs = [...new Set(candidates.map(tx => tx.reference))];
  const existingRefs = new Set();
  if (candidateRefs.length) {
    const { data, error } = await admin.from('spark_purchases').select('paystack_reference').in('paystack_reference', candidateRefs);
    if (error) return fail('Palixia purchase records could not be checked.', 500);
    for (const row of data || []) existingRefs.add(row.paystack_reference);
  }

  const missing = candidates.filter(tx => !existingRefs.has(tx.reference));
  const verified = [];
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5);
    const results = await Promise.all(batch.map(async tx => {
      try {
        const res = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(tx.reference), { headers: { Authorization: 'Bearer ' + secret }, cache: 'no-store' });
        const payload = await res.json().catch(() => null);
        const v = payload?.data;
        const sparks = Number(v?.metadata?.sparks_amount);
        const valid = res.ok && payload?.status && v?.status === 'success' && v?.reference === tx.reference &&
          v?.currency === 'NGN' && v?.metadata?.purpose === 'palixia_sparks_purchase' && v?.metadata?.test_mode === testMode &&
          typeof v?.metadata?.reader_id === 'string' && v.metadata.reader_id.length > 0 &&
          PACKAGE_MAP.get(sparks) === Number(v.amount) &&
          (testMode || sparks === 100);
        if (!valid) return null;
        return { reference: v.reference, amountKobo: Number(v.amount), sparks, paidAt: v.paid_at || v.created_at || null };
      } catch { return null; }
    }));
    verified.push(...results.filter(Boolean));
  }

  return NextResponse.json({
    rangeDays: days, from, to, generatedAt: new Date().toISOString(),
    transactionsScanned: transactions.length, maxScanned: MAX_PAGES * PER_PAGE,
    truncated: pageCount > MAX_PAGES, candidates: verified.length, rows: verified,
  });
}
