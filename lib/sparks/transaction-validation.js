const PACKAGES = new Map([
  [100, { amountKobo: 10000, sparks: 100 }],
  [200, { amountKobo: 20000, sparks: 200 }],
  [300, { amountKobo: 30000, sparks: 300 }],
  [500, { amountKobo: 50000, sparks: 500 }],
  [1000, { amountKobo: 100000, sparks: 1000 }],
]);

/**
 * Validates the independently fetched Paystack transaction, never a browser
 * request or webhook event payload. Returns the matching package or null.
 */
export function validateVerifiedSparkTransaction(transaction, expectedReaderId, secretIsTest) {
  if (!transaction || transaction.status !== 'success') return null;
  if (typeof transaction.reference !== 'string' || !/^PLXSPK_[a-f0-9]{32}$/i.test(transaction.reference)) return null;
  if (transaction.currency !== 'NGN' || !Number.isSafeInteger(transaction.amount)) return null;

  const metadata = transaction.metadata;
  if (!metadata || metadata.purpose !== 'palixia_sparks_purchase') return null;
  if (typeof expectedReaderId !== 'string' || !expectedReaderId || metadata.reader_id !== expectedReaderId) return null;
  // Paystack metadata must contain a real boolean. Truthy strings such as
  // "false" must never pass the test/live environment boundary.
  if (typeof metadata.test_mode !== 'boolean' || metadata.test_mode !== secretIsTest) return null;

  const sparks = Number(metadata.sparks_amount);
  const pack = PACKAGES.get(sparks);
  if (!pack || transaction.amount !== pack.amountKobo) return null;
  return { sparks: pack.sparks, amountKobo: pack.amountKobo, currency: 'NGN' };
}

export const SPARK_PACKAGES = PACKAGES;
