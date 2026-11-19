'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

function money(kobo) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(Number(kobo || 0) / 100);
}

export default function SparksMissingPaymentsPanel() {
  const [days, setDays] = useState(7);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    setReport(null);
    const { data, error: sessionError } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (sessionError || !token) {
      setBusy(false);
      setError('Please sign in again to scan payments.');
      return;
    }
    try {
      const response = await fetch('/api/admin/sparks/missing-payments?days=' + days, {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) setError(payload?.error || 'Payment scan failed. Please try again.');
      else setReport(payload);
    } catch {
      setError('Could not reach the payment discovery service.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <h2 className="h2">Missing Paystack payments</h2>
      <p className="fine">Read-only scan for successful, verified Sparks payments that appear to have no matching Palixia purchase record. Nothing is credited, inserted, refunded, or changed by this scan.</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: '.6rem', alignItems: 'center' }}>
        <label className="fine" htmlFor="spark-missing-days">Period</label>
        <select id="spark-missing-days" className="in" style={{ width: 'auto' }} value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
        </select>
        <button className="btn small" type="button" onClick={run} disabled={busy}>{busy ? 'Scanning Paystack…' : 'Scan for missing payments'}</button>
      </div>
      {error && <p className="msg-err" role="alert">{error}</p>}
      {report && <>
        <div className="stats">
          <div className="stat"><span className="mono">Paystack transactions scanned</span><b>{Number(report.transactionsScanned || 0).toLocaleString('en-NG')}</b><span className="fine">{report.truncated ? 'Scan reached its page limit; older records may not be included.' : 'Date range scanned'}</span></div>
          <div className="stat"><span className="mono">Verified missing records</span><b>{Number(report.candidates || 0).toLocaleString('en-NG')}</b><span className="fine">Needs manual review</span></div>
        </div>
        <p className="fine">Scan completed {new Date(report.generatedAt).toLocaleString()}.</p>
        {report.rows.length > 0 ? <div className="tablewrap"><table><thead><tr><th>Paystack reference</th><th>Amount</th><th>Sparks</th><th>Paid</th></tr></thead><tbody>
          {report.rows.map(row => <tr key={row.reference}><td><code>{row.reference}</code></td><td>{money(row.amountKobo)}</td><td>{Number(row.sparks).toLocaleString('en-NG')}</td><td>{row.paidAt ? new Date(row.paidAt).toLocaleString() : '—'}</td></tr>)}
        </tbody></table></div> : <p className="fine">No verified missing Sparks payments found in the scanned period.</p>}
      </>}
    </section>
  );
}
