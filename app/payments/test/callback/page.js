'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PaystackTestCallbackPage() {
  const [reference, setReference] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedReference = params.get('reference') || params.get('trxref') || '';
    setReference(returnedReference);
    if (!returnedReference) {
      setError('Paystack did not return a transaction reference.');
      return;
    }

    let active = true;
    fetch('/api/paystack/test/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: returnedReference }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Verification failed.');
        return data;
      })
      .then((data) => { if (active) setResult(data); })
      .catch((err) => { if (active) setError(err.message || 'Verification failed.'); });
    return () => { active = false; };
  }, []);

  return (
    <main className="shell stack" style={{ maxWidth: 560, paddingTop: 40, paddingBottom: 64 }}>
      <section className="card stack">
        <span className="badge">Paystack test result</span>
        <h1 className="h1">Checking your payment</h1>
        {!result && !error ? <p>Verifying the transaction directly with Paystack…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {result ? <>
          <h2 className="h2">{result.status === 'success' && result.isTest ? 'Test payment confirmed' : 'Payment not confirmed'}</h2>
          <p>{result.message}</p>
          <p className="fine">Reference: {result.reference}</p>
          <p className="fine">Amount: {result.amountNaira == null ? 'Unavailable' : `₦${result.amountNaira.toLocaleString('en-NG')}`} {result.currency || ''}</p>
          <p className="fine">Test transaction: {result.isTest ? 'Yes' : 'Not identified as a Palixia test checkout'}</p>
        </> : null}
        <Link href="/payments/test" className="btn">Back to test checkout</Link>
        <Link href="/" className="fine">Return to Palixia</Link>
      </section>
    </main>
  );
}
