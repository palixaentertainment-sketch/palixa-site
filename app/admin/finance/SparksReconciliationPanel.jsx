'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

function money(kobo) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(Number(kobo || 0) / 100);
}
function number(value) { return Number(value || 0).toLocaleString('en-NG'); }

export default function SparksReconciliationPanel() {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    const { data, error: sessionError } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (sessionError || !token) {
      setBusy(false);
      setError('Please sign in again to run reconciliation.');
      return;
    }
    try {
      const response = await fetch('/api/admin/sparks/reconciliation?days=' + days, {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        setError(payload?.error || 'Reconciliation failed. Please try again.');
        setReport(null);
      } else {
        setReport(payload);
      }
    } catch {
      setError('Could not reach the reconciliation service.');
      setReport(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <h2 className="h2">Payment reconciliation</h2>
      <p className="fine">Read-only comparison of Palixia purchases against Paystack verification. This report does not credit wallets, issue refunds, or change transaction statuses.</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: '.6rem', alignItems: 'center' }}>
        <label className="fine" htmlFor="spark-recon-days">Period</label>
        <select id="spark-recon-days" className="in" style={{ width: 'auto' }} value={days} onChange={event => setDays(Number(event.target.value))}>
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
        <button className="btn small" type="button" onClick={run} disabled={busy}>{busy ? 'Checking Paystack…' : 'Run reconciliation'}</button>
      </div>
      {error && <p className="msg-err" role="alert">{error}</p>}
      {report && <>
        <div className="stats">
          <div className="stat"><span className="mono">Transactions checked</span><b>{number(report.total)}</b><span className="fine">{report.truncated ? 'Limited to 100 newest records' : 'Selected date range'}</span></div>
          {Object.entries(report.counts || {}).map(([key, value]) => <div className="stat" key={key}><span className="mono">{key.replaceAll('_', ' ')}</span><b>{number(value)}</b></div>)}
        </div>
        <p className="fine">Report created {new Date(report.generatedAt).toLocaleString()}</p>
        <div className="tablewrap"><table><thead><tr><th>Reference</th><th>Amount</th><th>Sparks</th><th>Paystack</th><th>Palixia</th><th>Credits</th><th>Result</th></tr></thead><tbody>
          {report.rows.map(row => <tr key={row.purchaseId}><td><code>{row.reference}</code></td><td>{money(row.amountKobo)}</td><td>{number(row.sparks)}</td><td>{row.paystackStatus}</td><td>{row.purchaseStatus}</td><td>{number(row.ledgerCredits)} ({number(row.ledgerCreditSparks)})</td><td>{row.reconciliationStatus.replaceAll('_', ' ')}</td></tr>)}
          {!report.rows.length && <tr><td colSpan="7">No purchases in this date range.</td></tr>}
        </tbody></table></div>
      </>}
    </section>
  );
}
