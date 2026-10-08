'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { friendly } from '@/lib/errors';
import { checkImage, uploadImage } from '@/lib/upload';
import { fmtNum, validUsername } from '@/lib/format';
import Guard from '@/components/Guard';
import Avatar from '@/components/Avatar';

function ProfileForm() {
  const { user, profile, refresh, signOut } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [aErr, setAErr] = useState('');

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || '');
    setUsername(profile.username || '');
    setBio(profile.bio || '');
    setCountry(profile.country || '');
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [a, b] = await Promise.all([
        supabase.rpc('author_stats', { p_author: user.id }),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      setCounts({ followers: a.data ? a.data.followers : 0, following: b.count || 0 });
    })();
  }, [user]);

  useEffect(() => {
    if (!file) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(e) {
    const f = e.target.files[0] || null;
    setErr(''); setOk('');
    if (f) {
      const problem = checkImage(f, 1);
      if (problem) { setErr(problem); e.target.value = ''; setFile(null); return; }
    }
    setFile(f);
  }

  async function save(e) {
    e.preventDefault();
    setErr(''); setOk('');
    const u = username.trim().toLowerCase();
    if (!name.trim()) { setErr('Enter your name.'); return; }
    if (!validUsername(u)) { setErr('Usernames use 3 to 24 letters, numbers or underscores.'); return; }
    setBusy(true);
    try {
      let avatar_url = profile.avatar_url || null;
      if (file) avatar_url = await uploadImage('avatars', user.id, file);
      const { error } = await supabase.from('profiles').update({
        name: name.trim(), username: u, bio: bio.trim() || null, country: country.trim() || null, avatar_url,
      }).eq('id', user.id);
      if (error) throw error;
      setFile(null);
      await refresh();
      setOk('Profile saved.');
    } catch (e2) {
      setErr(e2 && e2.code === '23505' ? 'That username is taken. Try another.' : friendly(e2, 'We could not save your profile. Please try again.'));
    }
    setBusy(false);
  }

  async function becomeAuthor() {
    setAErr('');
    const { error } = await supabase.rpc('become_author');
    if (error) { setAErr(friendly(error)); return; }
    await refresh();
  }

  const isAuthor = profile.role === 'author' || profile.role === 'admin';

  return (
    <div className="stack narrow">
      <h1 className="h1">Profile</h1>
      <div className="row" style={{ flexWrap: 'nowrap', gap: '1.2rem' }}>
        <Avatar src={preview || profile.avatar_url} name={profile.name} size="5rem" />
        <dl className="facts">
          <div><dt>Followers</dt><dd>{fmtNum(counts.followers)}</dd></div>
          <div><dt>Following</dt><dd>{fmtNum(counts.following)}</dd></div>
          <div><dt>Account</dt><dd style={{ textTransform: 'capitalize' }}>{profile.role}</dd></div>
        </dl>
      </div>

      <form className="card" onSubmit={save} noValidate>
        <div className="field">
          <label htmlFor="avatar">Profile picture</label>
          <input id="avatar" className="in" type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} />
          <span className="fine">JPG, PNG or WebP, up to 1 MB.</span>
        </div>
        <div className="field">
          <label htmlFor="pname">Full name</label>
          <input id="pname" className="in" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="puser">Username</label>
          <input id="puser" className="in" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} autoCapitalize="none" />
        </div>
        <div className="field">
          <label htmlFor="pbio">Bio</label>
          <textarea id="pbio" className="in" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} />
        </div>
        <div className="field">
          <label htmlFor="pcountry">Country (optional)</label>
          <input id="pcountry" className="in" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} />
        </div>
        <p className="msg-err" role="alert">{err}</p>
        {ok && <p className="msg-ok" role="status">{ok}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save profile'}</button>
      </form>

      <section id="author" className="card">
        {isAuthor ? (
          <>
            <h2 className="h2">Author tools</h2>
            <p className="muted">Create books and comics, manage chapters and see how your stories are doing.</p>
            <div className="row">
              <Link className="btn" href="/dashboard">Author dashboard</Link>
              <Link className="btn ghost" href={'/author/' + profile.username}>View public page</Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="h2">Become an author</h2>
            <p className="muted">Publish your own books and comics on Palixa. It is free to start and your reader account stays the same.</p>
            <p className="msg-err" role="alert">{aErr}</p>
            <div><button type="button" className="btn" onClick={becomeAuthor}>Become an author</button></div>
          </>
        )}
      </section>

      <div><button type="button" className="btn ghost" onClick={signOut}>Sign out</button></div>
    </div>
  );
}

export default function ProfilePage() {
  return <Guard><ProfileForm /></Guard>;
}
