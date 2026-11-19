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
  const [stories, setStories] = useState([]);
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [banks, setBanks] = useState([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankLoading, setBankLoading] = useState(true);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState('');
  const [verifiedBank, setVerifiedBank] = useState(null);
  const [bankOwnershipConfirmed, setBankOwnershipConfirmed] = useState(false);
  const [savedBank, setSavedBank] = useState(null);
  const [savedBankLoading, setSavedBankLoading] = useState(true);
  const [savedBankError, setSavedBankError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    const [ledger, withdrawals, agreement, storiesResult] = await Promise.all([
      supabase.from('author_wallet_ledger')
        .select('id,entry_type,status,amount_kobo,currency,description,created_at,reference')
        .eq('author_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('author_withdrawal_requests')
        .select('id,amount_kobo,currency,status,requested_at,reviewed_at,paid_at,admin_note')
        .eq('author_id', user.id).order('requested_at', { ascending: false }).limit(20),
      supabase.from('author_earnings_agreements').select('id').eq('author_id', user.id).eq('agreement_version', 'sparks-v3-monthly-payouts').maybeSingle(),
      supabase.from('books').select('id,title').eq('author_id', user.id).eq('status', 'published').order('updated_at', { ascending: false }),
    ]);
    setAgreementLoading(false);
    if (!agreement.error) setAgreementAccepted(Boolean(agreement.data));
    if (!storiesResult.error) {
      const publishedStories = storiesResult.data || [];
      setStories(publishedStories);
      setSelectedStoryId((current) => current && publishedStories.some((story) => story.id === current) ? current : (publishedStories[0]?.id || ''));
    }
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

  const loadSavedBank = useCallback(async () => {
    if (!user) {
      setSavedBankLoading(false);
      return;
    }
    setSavedBankLoading(true);
    setSavedBankError('');
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (sessionError || !token) {
        setSavedBankError('Your sign-in session is not ready. Please refresh or sign in again.');
        return;
      }
      const response = await fetch('/api/payout/saved-account', {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Saved bank details could not be loaded.');
      setSavedBank(payload.account || null);
    } catch (err) {
      console.error('[Payout account] Could not load saved account:', err);
      setSavedBankError(err.message || 'Saved bank details could not be loaded. Please try again.');
    } finally {
      setSavedBankLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    loadSavedBank();
    fetch('/api/payout/banks', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not load banks.');
        if (active) setBanks(payload.banks || []);
      })
      .catch((err) => { if (active) setBankError(err.message); })
      .finally(() => { if (active) setBankLoading(false); });
    return () => { active = false; };
  }, [loadSavedBank]);

  async function verifyAndSaveBank() {
    const bank = banks.find((item) => item.code === bankCode);
    if (!bank || !/^\d{10}$/.test(accountNumber)) {
      setBankError('Choose a bank and enter a valid 10-digit account number.');
      return;
    }
    setBankSaving(true);
    setBankError('');
    setVerifiedBank(null);
    setBankOwnershipConfirmed(false);
    const sessionResult = await supabase.auth.getSession();
    const token = sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
    if (!token) {
      setBankError('Your session has expired. Please sign in again.');
      setBankSaving(false);
      return;
    }
    try {
      const response = await fetch('/api/payout/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ bankCode, accountNumber }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not verify this account.');
      setVerifiedBank({ ...payload, bankName: bank.name });
    } catch (err) {
      setBankError(err.message);
    } finally {
      setBankSaving(false);
    }
  }

  async function confirmAndSaveBank() {
    if (!verifiedBank || !bankOwnershipConfirmed) return;
    setBankSaving(true);
    setBankError('');
    const sessionResult = await supabase.auth.getSession();
    const token = sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
    if (!token) {
      setBankError('Your session has expired. Please sign in again.');
      setBankSaving(false);
      return;
    }
    try {
      const response = await fetch('/api/payout/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'save', confirmAccountOwnership: true, bankCode, accountNumber }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save this account.');
      setSavedBank({ accountName: payload.accountName, bankName: payload.bankName, accountLast4: payload.accountLast4, verifiedAt: new Date().toISOString() });
      setVerifiedBank(null);
      setBankOwnershipConfirmed(false);
      setAccountNumber('');
    } catch (err) {
      setBankError(err.message);
    } finally {
      setBankSaving(false);
    }
  }

  async function copyStoryInviteLink() {
    if (!selectedStoryId) return;
    const url = window.location.origin + '/book/' + selectedStoryId;
    setCopyMessage('');
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage('Your story link has been copied. Share it with your readers.');
    } catch {
      setCopyMessage('Copying is unavailable in this browser. You can copy the story link shown above.');
    }
  }

  async function acceptAgreement() {
    if (!user || !agreementConfirmed) return;
    setAccepting(true);
    setAgreementError('');
    const { error: insertError } = await supabase.from('author_earnings_agreements').insert({ author_id: user.id, agreement_version: 'sparks-v3-monthly-payouts' });
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
  const paidOut = entries.filter((entry) => entry.entry_type === 'payout' && entry.status === 'paid').reduce((sum, entry) => sum + Number(entry.amount_kobo || 0), 0);
  const reserved = requests.filter((request) => ['requested','under_review','approved'].includes(request.status)).reduce((sum, request) => sum + Number(request.amount_kobo || 0), 0);
  const available = Math.max(0, total('available') - paidOut - reserved);
  const paid = entries.filter((entry) => entry.status === 'paid' && entry.entry_type === 'payout')
    .reduce((sum, entry) => sum + Number(entry.amount_kobo || 0), 0);

  return (
    <div className="wallet-page stack">
      <style jsx>{`
        .wallet-page { gap: 1.35rem; }
        .wallet-head { display:flex; align-items:flex-end; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .wallet-kicker { color:var(--accent); font-size:.75rem; font-weight:800; letter-spacing:.13em; text-transform:uppercase; margin-bottom:.45rem; }
        .balance-card { position:relative; overflow:hidden; color:#fff; border-radius:18px; padding:1.45rem; background:linear-gradient(125deg,#24104f 0%,#51218e 54%,#7540c5 100%); box-shadow:0 16px 36px -24px rgba(46,16,101,.7); }
        .balance-card:before,.balance-card:after { content:""; position:absolute; border:1px solid rgba(255,255,255,.13); border-radius:50%; pointer-events:none; }
        .balance-card:before { width:17rem;height:17rem;right:-5rem;top:-10rem; }
        .balance-card:after { width:12rem;height:12rem;right:2rem;bottom:-9rem; }
        .balance-inner { position:relative;z-index:1;display:grid;gap:1.25rem; }
        .balance-top { display:flex;justify-content:space-between;align-items:center;gap:1rem; }
        .balance-label { color:rgba(255,255,255,.78);font-size:.88rem; }
        .balance-value { font-size:clamp(2rem,7vw,3rem);font-weight:850;letter-spacing:-.045em;line-height:1.1;margin-top:.35rem;overflow-wrap:anywhere; }
        .balance-note { color:rgba(255,255,255,.72);font-size:.82rem;margin-top:.45rem; }
        .wallet-mark { width:2.6rem;height:2.6rem;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);border-radius:12px;display:grid;place-items:center;font-size:1.2rem; }
        .balance-actions { display:flex;gap:.65rem;flex-wrap:wrap; }
        .balance-actions .btn { background:#fff;color:#32105f;border-radius:9px; }
        .balance-actions .btn.ghost { color:#fff;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.32); }
        .wallet-metrics { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem; }
        .metric { min-width:0;padding:1rem;border:1px solid var(--line);border-radius:12px;background:#fff; }
        .metric-label { display:block;color:var(--muted);font-size:.78rem;margin-bottom:.45rem; }
        .metric-value { display:block;font-weight:800;font-size:clamp(1rem,3.5vw,1.35rem);overflow-wrap:anywhere; }
        .metric-dot { display:inline-block;width:.48rem;height:.48rem;border-radius:50%;background:#9b7ad7;margin-right:.4rem;vertical-align:middle; }
        .wallet-card { background:#fff;border:1px solid var(--line);border-radius:14px;padding:1.15rem;display:grid;gap:1rem; }
        .wallet-card.soft { background:var(--surface); }
        .wallet-section-title { display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap; }
        .activity-row { display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:.85rem 0;border-bottom:1px solid var(--line); }
        .activity-row:last-child { border-bottom:0;padding-bottom:0; }
        .activity-icon { flex:none;width:2.35rem;height:2.35rem;border-radius:10px;background:var(--soft);color:var(--accent);display:grid;place-items:center;font-weight:800; }
        .activity-copy { min-width:0;display:flex;flex-direction:column;gap:.15rem; }
        .activity-copy b { overflow-wrap:anywhere;font-size:.92rem; }
        .activity-amount { text-align:right;white-space:nowrap;font-weight:800;font-size:.92rem; }
        .info-banner { border:1px solid #ded0f7;background:linear-gradient(120deg,#f8f4ff,#fff);border-radius:14px;padding:1.1rem; }
        .info-banner p { color:var(--muted);line-height:1.65;margin-top:.4rem; }
        .wallet-form-grid { display:grid;gap:.85rem; }
        .terms-list { padding-left:1.2rem;list-style:disc;display:grid;gap:.5rem; }
        .terms-list li { padding-left:.15rem; }
        @media(min-width:700px) {
          .balance-card { padding:1.8rem 2rem; }
          .balance-inner { grid-template-columns:minmax(0,1fr) auto;align-items:end; }
          .balance-actions { justify-content:flex-end; }
          .wallet-card { padding:1.4rem; }
          .wallet-form-grid { grid-template-columns:1fr 1fr; }
        }
        @media(max-width:430px) {
          .wallet-metrics { grid-template-columns:1fr; }
          .metric { display:flex;justify-content:space-between;align-items:center;gap:.7rem;padding:.85rem 1rem; }
          .metric-label { margin:0; }
        }
      `}</style>

      <div className="wallet-head">
        <div>
          <Link href="/dashboard" className="fine">← Back to dashboard</Link>
          <p className="wallet-kicker" style={{marginTop:'.8rem'}}>Palixia · Author space</p>
          <h1 className="h1">Your earnings</h1>
          <p className="muted" style={{marginTop:'.4rem'}}>A clear view of the support your stories receive.</p>
        </div>
        <span className="badge">Sparks · Coming soon</span>
      </div>

      <section className="balance-card" aria-label="Wallet balance overview">
        <div className="balance-inner">
          <div>
            <div className="balance-top">
              <span className="balance-label">Available to withdraw</span>
              <span className="wallet-mark" aria-hidden="true">✦</span>
            </div>
            <div className="balance-value">{naira(available)}</div>
            <p className="balance-note">Your available author balance · withdrawals are not open yet</p>
          </div>
          <div className="balance-actions">
            <button className="btn" type="button" disabled>Withdraw funds · Coming soon</button>
            <a className="btn ghost" href="#earnings-activity">View activity ↓</a>
          </div>
        </div>
      </section>

      <section className="wallet-metrics" aria-label="Earnings summary">
        <div className="metric"><span className="metric-label"><span className="metric-dot" />Pending earnings</span><b className="metric-value">{naira(pending)}</b></div>
        <div className="metric"><span className="metric-label"><span className="metric-dot" style={{background:'#6d28d9'}} />Available balance</span><b className="metric-value">{naira(available)}</b></div>
        <div className="metric"><span className="metric-label"><span className="metric-dot" style={{background:'#15945a'}} />Paid out</span><b className="metric-value">{naira(paid)}</b></div>
      </section>

      <section className="info-banner">
        <div className="wallet-section-title"><b>Reader support is coming to Palixia</b><span className="badge">90% to authors</span></div>
        <p>With Sparks, readers will be able to support the authors whose stories they enjoy. Authors receive 90% of eligible support, while Palixia retains 10%. Public tipping and withdrawals remain closed until launch is announced.</p>
      </section>

      <section className="wallet-card">
        <div>
          <h2 className="h2">Payout bank account</h2>
          <p className="muted" style={{marginTop:'.35rem'}}>Prepare your payout details securely before Sparks launches.</p>
        </div>
        <p className="fine">Choose your bank and verify your account name. Your account number is encrypted before storage. Saving these details does not enable withdrawals or initiate a transfer.</p>
        <div className="wallet-form-grid">
          <label className="stack" style={{gap:'.35rem'}}><span className="fine">Bank</span>
            <select className="in" value={bankCode} onChange={(event) => { setBankCode(event.target.value); setVerifiedBank(null); setBankOwnershipConfirmed(false); }} disabled={bankLoading}>
              <option value="">{bankLoading ? 'Loading banks…' : 'Select your bank'}</option>
              {banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
            </select>
          </label>
          <label className="stack" style={{gap:'.35rem'}}><span className="fine">10-digit account number</span>
            <input className="in" inputMode="numeric" autoComplete="off" maxLength={10} value={accountNumber} onChange={(event) => { setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 10)); setVerifiedBank(null); setBankOwnershipConfirmed(false); }} placeholder="Enter account number" />
          </label>
        </div>
        {bankError && <p className="msg-err" role="alert">{bankError}</p>}
        {savedBankLoading && <p className="fine" role="status">Checking for your saved bank account…</p>}
        {savedBankError && <div className="stack" style={{gap:'.35rem'}}><p className="msg-err" role="alert">{savedBankError}</p><button className="btn ghost small" type="button" onClick={loadSavedBank}>Try loading bank details again</button></div>}
        {verifiedBank && <div className="wallet-card soft">
          <div><b>Paystack found this account name</b><p style={{margin:'.35rem 0 0'}}>{verifiedBank.accountName}</p><span className="fine">{verifiedBank.bankName} · account ending in {accountNumber.slice(-4)}</span></div>
          <label className="row" style={{alignItems:'flex-start',gap:'.55rem'}}><input type="checkbox" checked={bankOwnershipConfirmed} onChange={(event) => setBankOwnershipConfirmed(event.target.checked)} /><span className="fine">I confirm that this bank account belongs to me and that the account name shown above is correct.</span></label>
          <button className="btn" type="button" disabled={!bankOwnershipConfirmed || bankSaving} onClick={confirmAndSaveBank}>{bankSaving ? 'Saving securely…' : 'Confirm and save account'}</button>
        </div>}
        {savedBank && !verifiedBank && <div className="wallet-card soft"><b>✓ Verified payout account saved</b><p style={{margin:0}}>{savedBank.accountName}</p><span className="fine">{savedBank.bankName} · •••• {savedBank.accountLast4}</span><p className="fine">Verified {new Date(savedBank.verifiedAt).toLocaleDateString()}</p></div>}
        <div className="row">
          <button className="btn" type="button" disabled={bankLoading || bankSaving || !bankCode || accountNumber.length !== 10 || Boolean(verifiedBank)} onClick={verifyAndSaveBank}>{bankSaving ? 'Verifying…' : 'Verify account name'}</button>
        </div>
      </section>

      <section className="wallet-card soft">
        <div className="wallet-section-title"><h2 className="h2">Get ready for Sparks</h2><span className="badge">Coming soon</span></div>
        <p className="muted">Help readers find your work now. Share a direct link to a published story so your audience can discover it and be ready to support you when Sparks launches.</p>
        {stories.length === 0 ? <p className="fine">Publish a story to create its shareable invite link.</p> : <>
          <label className="stack" style={{gap:'.35rem'}}><span className="fine">Choose a published story</span>
            <select className="in" value={selectedStoryId} onChange={(event) => { setSelectedStoryId(event.target.value); setCopyMessage(''); }}>
              {stories.map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}
            </select>
          </label>
          {selectedStoryId && <p className="fine" style={{overflowWrap:'anywhere'}}>{typeof window !== 'undefined' ? window.location.origin : 'https://www.palixia.com'}/book/{selectedStoryId}</p>}
          <div className="row"><button className="btn" type="button" disabled={!selectedStoryId} onClick={copyStoryInviteLink}>Copy story link</button></div>
          {copyMessage && <p className="fine" role="status" aria-live="polite">{copyMessage}</p>}
        </>}
      </section>

      {!agreementLoading && !agreementAccepted && <section className="wallet-card">
        <div><h2 className="h2">Sparks author agreement</h2><p className="muted" style={{marginTop:'.35rem'}}>Review the planned earnings and payout terms before accepting.</p></div>
        <ul className="fine terms-list">
          <li>You receive 90% of the eligible value of each Spark tip; Palixia retains 10%.</li>
          <li>Your author share is recorded in your Palixia earnings ledger and remains pending until released under the payout process.</li>
          <li>The planned payout cycle is monthly, during the first week of each month.</li>
          <li>The planned minimum withdrawal is ₦1,000. A verified Nigerian bank account in your name will be required.</li>
          <li>Initial payouts are planned by manual bank transfer. Saving or verifying bank details does not initiate a transfer.</li>
          <li>Withdrawals are not currently open. These are planned terms only; no payout date is promised until Palixia formally announces that withdrawals are available.</li>
          <li>Pending earnings cannot be withdrawn or transferred. Accepting this agreement does not change earlier ledger entries.</li>
          <li>Palixia may verify earnings and account details before approving a payout. Any applicable fees or final operational conditions will be disclosed before withdrawals open.</li>
        </ul>
        <label className="row" style={{alignItems:'flex-start',gap:'.55rem'}}><input type="checkbox" checked={agreementConfirmed} onChange={(event) => setAgreementConfirmed(event.target.checked)} /><span className="fine">I have read and agree to the Sparks earnings split and planned monthly payout terms.</span></label>
        {agreementError && <p className="msg-err" role="alert">{agreementError}</p>}
        <button className="btn" type="button" disabled={!agreementConfirmed || accepting} onClick={acceptAgreement}>{accepting ? 'Saving…' : 'Accept Sparks terms'}</button>
      </section>}
      {agreementAccepted && <p className="fine">Sparks author terms accepted. You receive 90% of eligible tip value; Palixia retains 10%. Withdrawals and public tipping remain closed until Palixia announces their launch.</p>}

      {error && <p className="msg-err" role="alert">{error}</p>}
      <section className="wallet-card" id="earnings-activity">
        <div className="wallet-section-title"><div><h2 className="h2">Earnings activity</h2><p className="muted" style={{marginTop:'.3rem'}}>A record of support and wallet movements.</p></div><button className="btn ghost small" type="button" onClick={load}>Refresh</button></div>
        {loading ? <p className="muted">Loading wallet…</p> : entries.length === 0 ? <p className="muted">You don't have any earnings yet. When readers support your stories, activity will appear here.</p> : <div>
          {entries.map((entry) => <div className="activity-row" key={entry.id}>
            <span className="activity-icon" aria-hidden="true">{entry.entry_type === 'tip_credit' ? '✦' : '↗'}</span>
            <div className="activity-copy"><b>{entry.description || (entry.entry_type === 'tip_credit' ? 'Reader support' : 'Wallet adjustment')}</b><span className="fine">{new Date(entry.created_at).toLocaleString()} · {entry.status}</span></div>
            <b className="activity-amount">{naira(entry.amount_kobo)}</b>
          </div>)}
        </div>}
      </section>

      <section className="wallet-card soft">
        <div className="wallet-section-title"><h2 className="h2">Withdrawal requests</h2><span className="badge">Not open yet</span></div>
        <p className="muted">Withdrawal requests will become available when Palixia officially launches author payouts.</p>
        {loading ? <p className="fine">Loading requests…</p> : requests.length === 0 ? <p className="fine">No withdrawal requests yet.</p> : requests.map((request) => <div className="activity-row" key={request.id}>
          <div className="activity-copy"><b>{naira(request.amount_kobo)}</b><span className="fine">{new Date(request.requested_at).toLocaleDateString()} · {request.status.replaceAll('_', ' ')}</span>{request.admin_note && <span className="fine">{request.admin_note}</span>}</div>
        </div>)}
      </section>
    </div>

}

export default function AuthorWalletPage() {
  return <Guard roles={['author','admin']}><EarningsWallet /></Guard>;
}
