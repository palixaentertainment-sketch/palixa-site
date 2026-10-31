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

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const [ledger, withdrawals] = await Promise.all([
      supabase.from('author_wallet_ledger')
        .select('id,entry_type,status,amount_kobo,currency,description,created_at,reference')
        .eq('author_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('author_withdrawal_requests')
        .select('id,amount_kobo,currency,status,requested_at,reviewed_at,paid_at,admin_note')
        .eq('author_id', user.id).order('requested_at', { ascending: false }).limit(20),
    ]);
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
      <p className="fine">Pending earnings are not withdrawable. Available funds may be requested once Palixia enables an approved payout process. Minimum withdrawal planned: ₦1,000.</p>
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
