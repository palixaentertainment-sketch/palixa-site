'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PaystackTestPage() {
  const [email, setEmail] = useState('');
  const [amountNaira, setAmountNaira] = useState('100');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function startCheckout(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/paystack/test/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amountNaira: Number(amountNaira) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start test checkout.');
      window.location.assign(result.authorizationUrl);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <main className="wrap page narrow" style={{ maxWidth: 560, paddingTop: 40, paddingBottom: 64 }}>
      <Link href="/" className="fine">← Back to Palixia</Link>
      <section className="card stack">
        <span className="badge">Developer test · Not live</span>
        <h1 className="h1">Test a Paystack checkout</h1>
        <p>This private-development step checks whether Palixia can initialise a test transaction and return from Paystack. It does not tip an author, create earnings or move real money.</p>
        <form className="stack" onSubmit={startCheckout}>
          <label className="field">
            <span className="fine">Test email address</span>
            <input className="in" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="field">
            <span className="fine">Test amount (NGN)</span>
            <select className="in" value={amountNaira} onChange={(e) => setAmountNaira(e.target.value)}>
              <option value="100">₦100</option>
              <option value="500">₦500</option>
              <option value="1000">₦1,000</option>
              <option value="5000">₦5,000</option>
              <option value="10000">₦10,000</option>
            </select>
          </label>
          {error ? <p role="alert" className="fine" style={{ color: 'var(--danger, #b42318)' }}>{error}</p> : null}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Connecting to Paystack…' : 'Continue to Paystack test checkout'}</button>
        </form>
        <p className="fine">This page only works when the server has a Paystack test secret configured. Never enter live card details here.</p>
      </section>
    </main>
  );
}
