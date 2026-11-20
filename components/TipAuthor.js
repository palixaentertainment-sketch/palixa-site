'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function TipAuthor({ authorName, authorId, bookId = null, compact = false }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState('');
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoadingBalance(true);
    setBalanceError(false);
    supabase.from('reader_spark_balances').select('sparks_balance').eq('reader_id', user.id).maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (!active) return;
        if (fetchError) {
          setBalanceError(true);
          setBalance(null);
        } else {
          setBalance(Number(data?.sparks_balance || 0));
        }
        setLoadingBalance(false);
      });
    return () => { active = false; };
  }, [open, user, retryKey]);

  async function sendGift() {
    setNotice('');
    setError('');
    const gift = Number(amount);
    if (!Number.isInteger(gift) || gift < 1) { setError('Enter a whole number of Sparks.'); return; }
    if (balance === null) { setError('Your balance is not ready yet.'); return; }
    if (gift > balance) { setError('Not enough Sparks in your wallet. Add Sparks to continue.'); return; }
    if (!user) { setError('Log in to send Sparks.'); return; }
    setSending(true);
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const reference = 'PLXTIP_' + Array.from(bytes).map((v) => v.toString(16).padStart(2, '0')).join('');
      const { data, error: rpcError } = await supabase.rpc('send_author_sparks', {
        p_author_id: authorId, p_book_id: bookId, p_sparks: gift, p_reference: reference,
      });
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error('The gift could not be completed. Please try again.');
      setBalance((current) => Math.max(0, (current ?? 0) - gift));
      setAmount('');
      setNotice('Gift sent! Thank you for supporting ' + (authorName || 'the author') + '.');
    } catch (e) {
      const message = e?.message || '';
      if (/Insufficient Sparks balance/i.test(message)) setError('Not enough Sparks in your wallet. Add Sparks to continue.');
      else if (/agreement/i.test(message)) setError('This author has not enabled Sparks support yet.');
      else setError(message || 'Your gift could not be sent. Please try again.');
    } finally { setSending(false); }
  }

  const cardStyle = {
    width: '100%', maxWidth: '100%', border: '1px solid var(--line)',
    borderRadius: '12px', padding: compact ? '.75rem' : '.9rem',
    background: 'var(--surface)', boxSizing: 'border-box',
  };

  return (
    <section className="tip-author-wrap" style={cardStyle}>
      {!open ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', flex: '0 0 38px', height: '38px', borderRadius: '10px', background: 'rgba(124, 58, 237, .10)', color: 'var(--primary, #7138c8)', fontSize: '1.15rem', fontWeight: 700 }}>✦</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 650 }}>Support {authorName || 'this author'}</div>
            <p className="fine" style={{ margin: '.15rem 0 0' }}>Enjoying this story? Send Sparks.</p>
          </div>
          <button type="button" className={compact ? 'btn small' : 'btn'} onClick={() => { setOpen(true); setNotice(''); setError(''); }}>Gift</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>
            <div style={{ fontWeight: 650 }}>Send Sparks to {authorName || 'the author'}</div>
            <button type="button" className="btn ghost small" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap' }}>
            <span className="fine">{loadingBalance ? 'Loading wallet…' : balance === null ? 'Balance unavailable' : 'Balance: ' + balance.toLocaleString('en-NG') + ' Sparks'}</span>
            {balanceError && <button type="button" className="btn ghost small" onClick={() => setRetryKey((k) => k + 1)}>Retry</button>}
          </div>
          <input type="number" inputMode="numeric" min="1" step="1" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} placeholder="Sparks amount" aria-label="Sparks amount" disabled={loadingBalance || balance === null} style={{ width: '100%', boxSizing: 'border-box' }} />
          {amount && Number(amount) > 0 && <p className="fine" style={{ margin: '-.35rem 0 0' }}>{Number(amount).toLocaleString('en-NG')} Sparks</p>}
          {error && <p className="fine" role="alert" style={{ margin: 0, color: 'var(--danger, #b54b67)' }}>{error}</p>}
          {notice && <p className="fine" role="status" style={{ margin: 0 }}>{notice}</p>}
          {balance !== null && !loadingBalance && balance < 1 && <p className="fine" style={{ margin: 0 }}>Your wallet is empty.</p>}
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={sendGift} disabled={sending || loadingBalance || balance === null || !amount || Number(amount) < 1}>{sending ? 'Sending…' : 'Send Sparks'}</button>
            <Link className="btn ghost" href="/sparks">Buy Sparks</Link>
          </div>
        </div>
      )}
    </section>
  );
}
