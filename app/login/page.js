'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, configured } from '@/lib/supabase';
import { friendlyAuth } from '@/lib/errors';
import { safeNext } from '@/lib/next';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'), '/');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!configured) { setErr('Palixa is not connected to its database yet. See README.md.'); return; }
    if (!email.trim() || !password) { setErr('Enter your email and password.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setErr(friendlyAuth(error)); return; }
    router.push(next);
  }

  return (
    <div className="stack narrow">
      <h1 className="h1">Log in</h1>
      <form className="card" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <p className="msg-err" role="alert">{err}</p>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p className="muted">New to Palixa? <Link className="linkbtn" href={'/signup' + (params.get('next') ? '?next=' + encodeURIComponent(next) : '')}>Create an account</Link></p>
    </div>
  );
}

export default function Login() {
  return <Suspense fallback={<p className="muted">Loading...</p>}><LoginForm /></Suspense>;
}
