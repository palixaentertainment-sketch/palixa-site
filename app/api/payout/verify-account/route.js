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

export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const key = encryptionKey();
  if (!supabaseUrl || !anonKey || !serviceKey || !secret || !key) {
    return fail('Payout account setup is not configured on the server.', 503);
  }

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
  if (!profile || !['author','admin'].includes(profile.role) || profile.status !== 'active') return fail('Active author access is required.', 403);

  let body;
  try { body = await request.json(); } catch { return fail('Invalid request.'); }
  const accountNumber = String(body.accountNumber || '').replace(/\s+/g, '');
  const bankCode = String(body.bankCode || '').trim();
  const bankName = String(body.bankName || '').trim().slice(0, 100);
  if (!/^\d{10}$/.test(accountNumber) || !/^\d{2,10}$/.test(bankCode) || !bankName) {
    return fail('Enter a valid 10-digit account number and select a bank.');
  }

  try {
    const verifyUrl = new URL('https://api.paystack.co/bank/resolve');
    verifyUrl.searchParams.set('account_number', accountNumber);
    verifyUrl.searchParams.set('bank_code', bankCode);
    const response = await fetch(verifyUrl, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || !result?.status || !result?.data?.account_name) {
      // Keep provider diagnostics private; never expose Paystack limits or API messages to users.
      console.warn('[Payout account] Paystack verification was unsuccessful', { status: response.status });
      return fail('We could not verify this account right now. Please check the details or try again later.', 422);
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(accountNumber, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: saveError } = await admin.from('author_payout_accounts').upsert({
      author_id: auth.user.id,
      bank_code: bankCode,
      bank_name: bankName,
      account_name: String(result.data.account_name).slice(0, 160),
      account_number_ciphertext: ciphertext.toString('base64'),
      account_number_iv: iv.toString('base64'),
      account_number_tag: tag.toString('base64'),
      account_last4: accountNumber.slice(-4),
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'author_id' });
    if (saveError) {
      console.error('[Payout account] Save failed', { code: saveError.code, message: saveError.message });
      return fail('The account was verified, but we could not save it. Please try again.', 500);
    }
    return NextResponse.json({
      verified: true,
      accountName: result.data.account_name,
      bankName,
      accountLast4: accountNumber.slice(-4),
    });
  } catch {
    return fail('Account verification is temporarily unavailable.', 502);
  }
}
