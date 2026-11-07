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
    if (!bank || !/^\d{10}$/.test(accountNumber)) { setBankError('Choose a bank and enter a valid 10-digit account number.'); return; }
    setBankSaving(true); setBankError(''); setVerifiedBank(null);
    const sessionResult = await supabase.auth.getSession();
    const token = sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
    if (!token) { setBankError('Your session has expired. Please sign in again.'); setBankSaving(false); return; }
    try {
      const response = await fetch('/api/payout/verify-account', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ bankCode, bankName: bank.name, accountNumber }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not verify this account.');
      setVerifiedBank(payload); setSavedBank({ accountName: payload.accountName, bankName: payload.bankName, accountLast4: payload.accountLast4, verifiedAt: new Date().toISOString() }); setAccountNumber('');
    } catch (err) { setBankError(err.message); }
    finally { setBankSaving(false); }
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
    <div className="stack">
      <div>
        <Link href="/dashboard" className="fine">← Back to dashboard</Link>
        <h1 className="h1">Author earnings</h1>
        <p className="muted">Track reader support and your author earnings.</p>
      </div>
      <section className="stats">
        <div className="stat"><span className="mono">Pending</span><b>{naira(pending)}</b></div>
        <div className="stat"><span className="mono">Available</span><b>{naira(available)}</b></div>
        <div className="stat"><span className="mono">Paid</span><b>{naira(paid)}</b></div>
      </section>
      <section className="card stack">
        <div><h2 className="h2">Payout bank account</h2><p className="muted" style={{ margin: 0 }}>Choose your bank and verify your account name. Your account number is encrypted before storage. This does not enable withdrawals or transfers.</p></div>
        <label className="stack" style={{ gap: '.35rem' }}><span className="fine">Bank</span>
          <select className="in" value={bankCode} onChange={(event) => { setBankCode(event.target.value); setVerifiedBank(null); }} disabled={bankLoading}>
            <option value="">{bankLoading ? 'Loading banks…' : 'Select your bank'}</option>
            {banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
          </select>
        </label>
        <label className="stack" style={{ gap: '.35rem' }}><span className="fine">10-digit account number</span>
          <input className="in" inputMode="numeric" autoComplete="off" maxLength={10} value={accountNumber} onChange={(event) => { setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 10)); setVerifiedBank(null); }} placeholder="Enter account number" />
        </label>
        {bankError && <p className="msg-err" role="alert">{bankError}</p>}
        {savedBankLoading && <p className="fine" role="status">Checking for your saved bank account…</p>}
        {savedBankError && <div className="stack" style={{ gap: '.35rem' }}><p className="msg-err" role="alert">{savedBankError}</p><button className="btn ghost small" type="button" onClick={loadSavedBank}>Try loading bank details again</button></div>}
        {verifiedBank && <div className="card" style={{ background: 'var(--soft, #f7f2ff)' }}><b>✓ Account verified</b><p style={{ margin: '.35rem 0 0' }}>{verifiedBank.accountName}</p><span className="fine">{verifiedBank.bankName} · •••• {verifiedBank.accountLast4}</span></div>}
        {savedBank && !verifiedBank && <div className="card" style={{ background: 'var(--soft, #f7f2ff)' }}><b>✓ Verified payout account saved</b><p style={{ margin: '.35rem 0 0' }}>{savedBank.accountName}</p><span className="fine">{savedBank.bankName} · •••• {savedBank.accountLast4}</span><p className="fine" style={{ marginBottom: 0 }}>Verified {new Date(savedBank.verifiedAt).toLocaleDateString()}</p></div>}
        <button className="btn" type="button" disabled={bankLoading || bankSaving || !bankCode || accountNumber.length !== 10} onClick={verifyAndSaveBank}>{bankSaving ? 'Verifying…' : 'Verify and save bank account'}</button>
      </section>
      <section className="card stack" style={{ borderColor: 'var(--accent, #7042a5)', background: 'var(--soft, #f7f2ff)' }}>
        <div className="sechead">
          <h2 className="h2">Sparks are in pre-launch</h2>
          <span className="badge">Coming soon</span>
        </div>
        <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>
          We are currently onboarding authors and building our active reader community. Payout policies and supported payout methods will be announced before launch. We are preparing Paystack support first; any additional provider, including Flutterwave, will be confirmed before it is offered. No automated payouts or withdrawals are available yet.
        </p>
      </section>
      <section className="card stack" style={{ borderColor: 'var(--accent, #7042a5)' }}>
        <div>
          <h2 className="h2" style={{ marginBottom: '.35rem' }}>Get Ready for Sparks!</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Copy your unique story invite link to share on WhatsApp, Twitter, and Instagram so your fans can find your story and be ready to support you when Sparks launches.
          </p>
        </div>
        {stories.length === 0 ? (
          <p className="fine" style={{ margin: 0 }}>Publish a story to create its shareable invite link.</p>
        ) : (
          <>
            <label className="stack" style={{ gap: '.35rem' }}>
              <span className="fine">Choose a published story</span>
              <select className="in" value={selectedStoryId} onChange={(event) => { setSelectedStoryId(event.target.value); setCopyMessage(''); }}>
                {stories.map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}
              </select>
            </label>
            {selectedStoryId && (
              <p className="fine" style={{ margin: 0, overflowWrap: 'anywhere' }}>
                {typeof window !== 'undefined' ? window.location.origin : 'https://www.palixia.com'}/book/{selectedStoryId}
              </p>
            )}
            <div className="row">
              <button className="btn" type="button" disabled={!selectedStoryId} onClick={copyStoryInviteLink}>Copy story invite link</button>
            </div>
            {copyMessage && <p className="fine" role="status" aria-live="polite" style={{ margin: 0 }}>{copyMessage}</p>}
          </>
        )}
      </section>
      {!agreementLoading && !agreementAccepted && (
        <section className="card stack">
          <h2 className="h2">Set up Sparks earnings</h2>
          <p>Before readers can send you Sparks, please review and accept the updated earnings split:</p>
          <ul className="fine" style={{ paddingLeft: '1.25rem' }}>
            <li>You receive 90% of the value of each new Spark tip.</li>
            <li>Palixia retains 10% to support platform operations.</li>
            <li>Your 90% author share is recorded as pending until Palixia publishes and enables its payout policy.</li>
            <li>Pending credits cannot be withdrawn, transferred or treated as a guaranteed payment.</li>
            <li>Any future withdrawal will be subject to published payout rules, verification and applicable fees.</li>
            <li>This updated agreement applies to new tips after acceptance. Earlier ledger entries are not changed.</li>
          </ul>
          <label className="row" style={{ alignItems: 'flex-start', gap: '0.55rem' }}>
            <input type="checkbox" checked={agreementConfirmed} onChange={(event) => setAgreementConfirmed(event.target.checked)} />
            <span className="fine">I have read and agree to the updated 90/10 Sparks earnings terms.</span>
          </label>
          {agreementError && <p className="msg-err" role="alert">{agreementError}</p>}
          <button className="btn" type="button" disabled={!agreementConfirmed || accepting} onClick={acceptAgreement}>{accepting ? 'Saving…' : 'Accept and enable author support'}</button>
        </section>
      )}
      {agreementAccepted && <p className="fine">Updated 90/10 Sparks terms accepted. You receive 90% of new tip value; Palixia retains 10%. Author credits remain pending until the payout policy is enabled.</p>}
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
      <section className="card stack" style={{ borderColor: 'var(--border, #ddd)' }}>
        <div className="sechead"><h2 className="h2">Withdrawals are not open yet</h2><span className="badge">Coming soon</span></div>
        <p className="muted" style={{ margin: 0, lineHeight: 1.65 }}>Your author share is safely recorded as pending while Palixia finalises its payout policy. You can view your earnings activity below, but withdrawal requests are currently disabled. We will announce the payout rules and open requests when the system is ready. Saving a bank account now only prepares your details; it does not trigger a transfer.</p>
      </section>
      <section className="card stack">
        <h2 className="h2">Withdrawal requests</h2>
        {loading ? <p className="muted">Loading requests…</p> : requests.length === 0 ? (
          <p className="empty">No withdrawal requests yet.</p>
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

    </div>
  );
}

export default function AuthorWalletPage() {
  return <Guard roles={['author','admin']}><EarningsWallet /></Guard>;
}
