'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';

const AGREEMENT_VERSION = '2026-10-30-v1';

function money(kobo) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format((Number(kobo) || 0) / 100);
}

function EarningsWallet() {
  const { user } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [schemaMissing, setSchemaMissing] = useState(false);

  async function load() {
    if (!user) return;
    setChecking(true);
    setError('');
    const agreement = await supabase.from('author_earnings_agreements')
      .select('id').eq('author_id', user.id).eq('agreement_version', AGREEMENT_VERSION).maybeSingle();
    if (agreement.error) {
      setSchemaMissing(agreement.error.code === '42P01' || agreement.error.code === 'PGRST205');
      setError('The wallet database setup is not complete yet. Please try again later.');
      setChecking(false);
      return;
    }
    const hasAccepted = Boolean(agreement.data);
    setAccepted(hasAccepted);
    if (hasAccepted) {
      const ledger = await supabase.from('author_wallet_ledger')
        .select('id,entry_type,status,amount_kobo,currency,reference,description,created_at')
        .eq('author_id', user.id).order('created_at', { ascending: false }).limit(100);
      if (ledger.error) setError('We could not load your wallet history. Please refresh.');
      else setEntries(ledger.data || []);
    }
    setChecking(false);
  }

  useEffect(() => { load(); }, [user]);

  async function acceptAgreement() {
    if (!agree || !user || saving) return;
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('author_earnings_agreements').insert({
      author_id: user.id,
      agreement_version: AGREEMENT_VERSION,
    });
    if (insertError && insertError.code !== '23505') {
      setError('We could not save your acceptance. Please try again.');
      setSaving(false);
      return;
    }
    setAccepted(true);
    setSaving(false);
    await load();
  }

  const totals = useMemo(() => {
    const sum = (status) => entries.filter((e) => e.status === status).reduce((n, e) => {
      const amount = Number(e.amount_kobo) || 0;
      if (e.entry_type === 'refund' || e.entry_type === 'chargeback' || e.entry_type === 'payout') return n - amount;
      return n + amount;
    }, 0);
    return { pending: sum('pending'), available: sum('available'), paid: entries.filter(e => e.status === 'paid' && e.entry_type === 'payout').reduce((n,e)=>n+Number(e.amount_kobo||0),0) };
  }, [entries]);

  if (checking) return <p className="muted">Loading your wallet...</p>;

  return (
    <div className="stack">
      <div><Link href="/dashboard" className="fine">← Back to dashboard</Link><h1 className="h1">Author wallet</h1></div>
      {error && <p className="notice" role="alert">{error}</p>}
      {schemaMissing && <p className="fine">The migration file is in the repository under supabase/migrations. It must be applied to the database before this feature can be used.</p>}
      {!accepted ? (
        <section className="card stack">
          <span className="badge">Author agreement required</span>
          <h2 className="h2">Author Earnings Agreement</h2>
          <p>Before using the Palixia author wallet, please review and accept these earnings terms.</p>
          <div className="legal">
            <h3>1. Tips and revenue share</h3>
            <p>When reader tipping is enabled, Palixia's planned share is 10% and the author's share is 90% of each successful tip. Any final treatment of payment-provider processing fees will be disclosed before tips go live.</p>
            <h3>2. Wallet balances</h3>
            <p>The wallet records eligible earnings and transaction adjustments. Pending amounts are not available for withdrawal. A displayed balance is an accounting record, not a bank account or a promise that funds can be withdrawn immediately.</p>
            <h3>3. Withdrawals</h3>
            <p>Withdrawals are not currently available. They will only be enabled after Palixia establishes and announces an approved payout process, including eligibility, minimum amounts, fees and processing times.</p>
            <h3>4. Refunds and disputes</h3>
            <p>Tips may be reversed, refunded or adjusted where a payment is disputed, reversed by the payment provider, fraudulent, or required to be refunded by law. Related wallet entries may be adjusted accordingly.</p>
            <h3>5. Account and content responsibilities</h3>
            <p>You must provide accurate account information, publish work you have the right to share, comply with Palixia's platform rules and applicable law, and keep your account secure. Suspected fraud or serious misuse may result in review or temporary restriction of wallet activity.</p>
            <h3>6. Taxes and records</h3>
            <p>You are responsible for understanding and meeting tax obligations that apply to you. Keep your own records of earnings and any relevant tax documents.</p>
            <h3>7. Changes and contact</h3>
            <p>Palixia may update these terms as the feature develops. Material changes will require renewed acceptance before continued wallet use. Questions can be sent to info@palixia.com.</p>
          </div>
          <label className="row" style={{alignItems:'flex-start',gap:'0.6rem'}}>
            <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} />
            <span>I have read and agree to the Author Earnings Agreement (version {AGREEMENT_VERSION}).</span>
          </label>
          <button className="btn" type="button" disabled={!agree || saving || schemaMissing} onClick={acceptAgreement}>{saving ? 'Saving...' : 'Accept and open wallet'}</button>
          <p className="fine">Your acceptance date and agreement version will be saved to your Palixia account. This is a working agreement and should receive legal review before payments launch.</p>
        </section>
      ) : (
        <>
          <section className="card stack">
            <div className="sechead"><h2 className="h2">Your earnings</h2><span className="badge">Withdrawals unavailable</span></div>
            <div className="stats">
              <div className="stat"><span className="mono">Pending</span><b>{money(totals.pending)}</b></div>
              <div className="stat"><span className="mono">Available balance</span><b>{money(totals.available)}</b></div>
              <div className="stat"><span className="mono">Total withdrawn</span><b>{money(totals.paid)}</b></div>
            </div>
            <p className="fine">No tips are being collected yet. Withdrawals will remain disabled until Palixia's payout arrangement is approved and ready.</p>
          </section>
          <section className="card">
            <h2 className="h2">Transaction history</h2>
            {entries.length === 0 ? <p className="muted">No wallet transactions yet. When tips are enabled, your earnings will appear here.</p> : (
              <div className="tablewrap"><table><thead><tr><th>Date</th><th>Description</th><th>Status</th><th className="num">Amount</th></tr></thead><tbody>
                {entries.map(e=><tr key={e.id}><td>{new Date(e.created_at).toLocaleDateString()}</td><td>{e.description || e.entry_type.replaceAll('_',' ')}</td><td><span className="badge">{e.status}</span></td><td className="num">{money(e.amount_kobo)}</td></tr>)}
              </tbody></table></div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function AuthorWalletPage() {
  return <Guard roles={['author','admin']}><EarningsWallet /></Guard>;
}
