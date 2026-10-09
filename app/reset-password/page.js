'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// The email link brings the person here already verified. Supabase signs them in for this one step,
// and they choose a new password.
export default function ResetPassword() {
  const { user, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkProblem, setLinkProblem] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    if (hash.get('error') || query.get('error')) setLinkProblem(true);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (password.length < 8) { setErr('Choose a password of at least 8 characters.'); return; }
    if (password !== again) { setErr('The two passwords do not match.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      const m = String(error.message || '');
      if (/same|different/i.test(m)) setErr('Choose a password you have not used before.');
      else if (/session|jwt|not authenticated/i.test(m)) setLinkProblem(true);
      else setErr('We could not change your password. Please try again.');
      return;
    }
    setDone(true);
  }

  if (loading) return <p className="muted">Loading...</p>;

  if (done) {
    return (
      <div className="stack authcol">
        <h1 className="h1">Password changed</h1>
        <p>Your new password is ready. You are signed in.</p>
        <div><Link className="btn" href="/">Continue to Palixia</Link></div>
      </div>
    );
  }

  if (!user || linkProblem) {
    return (
      <div className="stack authcol">
        <h1 className="h1">This link has expired</h1>
        <p>Reset links work once and stop working after a short time. Ask for a new one.</p>
        <div><Link className="btn" href="/forgot-password">Send a new link</Link></div>
      </div>
    );
  }

  return (
    <div className="stack authcol">
      <h1 className="h1">Choose a new password</h1>
      <form className="card" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="password">New password</label>
          <input id="password" className="in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <span className="fine">At least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="again">Type it again</label>
          <input id="again" className="in" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
        </div>
        <p className="msg-err" role="alert">{err}</p>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save new password'}</button>
      </form>
    </div>
  );
}
