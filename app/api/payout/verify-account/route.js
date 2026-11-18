import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, randomBytes } from 'node:crypto';

export const runtime = 'nodejs';

function fail(message, status = 400) { return NextResponse.json({ error: message }, { status }); }

function encryptionKey() {
  const raw = process.env.PAYOUT_DETAILS_ENCRYPTION_KEY || '';
  let key;
  try { key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64'); } catch {}
  return key?.length === 32 ? key : null;
}

async function resolvePaystackAccount(secret, accountNumber, bankCode) {
  const url = new URL('https://api.paystack.co/bank/resolve');
  url.searchParams.set('account_number', accountNumber);
  url.searchParams.set('bank_code', bankCode);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok || !payload?.status || !payload?.data?.account_name) return null;
  return String(payload.data.account_name).trim().slice(0, 160);
}

async function resolveBankName(secret, bankCode) {
  if (bankCode === '001' && process.env.PAYSTACK_TEST_MODE === 'true') return 'Paystack Test Bank (Sandbox)';
  const response = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=100', {
    headers: { Authorization: `Bearer ${secret}` },
    cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok || !payload?.status || !Array.isArray(payload.data)) return null;
  const bank = payload.data.find((item) => String(item?.code) === bankCode && item?.active !== false);
  return bank?.name ? String(bank.name).slice(0, 100) : null;
}

export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!supabaseUrl || !anonKey || !secret) return fail('Payout account setup is not configured on the server.', 503);

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return fail('Please sign in again.', 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser(token);
  if (authError || !auth?.user?.id) return fail('Your session has expired. Please sign in again.', 401);
  const { data: profile } = await userClient.from('profiles').select('role,status').eq('id', auth.user.id).maybeSingle();
  if (!profile || !['author', 'admin'].includes(profile.role) || profile.status !== 'active') return fail('Active author access is required.', 403);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid request.'); }
  const accountNumber = String(body.accountNumber || '').replace(/\s+/g, '');
  const bankCode = String(body.bankCode || '').trim();
  if (!/^\d{10}$/.test(accountNumber) || !/^\d{2,10}$/.test(bankCode)) {
    return fail('Enter a valid 10-digit account number and select a bank.');
  }

  try {
    const accountName = await resolvePaystackAccount(secret, accountNumber, bankCode);
    if (!accountName) {
      return fail('We could not verify this account right now. Please check the details or try again later.', 422);
    }

    // First request only resolves and displays the name. Saving requires a
    // separate request after the author explicitly confirms account ownership.
    if (body.action !== 'save') {
      return NextResponse.json({ verified: true, accountName, bankCode });
    }
    if (body.confirmAccountOwnership !== true) {
      return fail('Please confirm that this bank account belongs to you.');
    }

    const key = encryptionKey();
    if (!key) return fail('Secure payout account storage is not configured.', 503);
    const bankName = await resolveBankName(secret, bankCode);
    if (!bankName) return fail('We could not confirm the selected bank. Please select it again.', 422);

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(accountNumber, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const { error: saveError } = await userClient.rpc('save_author_payout_account', {
      p_bank_code: bankCode,
      p_bank_name: bankName,
      p_account_name: accountName,
      p_account_number_ciphertext: ciphertext.toString('base64'),
      p_account_number_iv: iv.toString('base64'),
      p_account_number_tag: tag.toString('base64'),
      p_account_last4: accountNumber.slice(-4),
    });
    if (saveError) {
      console.error('[Payout account] Secure save RPC failed', { code: saveError.code, message: saveError.message });
      return fail('The account was verified, but we could not save it. Please try again.', 500);
    }
    return NextResponse.json({
      verified: true,
      saved: true,
      accountName,
      bankName,
      accountLast4: accountNumber.slice(-4),
    });
  } catch (error) {
    console.error('[Payout account] Verification/save request failed', { message: error?.message || 'Unknown error' });
    return fail('Account verification is temporarily unavailable.', 502);
  }
}
