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
  const [recovering, setRecovering] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function sessionToken() {
    const { data, error: sessionError } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (sessionError || !token) throw new Error('Please sign in again.');
    return token;
  }

  async function run() {
    setBusy(true);
    setError('');
    setNotice('');
    setReport(null);
    try {
      const token = await sessionToken();
      const response = await fetch('/api/admin/sparks/missing-payments?days=' + days, {
        headers: { Authorization: 'Bearer ' + token }, cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new Error(payload?.error || 'Payment scan failed. Please try again.');
      setReport(payload);
    } catch (e) {
      setError(e.message || 'Could not reach the payment discovery service.');
    } finally { setBusy(false); }
  }

  async function recover(reference) {
    if (!window.confirm('Recover this purchase? Paystack will be re-verified and the buyer’s Sparks will be credited once.')) return;
    setRecovering(reference);
    setError('');
    setNotice('');
    try {
      const token = await sessionToken();
      const response = await fetch('/api/admin/sparks/missing-payments/recover', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Recovery failed.');
      setNotice('Recovered ' + Number(payload.sparks_amount).toLocaleString('en-NG') + ' Sparks for ' + reference + '.');
      await run();
    } catch (e) {
      setError(e.message || 'Recovery could not be completed.');
    } finally { setRecovering(''); }
  }

  return (
    <section className="stack">
      <h2 className="h2">Missing Paystack payments</h2>
      <p className="fine">Scan for successful, independently verified Sparks payments with no purchase record or a failed purchase record. Scanning is read-only. Recovery re-verifies Paystack and credits the verified buyer exactly once.</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: '.6rem', alignItems: 'center' }}>
        <label className="fine" htmlFor="spark-missing-days">Period</label>
        <select id="spark-missing-days" className="in" style={{ width: 'auto' }} value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option>
        </select>
        <button className="btn small" type="button" onClick={run} disabled={busy || Boolean(recovering)}>{busy ? 'Scanning Paystack…' : 'Scan for missing payments'}</button>
      </div>
      {error && <p className="msg-err" role="alert">{error}</p>}
      {notice && <p className="fine" role="status">{notice}</p>}
      {report && <>
        <div className="stats">
          <div className="stat"><span className="mono">Paystack transactions scanned</span><b>{Number(report.transactionsScanned || 0).toLocaleString('en-NG')}</b><span className="fine">{report.truncated ? 'Scan reached its page limit; older records may not be included.' : 'Date range scanned'}</span></div>
          <div className="stat"><span className="mono">Recoverable records</span><b>{Number(report.candidates || 0).toLocaleString('en-NG')}</b><span className="fine">Review before recovering</span></div>
        </div>
        <p className="fine">Scan completed {new Date(report.generatedAt).toLocaleString()}.</p>
        {report.rows.length > 0 ? <div className="tablewrap"><table><thead><tr><th>Paystack reference</th><th>Record</th><th>Amount</th><th>Sparks</th><th>Paid</th><th>Action</th></tr></thead><tbody>
          {report.rows.map(row => <tr key={row.reference}><td><code>{row.reference}</code></td><td>{row.recordStatus === 'failed' ? 'Failed record' : 'Missing record'}</td><td>{money(row.amountKobo)}</td><td>{Number(row.sparks).toLocaleString('en-NG')}</td><td>{row.paidAt ? new Date(row.paidAt).toLocaleString() : '—'}</td><td><button className="btn small" type="button" disabled={busy || Boolean(recovering)} onClick={() => recover(row.reference)}>{recovering === row.reference ? 'Recovering…' : 'Recover'}</button></td></tr>)}
        </tbody></table></div> : <p className="fine">No verified missing Sparks payments found in the scanned period.</p>}
      </>}
    </section>
  );
}
