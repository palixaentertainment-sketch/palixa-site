'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function naira(kobo) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(Number(kobo || 0) / 100);
}

function EarningsWallet() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementLoading, setAgreementLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [agreementError, setAgreementError] = useState('');
  const [agreementConfirmed, setAgreementConfirmed] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const [ledger, withdrawals, agreement] = await Promise.all([
      supabase.from('author_wallet_ledger')
        .select('id,entry_type,status,amount_kobo,currency,description,created_at,reference')
        .eq('author_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('author_withdrawal_requests')
        .select('id,amount_kobo,currency,status,requested_at,reviewed_at,paid_at,admin_note')
        .eq('author_id', user.id).order('requested_at', { ascending: false }).limit(20),
      supabase.from('author_earnings_agreements').select('id').eq('author_id', user.id).eq('agreement_version', 'sparks-v1').maybeSingle(),
    ]);
    setAgreementLoading(false);
    if (!agreement.error) setAgreementAccepted(Boolean(agreement.data));
    if (ledger.error || withdrawals.error) {
      console.error('Author wallet could not load:', ledger.error || withdrawals.error);
      setError('Your wallet information could not be loaded. Please try again later.');
    } else {
      setEntries(ledger.data || []);
      setRequests(withdrawals.data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function acceptAgreement() {
    if (!user || !agreementConfirmed) return;
    setAccepting(true);
    setAgreementError('');
    const { error: insertError } = await supabase.from('author_earnings_agreements').insert({ author_id: user.id, agreement_version: 'sparks-v1' });
    setAccepting(false);
    if (insertError && insertError.code !== '23505') {
      setAgreementError('We could not save your acceptance. Please try again.');
      return;
    }
    setAgreementAccepted(true);
    setAgreementConfirmed(false);
  }

  const total = (status) => entries
    .filter((entry) => entry.status === status && entry.entry_type === 'tip_credit')
    .reduce((sum, entry) => sum + Number(entry.amount_kobo || 0), 0);
  const pending = total('pending');
  const available = total('available');
  const paid = entries.filter((entry) => entry.status === 'paid')
    .reduce((sum, entry) => sum + Number(entry.amount_kobo || 0), 0);

  return (
    <div className="stack">
      <div>
        <Link href="/dashboard" className="fine">← Back to dashboard</Link>
        <h1 className="h1">Author earnings</h1>
        <p className="muted">Track reader support and withdrawal request updates.</p>
      </div>
      <section className="stats">
        <div className="stat"><span className="mono">Pending</span><b>{naira(pending)}</b></div>
        <div className="stat"><span className="mono">Available</span><b>{naira(available)}</b></div>
        <div className="stat"><span className="mono">Paid</span><b>{naira(paid)}</b></div>
      </section>
      {!agreementLoading && !agreementAccepted && (
        <section className="card stack">
          <h2 className="h2">Set up Sparks earnings</h2>
          <p>Before readers can send you Sparks, please review and accept these conditions:</p>
          <ul className="fine" style={{ paddingLeft: '1.25rem' }}>
            <li>Reader support is recorded in your Palixia author wallet.</li>
            <li>All author credits remain pending while Palixia finalises its earnings and payout policy.</li>
            <li>Pending credits cannot be withdrawn, transferred or treated as a guaranteed payment.</li>
            <li>Any future withdrawal will be subject to the published payout rules, verification and applicable fees.</li>
          </ul>
          <label className="row" style={{ alignItems: 'flex-start', gap: '0.55rem' }}>
            <input type="checkbox" checked={agreementConfirmed} onChange={(event) => setAgreementConfirmed(event.target.checked)} />
            <span className="fine">I have read and agree to these Sparks earnings conditions.</span>
          </label>
          {agreementError && <p className="msg-err" role="alert">{agreementError}</p>}
          <button className="btn" type="button" disabled={!agreementConfirmed || accepting} onClick={acceptAgreement}>{accepting ? 'Saving…' : 'Accept and enable author support'}</button>
        </section>
      )}
      {agreementAccepted && <p className="fine">Sparks earnings conditions accepted. Reader credits remain pending until Palixia publishes and enables its payout policy. Minimum withdrawal is not yet active.</p>}
      {error && <p className="msg-err" role="alert">{error}</p>}
      <section className="card stack">
        <div className="sechead"><h2 className="h2">Earnings activity</h2><button className="btn ghost small" type="button" onClick={load}>Refresh</button></div>
        {loading ? <p className="muted">Loading wallet…</p> : entries.length === 0 ? (
          <p className="empty">You don't have any earnings yet. When readers support your stories, activity will appear here.</p>
        ) : (
          <div className="stack">
            {entries.map((entry) => (
              <div className="row" key={entry.id} style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border, #ddd)', padding: '0.65rem 0' }}>
                <div className="stack" style={{ gap: '0.2rem' }}>
                  <b>{entry.description || (entry.entry_type === 'tip_credit' ? 'Reader support' : 'Wallet adjustment')}</b>
                  <span className="fine">{new Date(entry.created_at).toLocaleString()} · {entry.status}</span>
                </div>
                <b>{naira(entry.amount_kobo)}</b>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="card stack">
        <h2 className="h2">Withdrawal requests</h2>
        {loading ? <p className="muted">Loading requests…</p> : requests.length === 0 ? (
          <p className="empty">No withdrawal requests yet. Withdrawal requests will open when the payout process is ready.</p>
        ) : requests.map((request) => (
          <div className="row" key={request.id} style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border, #ddd)', padding: '0.65rem 0' }}>
            <div className="stack" style={{ gap: '0.2rem' }}>
              <b>{naira(request.amount_kobo)}</b>
              <span className="fine">{new Date(request.requested_at).toLocaleDateString()} · {request.status.replaceAll('_', ' ')}</span>
              {request.admin_note && <span className="fine">{request.admin_note}</span>}
            </div>
          </div>
        ))}
      </section>
      <p className="fine">This wallet is currently a read-only preview. No withdrawal or payout can be initiated here.</p>
    </div>
  );
}

export default function AuthorWalletPage() {
  return <Guard roles={['author','admin']}><EarningsWallet /></Guard>;
}
