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
    <main className="wrap page sparks-page">
      <div className="sparks-heading">
        <Link href="/profile" className="sparks-back">← Profile</Link>
        <span className="sparks-eyebrow">THE PALIXIA EXPERIENCE</span>
        <h1 className="h1">Your Sparks</h1>
        <p className="muted">A little appreciation can keep a great story going.</p>
      </div>

      <section className="sparks-balance">
        <div className="sparks-balance-top">
          <span className="sparks-label">YOUR AVAILABLE BALANCE</span>
          <span className="sparks-private">PRIVATE WALLET</span>
        </div>
        <div className="sparks-total">{loading ? '…' : balance.toLocaleString('en-NG')} <span>✦</span></div>
        <p>Sparks ready for the stories and authors you love.</p>
        <div className="sparks-balance-foot"><span>✦</span> Your balance is only visible to you.</div>
        <span className="sparks-orbit sparks-orbit-one" aria-hidden="true" />
        <span className="sparks-orbit sparks-orbit-two" aria-hidden="true" />
      </section>

      <section className="sparks-topup">
        <div className="sparks-section-head">
          <div><span className="sparks-eyebrow">ADD TO YOUR WALLET</span><h2 className="h2">Get more Sparks</h2></div>
          <span className="sparks-topup-icon">✧</span>
        </div>
        <p className="muted">Top up your balance and use your Sparks to support authors on Palixia.</p>
        {adminTesting ? (
          <>
            <div className="sparks-packages">
              {PACKAGES.map((amount) => (
                <div className="sparks-package" key={amount}>
                  <span className="sparks-package-amount">{amount.toLocaleString('en-NG')}</span>
                  <span className="sparks-package-unit">SPARKS</span>
                  <span className="sparks-package-price">₦{amount.toLocaleString('en-NG')}</span>
                  <button className="btn" disabled={busy !== null} onClick={() => buy(amount)}>
                    {busy === amount ? 'Opening…' : 'Choose pack'}
                  </button>
                </div>
              ))}
            </div>
            <p className="fine">Admin testing only · ₦1 = 1 Spark</p>
          </>
        ) : (
          <div className="sparks-coming"><span>✦</span><div><b>Top-ups are on their way</b><small>You'll be able to add Sparks to your wallet soon.</small></div><span className="badge">Coming soon</span></div>
        )}
        {notice ? <p role="alert" className="notice">{notice}</p> : null}
      </section>

      <section className="sparks-history">
        <div className="sparks-section-head"><div><span className="sparks-eyebrow">YOUR WALLET ACTIVITY</span><h2 className="h2">Transaction history</h2></div><span className="sparks-history-count">{history.length} recent</span></div>
        {loading ? <div className="sparks-empty">Loading your activity…</div> : history.length === 0 ? (
          <div className="sparks-empty"><span className="sparks-empty-icon">✧</span><b>Your story starts here</b><p>Your Sparks transactions will appear here once you top up or support an author.</p></div>
        ) : (
          <div className="sparks-transactions">
            {history.map((entry) => {
              const debit = entry.entry_type === 'tip_debit';
              return <div className="sparks-transaction" key={entry.id}>
                <span className={`sparks-transaction-icon ${debit ? 'debit' : 'credit'}`}>{debit ? '↗' : '✦'}</span>
                <div className="sparks-transaction-info"><b>{entry.description || (entry.entry_type === 'purchase_credit' ? 'Sparks top-up' : debit ? 'Author support' : 'Sparks activity')}</b><small>{new Date(entry.created_at).toLocaleString()}</small></div>
                <strong className={debit ? 'debit-text' : 'credit-text'}>{debit ? '−' : '+'}{Number(entry.sparks_amount).toLocaleString('en-NG')} ✦</strong>
              </div>;
            })}
          </div>
        )}
      </section>

      <section className="sparks-explainer"><span className="sparks-explainer-mark">✦</span><div><b>What are Sparks?</b><p>Sparks are Palixia credits that let readers show appreciation for authors and their stories. Your balance and transaction history stay private to your account.</p></div></section>
    </main>
  );
}

export default function SparksPage() {
  return <Guard><SparksWallet /></Guard>;
}
