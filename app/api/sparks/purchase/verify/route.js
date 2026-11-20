import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateVerifiedSparkTransaction } from '@/lib/sparks/transaction-validation';

export const runtime = 'nodejs';

const PACKAGES = new Map([
  [100, { amountKobo: 10000, sparks: 100 }],
  [200, { amountKobo: 20000, sparks: 200 }],
  [300, { amountKobo: 30000, sparks: 300 }],
  [500, { amountKobo: 50000, sparks: 500 }],
  [1000, { amountKobo: 100000, sparks: 1000 }],
]);

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey || !paystackSecret) return fail('Sparks payments are not configured.', 503);
  // Require the Paystack secret to match the configured environment.
  const configuredTestMode = process.env.PAYSTACK_TEST_MODE === 'true';
  const secretIsTest = paystackSecret.startsWith('sk_test_');
  const secretMatchesMode = configuredTestMode ? secretIsTest : paystackSecret.startsWith('sk_live_');
  if (process.env.SPARKS_ADMIN_ONLY !== 'true' || !secretMatchesMode) {
    return fail('Sparks checkout is not configured for the selected admin-only Paystack mode.', 503);
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!accessToken) return fail('Please sign in to verify this purchase.', 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !userData?.user?.id) return fail('Your session has expired. Please sign in again.', 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let body;
  try { body = await request.json(); } catch { return fail('Invalid request body.'); }
  const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
  if (!/^PLXSPK_[a-f0-9]{32}$/i.test(reference)) return fail('Invalid Sparks payment reference.');

  // Always verify the exact reference with Paystack before attempting recovery.
  let verifyResponse;
  try {
    verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` },
      cache: 'no-store',
    });
  } catch {
    return fail('Could not reach Paystack to verify your payment.', 502);
  }
  const verified = await verifyResponse.json().catch(() => null);
  const transaction = verified?.data;
  if (!verifyResponse.ok || !verified?.status || !transaction) return fail('Paystack could not verify this payment.', 502);
  if (transaction.reference !== reference) return fail('Paystack returned a different payment reference.', 409);
  if (transaction.status !== 'success') {
    return NextResponse.json({ status: transaction.status || 'pending', credited: false });
  }

  const verifiedPackage = validateVerifiedSparkTransaction(transaction, userData.user.id, secretIsTest);
  if (!verifiedPackage) return fail('Paystack transaction details do not match a supported Sparks package.', 409);

  const { data: existingPurchase, error: purchaseLookupError } = await admin
    .from('spark_purchases')
    .select('id,reader_id,amount_kobo,sparks_amount,currency,status')
    .eq('paystack_reference', reference)
    .maybeSingle();

  if (purchaseLookupError) {
    console.error('[Sparks verify] Purchase lookup failed', { code: purchaseLookupError.code, message: purchaseLookupError.message });
    return fail('We could not check the Sparks purchase record. Please contact support.', 500);
  }

  // Corrective recovery: a successful Paystack transaction may correspond to a
  // local purchase row marked failed after a timeout. The normal credit RPC only
  // accepts pending rows, so recover failed rows atomically through the audited
  // service-role RPC after this route has independently verified Paystack.
  if (existingPurchase?.status === 'failed') {
    const { data: recovered, error: recoveryError } = await admin.rpc('admin_recover_verified_spark_purchase', {
      p_reference: reference,
      p_reader_id: userData.user.id,
      p_amount_kobo: transaction.amount,
      p_sparks_amount: existingPurchase.sparks_amount,
      p_admin_id: userData.user.id,
    });

    if (recoveryError || !recovered?.success) {
      console.error('[Sparks verify] Failed-purchase recovery RPC failed', {
        reference,
        userId: userData.user.id,
        code: recoveryError?.code || null,
        message: recoveryError?.message || null,
      });
      return fail('Paystack confirmed your payment, but Sparks could not be recovered automatically. Please contact support with your reference.', 500);
    }

    return NextResponse.json({
      status: 'success',
      credited: Boolean(recovered.credited),
      sparks: recovered.sparks_amount,
      message: recovered.credited ? 'Your Sparks have been recovered and added.' : 'This purchase was already credited.',
    });
  }

  let purchase = existingPurchase;

  // Recovery path: if the original pending row was not saved, reconstruct it
  // only from a successful Paystack transaction carrying Palixia's exact
  // purpose, the signed-in buyer's ID, a supported package, and matching NGN amount.
  if (!purchase) {
    const metadata = transaction.metadata || {};
    const sparksAmount = Number(metadata.sparks_amount);
    const pack = PACKAGES.get(sparksAmount);
    const recoverable =
      metadata.purpose === 'palixia_sparks_purchase' &&
      metadata.reader_id === userData.user.id &&
      metadata.test_mode === secretIsTest &&
      Boolean(pack) &&
      transaction.currency === 'NGN' &&
      transaction.amount === pack.amountKobo;

    if (!recoverable) return fail('We could not find a matching Palixia purchase for this Paystack transaction. Please contact support with your reference.', 404);

    // Use the authenticated, narrowly scoped SECURITY DEFINER RPC rather than a direct service-role insert.
    const { data: restoredPurchase, error: recoveryError } = await userClient.rpc('recover_verified_spark_purchase', {
      p_reference: reference,
      p_amount_kobo: pack.amountKobo,
      p_sparks_amount: pack.sparks,
    });

    if (recoveryError || !restoredPurchase) {
      console.error('[Sparks verify] Purchase recovery RPC failed', {
        reference,
        readerId: userData.user.id,
        code: recoveryError?.code || null,
        message: recoveryError?.message || (!restoredPurchase ? 'RPC returned no purchase row' : null),
        details: recoveryError?.details || null,
        hint: recoveryError?.hint || null,
      });
      return fail(
        recoveryError?.code === 'PGRST202' || recoveryError?.code === '42883'
          ? 'Sparks recovery database update is required. Please contact support with your reference.'
          : 'Payment is confirmed by Paystack, but Palixia could not restore the purchase record. Please contact support with your reference.',
        500
      );
    }

    // The recovery RPC returns the restored row directly. Avoid a second
    // PostgREST read that can fail independently after a successful insert.
    purchase = restoredPurchase;
  }

  if (purchase.reader_id !== userData.user.id) return fail('This purchase does not belong to your account.', 403);
  if (configuredTestMode !== secretIsTest ||
      transaction.metadata?.test_mode !== secretIsTest ||
      transaction.amount !== Number(purchase.amount_kobo) ||
      transaction.currency !== purchase.currency ||
      transaction.metadata?.purpose !== 'palixia_sparks_purchase' ||
      transaction.metadata?.reader_id !== userData.user.id ||
      Number(transaction.metadata?.sparks_amount) !== purchase.sparks_amount) {
    return fail('Payment details did not match this Sparks purchase. Please contact support with your reference.', 409);
  }

  // Paystack is independently verified above; invoke the guarded credit RPC with the authenticated user's JWT.
  const { data: posted, error: postError } = await userClient.rpc('post_verified_spark_purchase', {
    p_reference: reference,
    p_amount_kobo: transaction.amount,
    p_currency: transaction.currency,
  });
  if (postError) {
    // Return a generic failure to the buyer; keep diagnostics in server logs.
    const diagnosticId = request.headers.get('x-vercel-id') || `sparks-${Date.now()}`;
    console.error('[Sparks verify] Credit posting failed', {
      diagnosticId,
      stage: 'post_verified_spark_purchase',
      reference,
      userId: userData.user.id,
      rpc: 'post_verified_spark_purchase',
      code: postError.code || null,
      message: postError.message || null,
      details: postError.details || null,
      hint: postError.hint || null,
      errorName: postError.name || null,
      httpStatus: postError.status || null,
      verifiedAmountKobo: transaction.amount,
      verifiedCurrency: transaction.currency,
      purchaseStatus: purchase.status,
      purchaseSparks: purchase.sparks_amount,
    });
    return NextResponse.json({
      error: 'Payment was verified, but Sparks could not be credited automatically. Please contact support with your reference.',
      diagnostic: {
        stage: 'post_verified_spark_purchase',
        code: postError.code || null,
        message: postError.message || 'No database error message was returned.',
        details: postError.details || null,
        hint: postError.hint || null,
        diagnosticId,
      },
    }, { status: 500 });
  }

  return NextResponse.json({
    status: 'success',
    credited: Boolean(posted),
    sparks: purchase.sparks_amount,
    message: posted ? 'Your Sparks have been added.' : 'This purchase was already credited.',
  });
}
