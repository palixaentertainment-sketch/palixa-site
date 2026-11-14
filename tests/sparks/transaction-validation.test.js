import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVerifiedSparkTransaction } from '../lib/sparks/transaction-validation.js';

const valid = (overrides = {}) => ({
  reference: 'PLXSPK_0123456789abcdef0123456789abcdef',
  status: 'success',
  currency: 'NGN',
  amount: 50000,
  metadata: {
    purpose: 'palixia_sparks_purchase',
    reader_id: 'reader-123',
    sparks_amount: 500,
    test_mode: true,
  },
  ...overrides,
});

test('accepts a supported, successful NGN Sparks purchase', () => {
  assert.deepEqual(
    validateVerifiedSparkTransaction(valid(), 'reader-123', true),
    { sparks: 500, amountKobo: 50000, currency: 'NGN' }
  );
});

test('rejects failed or pending transactions', () => {
  assert.equal(validateVerifiedSparkTransaction(valid({ status: 'failed' }), 'reader-123', true), null);
  assert.equal(validateVerifiedSparkTransaction(valid({ status: 'pending' }), 'reader-123', true), null);
});

test('rejects wrong buyer, purpose, currency, reference and amount', () => {
  assert.equal(validateVerifiedSparkTransaction(valid(), 'someone-else', true), null);
  assert.equal(validateVerifiedSparkTransaction(valid({ metadata: { ...valid().metadata, purpose: 'other' } }), 'reader-123', true), null);
  assert.equal(validateVerifiedSparkTransaction(valid({ currency: 'USD' }), 'reader-123', true), null);
  assert.equal(validateVerifiedSparkTransaction(valid({ reference: 'not-a-reference' }), 'reader-123', true), null);
  assert.equal(validateVerifiedSparkTransaction(valid({ amount: 49999 }), 'reader-123', true), null);
});

test('rejects unsupported packages and malformed amounts', () => {
  assert.equal(validateVerifiedSparkTransaction(valid({ metadata: { ...valid().metadata, sparks_amount: 250 } }), 'reader-123', true), null);
  assert.equal(validateVerifiedSparkTransaction(valid({ amount: Number.MAX_SAFE_INTEGER + 1 }), 'reader-123', true), null);
});

test('requires an actual boolean test_mode matching the Paystack key', () => {
  assert.equal(validateVerifiedSparkTransaction(valid({ metadata: { ...valid().metadata, test_mode: 'false' } }), 'reader-123', true), null);
  assert.equal(validateVerifiedSparkTransaction(valid({ metadata: { ...valid().metadata, test_mode: false } }), 'reader-123', true), null);
  assert.equal(validateVerifiedSparkTransaction(valid(), 'reader-123', false), null);
});

test('rejects missing transaction or buyer identity', () => {
  assert.equal(validateVerifiedSparkTransaction(null, 'reader-123', true), null);
  assert.equal(validateVerifiedSparkTransaction(valid(), '', true), null);
});
