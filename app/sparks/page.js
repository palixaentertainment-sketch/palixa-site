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
  const [adminTesting, setAdminTesting] = useState(false);

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

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        try {
          const response = await fetch('/api/sparks/access', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
          if (response.ok) {
            const result = await response.json();
            if (active) setAdminTesting(Boolean(result.enabled));
          }
        } catch {}
      }
      if (active) loadWallet();
    })();
    return () => { active = false; };
  }, [loadWallet]);

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
        <Link href="/profile" className="fine">← Back to profile</Link>
        <h1 className="h1">My Sparks Wallet</h1>
        <p className="muted">Keep track of your Sparks and use them to support the authors you enjoy.</p>
      </div>
      <section className="card stack">
        <span className="mono">AVAILABLE SPARKS</span>
        <strong style={{ fontSize: '2.5rem' }}>{loading ? '…' : balance.toLocaleString('en-NG')} ✨</strong>
        <p className="fine">Your Sparks balance and activity are private to your account.</p>
      </section>
      <section className="card stack">
        <div>
          <h2 className="h2">Top up your wallet</h2>
          <p className="muted">Add Sparks to your balance so you can support authors and their stories.</p>
        </div>
        {adminTesting ? (
          <>
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
            <p className="fine">Admin testing only. ₦1 = 1 Spark.</p>
          </>
        ) : (
          <button className="btn" type="button" disabled>Buy Sparks — Coming soon</button>
        )}
        {notice ? <p role="alert" className="notice">{notice}</p> : null}
      </section>
      <section className="stack">
        <h2 className="h2">Transaction history</h2>
        {loading ? <p className="muted">Loading activity…</p> : history.length === 0 ? (
          <div className="card"><p className="muted">No transactions yet. Your Sparks activity will appear here.</p></div>
        ) : (
          <div className="card stack">
            {history.map((entry) => (
              <div className="row" key={entry.id} style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line, #eee)', padding: '0.65rem 0' }}>
                <div>
                  <strong>{entry.description || (entry.entry_type === 'purchase_credit' ? 'Sparks top-up' : entry.entry_type === 'tip_debit' ? 'Author support' : 'Sparks activity')}</strong>
                  <div className="fine">{new Date(entry.created_at).toLocaleString()}</div>
                </div>
                <strong>{entry.entry_type === 'tip_debit' ? '−' : '+'}{entry.sparks_amount} ✨</strong>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="card">
        <h2 className="h2">What are Sparks?</h2>
        <p className="muted">Sparks are Palixia credits readers can use to show support for authors. You can check your balance and transaction history here.</p>
      </section>
    </main>
  );
}

export default function SparksPage() {
  return <Guard><SparksWallet /></Guard>;
}
