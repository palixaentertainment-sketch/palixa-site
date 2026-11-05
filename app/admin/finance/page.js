'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import { supabase } from '@/lib/supabase';

function naira(kobo) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(Number(kobo || 0) / 100);
}
function number(value) {
  return Number(value || 0).toLocaleString('en-NG');
}
function date(value) {
  return value ? new Date(value).toLocaleString() : '—';
}
function Stat({ label, value, detail }) {
  return <div className="stat"><span className="mono">{label}</span><b>{value}</b>{detail ? <span className="fine">{detail}</span> : null}</div>;
}

function FinancePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: result, error: rpcError } = await supabase.rpc('admin_finance_overview');
    if (rpcError) {
      setData(null);
      setError(rpcError.message?.includes('admin_finance_overview')
        ? 'The finance dashboard database setup has not been applied yet. Run the new admin_finance_overview migration in Supabase, then refresh.'
        : 'Financial data could not be loaded. Check your active admin access and database setup.');
    } else {
      setData(result || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const purchases = data?.purchases || {};
  const wallets = data?.reader_wallets || {};
  const withdrawals = data?.withdrawals || {};
  const earnings = data?.author_earnings || [];

  return (
    <main className="wrap page stack">
      <div className="stack">
        <Link href="/admin" className="fine">← Back to admin dashboard</Link>
        <div className="sechead">
          <div><span className="fine">PALIXIA · PRIVATE ADMIN</span><h1 className="h1">Financial overview</h1></div>
          <button className="btn ghost small" type="button" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <p className="muted">Read-only view of Sparks purchases, wallet balances, author ledger entries and withdrawal requests. All money values are stored and displayed in NGN.</p>
      </div>

      {error && <p className="msg-err" role="alert">{error}</p>}
      {loading && !data ? <p className="muted">Loading financial records…</p> : null}

      {data && <>
        <section className="stack">
          <h2 className="h2">Reader purchases</h2>
          <div className="stats">
            <Stat label="Paid purchases" value={number(purchases.paid_count)} detail={naira(purchases.paid_amount_kobo) + ' gross recorded'} />
            <Stat label="Sparks sold" value={number(purchases.sparks_sold)} />
            <Stat label="Pending purchases" value={number(purchases.pending_count)} />
            <Stat label="Failed / refunded" value={number(purchases.failed_count) + ' / ' + number(purchases.refunded_count)} />
          </div>
        </section>

        <section className="stack">
          <h2 className="h2">Reader wallet balances</h2>
          <div className="stats">
            <Stat label="Outstanding Sparks" value={number(wallets.total_outstanding_sparks)} detail="Net balance across reader wallets" />
            <Stat label="Funded wallets" value={number(wallets.wallet_count)} detail="Accounts with a positive balance" />
          </div>
        </section>

        <section className="stack">
          <h2 className="h2">Author earnings ledger</h2>
          <p className="fine">These are ledger totals by entry type and status. Pending credits are not withdrawable. The proposed 90/10 split is not applied by the current tip function.</p>
          <div className="tablewrap"><table><thead><tr><th>Entry type</th><th>Status</th><th>Entries</th><th>Amount</th></tr></thead><tbody>
            {earnings.map((row, index) => <tr key={row.entry_type + '-' + row.status + '-' + index}><td>{String(row.entry_type).replaceAll('_', ' ')}</td><td>{String(row.status).replaceAll('_', ' ')}</td><td>{number(row.entry_count)}</td><td>{naira(row.amount_kobo)}</td></tr>)}
            {earnings.length === 0 && <tr><td colSpan="4">No author ledger entries yet.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="stack">
          <h2 className="h2">Withdrawal requests</h2>
          <div className="stats">
            <Stat label="Requested" value={number(withdrawals.requested_count)} />
            <Stat label="Under review" value={number(withdrawals.under_review_count)} />
            <Stat label="Approved" value={number(withdrawals.approved_count)} />
            <Stat label="Paid" value={number(withdrawals.paid_count)} />
            <Stat label="Rejected / cancelled" value={number(withdrawals.rejected_count) + ' / ' + number(withdrawals.cancelled_count)} />
            <Stat label="Open request value" value={naira(withdrawals.requested_amount_kobo)} detail="Requested, under review and approved" />
          </div>
        </section>

        <section className="stack">
          <h2 className="h2">Recent Sparks purchases</h2>
          <div className="tablewrap"><table><thead><tr><th>Date</th><th>Reader ID</th><th>Sparks</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            {(data.recent_purchases || []).map(row => <tr key={row.id}><td>{date(row.created_at)}</td><td><code>{row.reader_id}</code></td><td>{number(row.sparks_amount)}</td><td>{naira(row.amount_kobo)}</td><td>{row.status}</td></tr>)}
            {!data.recent_purchases?.length && <tr><td colSpan="5">No purchases recorded.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="stack">
          <h2 className="h2">Recent author ledger entries</h2>
          <div className="tablewrap"><table><thead><tr><th>Date</th><th>Author ID</th><th>Type</th><th>Status</th><th>Amount</th></tr></thead><tbody>
            {(data.recent_author_entries || []).map(row => <tr key={row.id}><td>{date(row.created_at)}</td><td><code>{row.author_id}</code></td><td>{String(row.entry_type).replaceAll('_', ' ')}</td><td>{row.status}</td><td>{naira(row.amount_kobo)}</td></tr>)}
            {!data.recent_author_entries?.length && <tr><td colSpan="5">No author ledger entries recorded.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="stack">
          <h2 className="h2">Recent withdrawal requests</h2>
          <div className="tablewrap"><table><thead><tr><th>Requested</th><th>Author ID</th><th>Amount</th><th>Status</th><th>Paid</th></tr></thead><tbody>
            {(data.recent_withdrawals || []).map(row => <tr key={row.id}><td>{date(row.requested_at)}</td><td><code>{row.author_id}</code></td><td>{naira(row.amount_kobo)}</td><td>{row.status}</td><td>{date(row.paid_at)}</td></tr>)}
            {!data.recent_withdrawals?.length && <tr><td colSpan="5">No withdrawal requests recorded.</td></tr>}
          </tbody></table></div>
        </section>
        <p className="fine">Snapshot generated {date(data.generated_at)}. This page does not approve withdrawals, alter balances or initiate payments.</p>
      </>}
    </main>
  );
}

export default function AdminFinancePage() {
  return <Guard roles={['admin']}><FinancePanel /></Guard>;
}
