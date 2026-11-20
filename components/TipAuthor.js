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
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoadingBalance(true);
    setError('');
    supabase.from('reader_spark_balances').select('sparks_balance').eq('reader_id', user.id).maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (!active) return;
        if (fetchError) {
          setError('Your wallet balance could not be loaded. Please try again.');
          setBalance(null);
        } else {
          setBalance(Number(data?.sparks_balance || 0));
        }
        setLoadingBalance(false);
      });
    return () => { active = false; };
  }, [open, user]);

  async function sendGift() {
    setNotice('');
    setError('');
    const gift = Number(amount);
    if (!Number.isInteger(gift) || gift < 1) { setError('Enter a whole number of Sparks to send.'); return; }
    if (balance === null) { setError('Your wallet balance is still loading. Please try again.'); return; }
    if (gift > balance) { setError('You don’t have enough Sparks for that gift. Add Sparks to your wallet to continue'); return; }
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
      setNotice('You sent ' + gift.toLocaleString('en-NG') + ' Sparks to ' + (authorName || 'the author') + '. Thank you for supporting their story!');
    } catch (e) {
      const message = e?.message || '';
      if (/Insufficient Sparks balance/i.test(message)) setError('You don’t have enough Sparks for that gift. Add Sparks to your wallet to continue');
      else if (/agreement/i.test(message)) setError('This author has not enabled Sparks support yet.');
      else setError(message || 'Your gift could not be sent. Please try again.');
    } finally { setSending(false); }
  }

  return (
    <div className="tip-author-wrap stack" style={{ gap: '.5rem', alignItems: 'flex-start' }}>
      <p className="fine" style={{ margin: 0 }}>Support {authorName || 'this author'} with Sparks. Send support from your reader wallet.</p>
      <button type="button" className={compact ? 'btn ghost small' : 'btn ghost'} onClick={() => { setOpen(true); setNotice(''); setError(''); }}>
        Gift Sparks <span aria-hidden="true">→</span>
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Gift Sparks" className="panel stack" style={{ width: '100%', maxWidth: '24rem', gap: '.75rem', padding: '1rem' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Gift Sparks</h3>
            <button type="button" className="btn ghost small" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          <p className="fine" style={{ margin: 0 }}>Support {authorName || 'this author'} with Sparks.</p>
          <p style={{ margin: 0 }}><b>Your balance:</b> {loadingBalance ? 'Loading…' : balance === null ? 'Unavailable' : balance.toLocaleString('en-NG') + ' Sparks'}</p>
          <label className="stack" style={{ gap: '.3rem' }}>
            <span>How many Sparks would you like to send?</span>
            <input type="number" inputMode="numeric" min="1" step="1" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} placeholder="Enter Sparks amount" disabled={loadingBalance || balance === null} />
          </label>
          {amount && Number(amount) > 0 && <p className="fine" style={{ margin: 0 }}>Gift amount: {Number(amount).toLocaleString('en-NG')} Sparks</p>}
          {error && <p className="msg-err" role="alert" style={{ margin: 0 }}>{error}</p>}
          {notice && <p className="notice" role="status" style={{ margin: 0 }}>{notice}</p>}
          {balance !== null && !loadingBalance && balance < 1 && <p className="fine" style={{ margin: 0 }}>Your wallet is empty. Add Sparks to gift this author.</p>}
          <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={sendGift} disabled={sending || loadingBalance || balance === null || !amount || Number(amount) < 1}>{sending ? 'Sending…' : 'Send Sparks'}</button>
            <Link className="btn ghost" href="/sparks">Add Sparks</Link>
          </div>
        </div>
      )}
    </div>
  );
}
