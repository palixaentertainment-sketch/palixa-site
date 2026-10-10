'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';
import ProfileBadge from '@/components/ProfileBadge';
import { friendly } from '@/lib/errors';

function AdminPanel() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [badges, setBadges] = useState({});
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [usersCount, booksCount, publishedCount, chaptersCount, userRows, badgeRows, bookRows] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('books').select('id', { count: 'exact', head: true }),
      supabase.from('books').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('chapters').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id,name,username,role,status,created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('profile_badges').select('profile_id,badge_type'),
      supabase.from('books').select('id,title,status,story_status,created_at,author_id').order('created_at', { ascending: false }).limit(100),
    ]);
    const failed = [usersCount, booksCount, publishedCount, chaptersCount, userRows, badgeRows, bookRows].find((r) => r.error);
    if (failed) {
      setError(friendly(failed.error, 'We could not load the admin data. Make sure the admin SQL setup has been run.'));
    } else {
      setStats({ users: usersCount.count || 0, books: booksCount.count || 0, published: publishedCount.count || 0, chapters: chaptersCount.count || 0 });
      setProfiles(userRows.data || []);
      setBadges(Object.fromEntries((badgeRows.data || []).map((b) => [b.profile_id, b.badge_type])));
      setBooks(bookRows.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => [p.name, p.username, p.role, p.status].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [profiles, search]);

  async function setBadge(profileId, badgeType) {
    setBusyId(profileId);
    setError('');
    setMessage('');
    let result;
    if (badges[profileId] === badgeType) {
      result = await supabase.from('profile_badges').delete().eq('profile_id', profileId);
    } else {
      result = await supabase.from('profile_badges').upsert({
        profile_id: profileId,
        badge_type: badgeType,
        granted_by: user.id,
        granted_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' });
    }
    if (result.error) {
      setError(friendly(result.error, 'We could not update this badge. Run supabase/admin_dashboard.sql in Supabase first.'));
    } else {
      setBadges((current) => {
        const next = { ...current };
        if (next[profileId] === badgeType) delete next[profileId];
        else next[profileId] = badgeType;
        return next;
      });
      setMessage('Verification badge updated.');
    }
    setBusyId('');
  }

  return (
    <div className="stack">
      <div className="stack">
        <p className="mono">Palixia administration</p>
        <h1 className="h1">Admin dashboard</h1>
        <p className="muted">Manage the platform overview and grant official or verified-author badges. Only administrator accounts can change verification.</p>
      </div>

      {error && <p className="msg-err" role="alert">{error}</p>}
      {message && <p className="msg-ok" role="status">{message}</p>}

      <div className="stats">
        <div className="stat"><span className="mono">Users</span><b>{stats ? stats.users : '—'}</b></div>
        <div className="stat"><span className="mono">Books</span><b>{stats ? stats.books : '—'}</b></div>
        <div className="stat"><span className="mono">Published</span><b>{stats ? stats.published : '—'}</b></div>
        <div className="stat"><span className="mono">Chapters</span><b>{stats ? stats.chapters : '—'}</b></div>
      </div>

      <section className="stack">
        <div className="sechead">
          <h2 className="h2">User verification</h2>
          <button className="btn ghost small" type="button" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
        <p className="fine">“Official Palixia” is for the platform account. “Verified Author” is for an author you have reviewed. Tapping the active badge removes it.</p>
        <div className="field">
          <label htmlFor="admin-user-search">Find a user</label>
          <input id="admin-user-search" className="in" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, username or role" />
        </div>
        {loading ? <p className="muted">Loading users…</p> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>User</th><th>Role</th><th>Badge</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredProfiles.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.name}</b><br />
                      <span className="fine">@{p.username}</span>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{p.role}</td>
                    <td><ProfileBadge type={badges[p.id]} /></td>
                    <td>
                      <div className="row" style={{ gap: '0.35rem' }}>
                        <button className="btn ghost small" type="button" disabled={busyId === p.id} onClick={() => setBadge(p.id, 'official')}>{badges[p.id] === 'official' ? 'Remove official' : 'Official Palixia'}</button>
                        <button className="btn ghost small" type="button" disabled={busyId === p.id || p.role === 'reader'} onClick={() => setBadge(p.id, 'verified_author')}>{badges[p.id] === 'verified_author' ? 'Remove verified' : 'Verify author'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProfiles.length === 0 && <tr><td colSpan="4">No matching users.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="stack">
        <h2 className="h2">Recent books</h2>
        {loading ? <p className="muted">Loading books…</p> : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Book</th><th>Publishing</th><th>Story</th><th>Open</th></tr></thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b.id}>
                    <td><b>{b.title}</b></td>
                    <td><span className={'badge ' + (b.status === 'published' ? 'live' : 'draft')}>{b.status}</span></td>
                    <td>{b.story_status || 'ongoing'}</td>
                    <td><Link className="btn ghost small" href={'/book/' + b.id}>View</Link></td>
                  </tr>
                ))}
                {books.length === 0 && <tr><td colSpan="4">No books found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminPage() {
  return <Guard roles={['admin']}><AdminPanel /></Guard>;
}
