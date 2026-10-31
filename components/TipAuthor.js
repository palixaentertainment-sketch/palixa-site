'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function TipAuthor({ authorName, authorId, bookId = null, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('10');

  async function send() {
    setMessage('');
    const sparks = Number(amount);
    if (!Number.isInteger(sparks) || sparks < 1 || sparks > 10000) {
      setMessage('Enter an amount between 1 and 10,000 Sparks.');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) {
      setMessage('Please sign in to support this author.');
      return;
    }
    if (user.id === authorId) {
      setMessage('You cannot send Sparks to yourself.');
      return;
    }
    const confirmed = window.confirm(`Send ${sparks} Sparks to ${authorName || 'this author'}? This will be deducted from your Sparks balance.`);
    if (!confirmed) return;
    setBusy(true);
    const reference = 'PLXTIP_' + crypto.randomUUID().replaceAll('-', '');
    const { error } = await supabase.rpc('send_author_sparks', {
      p_author_id: authorId,
      p_book_id: bookId,
      p_sparks: sparks,
      p_reference: reference,
    });
    setBusy(false);
    if (error) {
      const text = error.message || '';
      setMessage(text.includes('Insufficient Sparks')
        ? 'You do not have enough Sparks. Buy more in your Sparks wallet.'
        : text.includes('earnings agreement')
          ? 'This author has not completed the Sparks setup yet.'
          : 'We could not send Sparks. Please try again.');
      return;
    }
    setMessage('Thank you for supporting this author!');
    setAmount('10');
  }

  return (
    <span className="tip-author-wrap stack" style={{ gap: '0.4rem', alignItems: 'flex-start' }}>
      <label className="fine" htmlFor={compact ? 'spark-amount-compact' : 'spark-amount'}>Sparks to send</label>
      <div className="row" style={{ gap: '0.4rem' }}>
        <input
          id={compact ? 'spark-amount-compact' : 'spark-amount'}
          type="number" min="1" max="10000" step="1" inputMode="numeric"
          value={amount} onChange={(event) => setAmount(event.target.value)}
          aria-label="Number of Sparks"
          style={{ width: '6rem' }}
        />
        <button type="button" className={compact ? 'btn ghost small' : 'btn'} onClick={send} disabled={busy || !authorId}>
          {busy ? 'Sending…' : '✨ Send a Spark'}
        </button>
      </div>
      {message && <span className="fine" role="status">{message}</span>}
      <Link className="fine linkbtn" href="/sparks">View Sparks balance</Link>
    </span>
  );
}
