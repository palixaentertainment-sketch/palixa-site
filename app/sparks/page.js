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
    if (!window.confirm('You are about to purchase ' + amountNaira.toLocaleString('en-NG') + ' Sparks for ₦' + amountNaira.toLocaleString('en-NG') + '. Continue to Paystack?')) return;
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
        <span className="sparks-eyebrow">PALIXIA · READER WALLET</span>
        <h1 className="h1">Your Sparks</h1>
        <p className="muted">Buy Sparks and support the authors behind the stories you love.</p>
      </div>

      <section className="sparks-reader-overview">
        <section className="sparks-balance">
        <div className="sparks-balance-top">
          <span className="sparks-label">YOUR AVAILABLE BALANCE</span>
          <span className="sparks-private">ACCOUNT BALANCE</span>
        </div>
        <div className="sparks-total">{loading ? '…' : balance.toLocaleString('en-NG')} <span>✦</span></div>
        <p>Use your Sparks to support authors whose stories you enjoy.</p>
        <div className="sparks-balance-foot"><span>✦</span> Your wallet activity is private to your account.</div>
        <span className="sparks-orbit sparks-orbit-one" aria-hidden="true" />
        <span className="sparks-orbit sparks-orbit-two" aria-hidden="true" />
        </section>
        <aside className="sparks-reader-prompt">
          <span className="sparks-reader-prompt-icon" aria-hidden="true">✦</span>
          <span className="sparks-eyebrow">MAKE A STORY'S DAY</span>
          <h2>Found a story you love?</h2>
          <p>Send Sparks to show an author that their words matter. Your support activity is saved here, so you can keep track of every gift.</p>
          <Link href="/discover" className="btn">Discover stories <span aria-hidden="true">→</span></Link>
        </aside>
      </section>

      <section className="sparks-topup" id="add-sparks">
        <div className="sparks-section-head">
          <div><span className="sparks-eyebrow">TOP UP YOUR READER WALLET</span><h2 className="h2">Get more Sparks</h2></div>
          <span className="sparks-topup-icon">✧</span>
        </div>
        <p className="muted">Buy Sparks securely, then send them to authors whose stories you love.</p>
        <div className="sparks-packages">
          {PACKAGES.map((amount) => (
            <div className={`sparks-package ${amount === 500 ? 'sparks-package-featured' : ''}`} key={amount}>
              {amount === 500 ? <span className="sparks-package-popular">POPULAR</span> : null}
              <span className="sparks-package-name">{amount === 100 ? 'Starter' : amount === 200 ? 'Reader' : amount === 300 ? 'Fan' : amount === 500 ? 'Super fan' : 'Mega fan'}</span>
              <span className="sparks-package-amount">{amount.toLocaleString('en-NG')}</span>
              <span className="sparks-package-unit">SPARKS</span>
              <span className="sparks-package-price">₦{amount.toLocaleString('en-NG')}</span>
              <button className="btn" disabled={busy !== null} onClick={() => buy(amount)}>
                {busy === amount ? 'Opening…' : 'Buy package'}
              </button>
            </div>
          ))}
        </div>
        <p className="fine">1 Spark = ₦1 of purchase value. Payments are processed securely by Paystack.</p>
        {notice ? <p role="alert" className="notice">{notice}</p> : null}
      </section>

      <section className="sparks-history">
        <div className="sparks-section-head"><div><span className="sparks-eyebrow">YOUR GIFTING RECORD</span><h2 className="h2">Sparks activity</h2></div><span className="sparks-history-count">{history.length} recent</span></div>
        {loading ? <div className="sparks-empty">Loading your activity…</div> : history.length === 0 ? (
          <div className="sparks-empty"><span className="sparks-empty-icon">✧</span><b>Your story starts here</b><p>Your top-ups and gifts to authors appear here.</p></div>
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

      <section className="sparks-explainer"><span className="sparks-explainer-mark">✦</span><div><b>A little support goes a long way</b><p>Sparks are reader credits you can send to authors whose stories mean something to you. Your wallet balance and gifting history are private.</p></div></section>
    </main>
  );
}

export default function SparksPage() {
  return <Guard><SparksWallet /></Guard>;
}
