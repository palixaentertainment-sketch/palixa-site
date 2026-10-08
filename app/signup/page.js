'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, configured } from '@/lib/supabase';
import { friendlyAuth } from '@/lib/errors';
import { validUsername } from '@/lib/format';
import { safeNext } from '@/lib/next';

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [kind, setKind] = useState(params.get('as') === 'author' ? 'author' : 'reader');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!configured) { setErr('Palixa is not connected to its database yet. See README.md.'); return; }
    const u = username.trim().toLowerCase();
    if (!name.trim()) { setErr('Enter your full name.'); return; }
    if (!validUsername(u)) { setErr('Choose a username of 3 to 24 letters, numbers or underscores.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr('Enter a valid email address.'); return; }
    if (password.length < 8) { setErr('Choose a password of at least 8 characters.'); return; }
    if (kind === 'author' && !bio.trim()) { setErr('Add a short bio so readers know who you are.'); return; }
    setBusy(true);
    const { data: taken } = await supabase.from('profiles').select('id').eq('username', u).maybeSingle();
    if (taken) { setBusy(false); setErr('That username is taken. Try another.'); return; }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim(), username: u, account: kind, bio: bio.trim(), country: country.trim() } },
    });
    setBusy(false);
    if (error) { setErr(friendlyAuth(error)); return; }
    if (data.session) router.push(safeNext(params.get('next'), kind === 'author' ? '/dashboard' : '/discover'));
    else setDone(true);
  }

  if (done) {
    return (
      <div className="stack narrow">
        <h1 className="h1">Check your email</h1>
        <p>We sent a confirmation link to <b>{email}</b>. Open it, then log in to finish setting up your account.</p>
        <div><Link className="btn" href="/login">Log in</Link></div>
      </div>
    );
  }

  return (
    <div className="stack narrow">
      <h1 className="h1">Create your account</h1>
      <form className="card" onSubmit={submit} noValidate>
        <div className="field">
          <span className="lab" id="lab-kind">I want to</span>
          <div className="seg" role="radiogroup" aria-labelledby="lab-kind">
            <input type="radio" name="kind" id="k-reader" checked={kind === 'reader'} onChange={() => setKind('reader')} /><label htmlFor="k-reader">Read</label>
            <input type="radio" name="kind" id="k-author" checked={kind === 'author'} onChange={() => setKind('author')} /><label htmlFor="k-author">Publish</label>
          </div>
        </div>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" className="in" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" className="in" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} autoComplete="username" autoCapitalize="none" />
          <span className="fine">Letters, numbers and underscores. This becomes your page address.</span>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" className="in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <span className="fine">At least 8 characters.</span>
        </div>
        {kind === 'author' && (
          <>
            <div className="field">
              <label htmlFor="bio">Short bio</label>
              <textarea id="bio" className="in" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} placeholder="Who are you and what do you write?" />
            </div>
            <div className="field">
              <label htmlFor="country">Country (optional)</label>
              <input id="country" className="in" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} autoComplete="country-name" />
            </div>
            <p className="fine">You can add a profile picture from your profile page after you log in.</p>
          </>
        )}
        <p className="msg-err" role="alert">{err}</p>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      </form>
      <p className="muted">Already have an account? <Link className="linkbtn" href="/login">Log in</Link></p>
    </div>
  );
}

export default function Signup() {
  return <Suspense fallback={<p className="muted">Loading...</p>}><SignupForm /></Suspense>;
}
