'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SparksCallbackPage() {
  const [state, setState] = useState('checking');
  const [message, setMessage] = useState('Confirming your payment directly with Paystack…');
  const [sparks, setSparks] = useState(0);
  const [reference, setReference] = useState('');

  useEffect(() => {
    let active = true;
    async function verify() {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('reference') || params.get('trxref') || '';
      setReference(ref);
      if (!ref) {
        if (active) { setState('error'); setMessage('We could not find your payment reference.'); }
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (sessionError || !token) {
        if (active) { setState('error'); setMessage('Please sign in to the account used for this purchase, then contact support with your reference so we can check it.'); }
        return;
      }

      try {
        const response = await fetch('/api/sparks/purchase/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reference: ref }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'We could not verify this payment.');
        if (active) {
          if (data.status === 'success' && data.credited) {
            setState('success');
            setSparks(data.sparks || 0);
            setMessage('Your Sparks have been added to your balance.');
          } else if (data.status === 'success') {
            setState('success');
            setSparks(data.sparks || 0);
            setMessage('This purchase was already credited to your account.');
          } else {
            setState('pending');
            setMessage('Paystack has not confirmed this payment yet. Your Sparks have not been added.');
          }
        }
      } catch (error) {
        if (active) { setState('error'); setMessage(error.message || 'Verification failed.'); }
      }
    }
    verify();
    return () => { active = false; };
  }, []);

  return (
    <main className="wrap page stack" style={{ maxWidth: 620 }}>
      <section className="card stack">
        <span className="badge">Sparks payment</span>
        <h1 className="h1">{state === 'success' ? 'Payment confirmed' : state === 'pending' ? 'Payment pending' : state === 'error' ? 'We need to check something' : 'Checking your payment'}</h1>
        <p>{message}</p>
        {state === 'success' ? <strong style={{ fontSize: '1.8rem' }}>+{sparks.toLocaleString('en-NG')} ✨</strong> : null}
        {reference ? <p className="fine">Reference: {reference}</p> : null}
        <div className="row">
          <Link className="btn" href="/sparks">View Sparks wallet</Link>
          <Link className="btn ghost" href="/">Return home</Link>
        </div>
        {state === 'error' || state === 'pending' ? <p className="fine">If money was deducted, do not pay again until the transaction has been checked. Keep your reference for support.</p> : null}
      </section>
    </main>
  );
}
