'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { friendlyAuth } from '@/lib/errors';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!configured) { setErr('Palixia is not connected to its database yet. See README.md.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr('Enter the email address you signed up with.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/reset-password',
    });
    setBusy(false);
    // Only real problems are shown. Whether the address has an account is never revealed.
    if (error && /rate limit|too many|failed to fetch|network/i.test(String(error.message))) { setErr(friendlyAuth(error)); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="stack authcol">
        <h1 className="h1">Check your email</h1>
        <p>If there is a Palixia account for <b>{email.trim()}</b>, we have sent a link to choose a new password. It can take a few minutes. Check your spam folder too.</p>
        <div><Link className="btn" href="/login">Back to log in</Link></div>
      </div>
    );
  }

  return (
    <div className="stack authcol">
      <h1 className="h1">Reset your password</h1>
      <p className="muted">Enter your email and we will send you a link to choose a new password.</p>
      <form className="card" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <p className="msg-err" role="alert">{err}</p>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</button>
      </form>
      <p className="muted"><Link className="linkbtn" href="/login">Back to log in</Link></p>
    </div>
  );
}
