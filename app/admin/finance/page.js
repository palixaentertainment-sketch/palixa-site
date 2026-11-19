'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import { supabase } from '@/lib/supabase';
import SparksReconciliationPanel from './SparksReconciliationPanel';
import SparksMissingPaymentsPanel from './SparksMissingPaymentsPanel';

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
  const [withdrawalRows, setWithdrawalRows] = useState([]);
  const [actionId, setActionId] = useState('');
  const [actionError, setActionError] = useState('');
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [releaseMessage, setReleaseMessage] = useState('');
  const [refundRows, setRefundRows] = useState([]);
  const [refundReference, setRefundReference] = useState('');
  const [providerRefundReference, setProviderRefundReference] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundMessage, setRefundMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [{ data: result, error: rpcError }, { data: rows, error: rowsError }, { data: refunds, error: refundsError }] = await Promise.all([supabase.rpc('admin_finance_overview'), supabase.rpc('admin_list_withdrawal_requests'), supabase.rpc('admin_list_spark_refunds')]);
    if (rowsError) setActionError('Withdrawal requests could not be loaded. Apply the withdrawal-management migration first.');
    else setWithdrawalRows(Array.isArray(rows) ? rows : []);
    if (refundsError) setActionError('Refund records could not be loaded. Apply the manual Sparks refunds migration first.');
    else setRefundRows(Array.isArray(refunds) ? refunds : []);
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

  async function releasePendingEarnings() {
    const confirmed = window.confirm('Release all pending author tip credits recorded up to now? This makes those earnings available for withdrawal.');
    if (!confirmed) return;
    setReleaseBusy(true);
    setReleaseMessage('');
    setActionError('');
    const { data: result, error: releaseError } = await supabase.rpc('admin_release_pending_author_earnings', { p_through: new Date().toISOString() });
    setReleaseBusy(false);
    if (releaseError) {
      setActionError('Pending earnings could not be released. Apply the Sparks webhook and monthly release migration, then try again.');
      return;
    }
    setReleaseMessage(`${number(result?.released_entries)} entries released · ${naira(result?.released_amount_kobo)} now available.`);
    await load();
  }

  async function recordSparkRefund(event) {
    event.preventDefault();
    if (!refundReference.trim() || !providerRefundReference.trim()) return;
    const confirmed = window.confirm('Have you already completed this refund in Paystack and confirmed that it succeeded? Palixia will only record the completed refund and reverse the unused Sparks.');
    if (!confirmed) return;
    setRefundBusy(true);
    setRefundMessage('');
    setActionError('');
    const { data: result, error: refundError } = await supabase.rpc('admin_record_spark_refund', {
      p_paystack_reference: refundReference.trim(),
      p_paystack_refund_reference: providerRefundReference.trim(),
      p_admin_note: refundNote.trim() || null,
    });
    setRefundBusy(false);
    if (refundError) {
      setActionError(refundError.message || 'The refund could not be recorded.');
      return;
    }
    setRefundMessage('Refund recorded: ' + naira(result?.amount_kobo) + ' · ' + number(result?.sparks_reversed) + ' Sparks reversed.');
    setRefundReference('');
    setProviderRefundReference('');
    setRefundNote('');
    await load();
  }

  async function manageWithdrawal(row, action) {
    let adminNote = '';
    let payoutReference = '';
    if (action === 'reject') {
      adminNote = window.prompt('Reason for rejecting this request:') || '';
      if (!adminNote.trim()) return;
    }
    if (action === 'mark_paid') {
      payoutReference = window.prompt('Bank transfer reference (only after sending the transfer):') || '';
      if (!payoutReference.trim()) return;
    }
    if (action === 'approve') adminNote = window.prompt('Optional admin note:') || '';
    setActionId(row.id);
    setActionError('');
    const result = await supabase.rpc('admin_manage_withdrawal', {
      p_request_id: row.id, p_action: action,
      p_admin_note: adminNote || null, p_payout_reference: payoutReference || null,
    });
    setActionId('');
    if (result.error) { setActionError(result.error.message || 'The withdrawal action failed.'); return; }
    await load();
  }

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
        <p className="muted">Private admin view of Sparks purchases, author earnings and withdrawal requests. All money values are stored and displayed in NGN.</p>
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
          <p className="fine">Pending author tip credits are not withdrawable until you release them. Use the monthly release action after reviewing the ledger. The 90/10 split applies to new tips.</p>\n          <div className="row" style={{flexWrap:"wrap",alignItems:"center",gap:".75rem"}}><button className="btn small" type="button" onClick={releasePendingEarnings} disabled={releaseBusy}>{releaseBusy ? "Releasing…" : "Release pending author earnings"}</button><span className="fine">Releases all pending author tip credits up to now.</span></div>\n          {releaseMessage && <p className="msg-ok" role="status">{releaseMessage}</p>}
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
          <h2 className="h2">Record a completed Paystack refund</h2>
          <p className="fine">First issue the refund manually in your Paystack dashboard. Only submit this form after Paystack confirms the refund succeeded. Palixia does not initiate or send the refund.</p>
          <form className="stack" onSubmit={recordSparkRefund}>
            <div className="field">
              <label htmlFor="refund-purchase-reference">Original Palixia Paystack transaction reference</label>
              <input id="refund-purchase-reference" className="in" value={refundReference} onChange={e => setRefundReference(e.target.value)} required autoComplete="off" placeholder="PLXSPK_…" />
            </div>
            <div className="field">
              <label htmlFor="refund-provider-reference">Paystack refund reference</label>
              <input id="refund-provider-reference" className="in" value={providerRefundReference} onChange={e => setProviderRefundReference(e.target.value)} required autoComplete="off" placeholder="Reference returned by Paystack" />
            </div>
            <div className="field">
              <label htmlFor="refund-admin-note">Admin note (optional)</label>
              <textarea id="refund-admin-note" className="in" rows={2} value={refundNote} onChange={e => setRefundNote(e.target.value)} placeholder="Reason / support case reference" />
            </div>
            <div className="row" style={{flexWrap:'wrap',gap:'.5rem',alignItems:'center'}}>
              <button className="btn" type="submit" disabled={refundBusy}>{refundBusy ? 'Recording…' : 'Record confirmed refund'}</button>
              <span className="fine">Only full refunds of unused Sparks are supported automatically.</span>
            </div>
          </form>
          {refundMessage && <p className="msg-ok" role="status">{refundMessage}</p>}
          <h3 className="h2">Recent recorded refunds</h3>
          <div className="tablewrap"><table><thead><tr><th>Date</th><th>Reader ID</th><th>Original reference</th><th>Paystack refund reference</th><th>Amount</th><th>Sparks reversed</th></tr></thead><tbody>
            {refundRows.map(row => <tr key={row.id}><td>{date(row.created_at)}</td><td><code>{row.reader_id}</code></td><td><code>{row.paystack_reference}</code></td><td><code>{row.paystack_refund_reference}</code></td><td>{naira(row.amount_kobo)}</td><td>{number(row.sparks_amount)}</td></tr>)}
            {!refundRows.length && <tr><td colSpan="6">No refunds recorded.</td></tr>}
          </tbody></table></div>
        </section>

        <SparksReconciliationPanel />
        <SparksMissingPaymentsPanel />

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
          <h2 className="h2">Manage withdrawal requests</h2>
          <p className="fine">Review, approve or reject requests. Mark a request paid only after you have manually sent the bank transfer. Approval checks and reserves available author earnings.</p>
          {actionError && <p className="msg-err" role="alert">{actionError}</p>}
          <div className="tablewrap"><table><thead><tr><th>Date</th><th>Author ID</th><th>Amount</th><th>Status</th><th>Note / transfer ref</th><th>Actions</th></tr></thead><tbody>
            {withdrawalRows.map(row => <tr key={row.id}>
              <td>{date(row.requested_at)}</td><td><code>{row.author_id}</code></td><td>{naira(row.amount_kobo)}</td><td>{row.status}</td><td>{row.admin_note || row.payout_reference || "—"}</td>
              <td><div className="row" style={{flexWrap:"wrap",gap:".35rem"}}>
                {row.status === "requested" && <button className="btn ghost small" disabled={actionId === row.id} onClick={() => manageWithdrawal(row,"start_review")}>Review</button>}
                {["requested","under_review"].includes(row.status) && <button className="btn small" disabled={actionId === row.id} onClick={() => manageWithdrawal(row,"approve")}>Approve</button>}
                {["requested","under_review","approved"].includes(row.status) && <button className="btn ghost small" disabled={actionId === row.id} onClick={() => manageWithdrawal(row,"reject")}>Reject</button>}
                {row.status === "approved" && <button className="btn small" disabled={actionId === row.id} onClick={() => manageWithdrawal(row,"mark_paid")}>Mark paid</button>}
                {actionId === row.id && <span className="fine">Saving…</span>}
              </div></td>
            </tr>)}
            {!withdrawalRows.length && <tr><td colSpan="6">No withdrawal requests yet.</td></tr>}
          </tbody></table></div>
        </section>
        <section className="stack">
          <h2 className="h2">Recent withdrawal requests</h2>
          <div className="tablewrap"><table><thead><tr><th>Requested</th><th>Author ID</th><th>Amount</th><th>Status</th><th>Paid</th></tr></thead><tbody>
            {(data.recent_withdrawals || []).map(row => <tr key={row.id}><td>{date(row.requested_at)}</td><td><code>{row.author_id}</code></td><td>{naira(row.amount_kobo)}</td><td>{row.status}</td><td>{date(row.paid_at)}</td></tr>)}
            {!data.recent_withdrawals?.length && <tr><td colSpan="5">No withdrawal requests recorded.</td></tr>}
          </tbody></table></div>
        </section>
        <p className="fine">Snapshot generated {date(data.generated_at)}. This page records admin decisions and manual payouts; it does not initiate bank transfers.</p>
      </>}
    </main>
  );
}

export default function AdminFinancePage() {
  return <Guard roles={['admin']}><FinancePanel /></Guard>;
}
