'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const PACKAGES = [100, 200, 300, 500, 1000];

function SparksWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');

  const loadWallet = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [b, h] = await Promise.all([
      supabase.from('reader_spark_balances').select('sparks_balance').eq('reader_id', user.id).maybeSingle(),
      supabase.from('reader_spark_ledger').select('id,entry_type,sparks_amount,description,created_at').eq('reader_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!b.error) setBalance(Number(b.data?.sparks_balance || 0));
    if (!h.error) setHistory(h.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  async function buy(amountNaira) {
    setBusy(amountNaira);
    setNotice('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (sessionError || !token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch('/api/sparks/purchase/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amountNaira }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start your purchase.');
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setNotice(error.message || 'Could not start your purchase.');
      setBusy(null);
    }
  }

  return (
    <main className="wrap page stack" style={{ maxWidth: 760 }}>
      <div className="stack">
        <Link href="/" className="fine">← Back to Palixia</Link>
        <h1 className="h1">Your Sparks</h1>
        <p className="muted">Buy Sparks to support the authors and stories you enjoy.</p>
      </div>
      <section className="card stack">
        <span className="mono">Available Sparks</span>
        <strong style={{ fontSize: '2.4rem' }}>{loading ? '…' : balance.toLocaleString('en-NG')} ✨</strong>
        <p className="fine">Your balance updates after Paystack confirms your payment.</p>
      </section>
      <section className="stack">
        <h2 className="h2">Choose a package</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12 }}>
          {PACKAGES.map((amount) => (
            <div className="card stack" key={amount}>
              <strong>{amount.toLocaleString('en-NG')} Sparks</strong>
              <span className="fine">₦{amount.toLocaleString('en-NG')}</span>
              <button className="btn" disabled={busy !== null} onClick={() => buy(amount)}>
                {busy === amount ? 'Opening…' : 'Buy'}
              </button>
            </div>
          ))}
        </div>
        <p className="fine">₦1 = 1 Spark. Minimum purchase: ₦100. Payments are processed securely by Paystack.</p>
        {notice ? <p role="alert" className="notice">{notice}</p> : null}
      </section>
      <section className="stack">
        <h2 className="h2">Sparks activity</h2>
        {loading ? <p className="muted">Loading activity…</p> : history.length === 0 ? <p className="muted">Your Sparks activity will appear here.</p> : (
          <div className="card stack">
            {history.map((entry) => (
              <div className="row" key={entry.id} style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line, #eee)', padding: '0.55rem 0' }}>
                <div>
                  <strong>{entry.description || (entry.entry_type === 'purchase_credit' ? 'Sparks purchase' : 'Sparks activity')}</strong>
                  <div className="fine">{new Date(entry.created_at).toLocaleString()}</div>
                </div>
                <strong>{entry.entry_type === 'tip_debit' ? '−' : '+'}{entry.sparks_amount} ✨</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function SparksPage() {
  return <Guard><SparksWallet /></Guard>;
}
