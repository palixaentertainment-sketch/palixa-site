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
  const [reports, setReports] = useState([]);
  const [chapterComments, setChapterComments] = useState([]);
  const [communityComments, setCommunityComments] = useState([]);
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [moderationLoading, setModerationLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [moderationError, setModerationError] = useState('');
  const [message, setMessage] = useState('');
  const [reportFilter, setReportFilter] = useState('open');
  const [noteDrafts, setNoteDrafts] = useState({});

  const loadModeration = useCallback(async () => {
    setModerationLoading(true);
    setModerationError('');
    const [r, c, cc, p] = await Promise.all([
      supabase.from('moderation_reports').select('id,target_type,target_id,reason,status,admin_note,created_at,profiles!moderation_reports_reporter_id_fkey(name,username)').order('created_at', { ascending: false }).limit(100),
      supabase.from('comments').select('id,body,status,created_at,user_id,chapter_id,profiles(name,username)').order('created_at', { ascending: false }).limit(100),
      supabase.from('community_comments').select('id,body,status,created_at,user_id,post_id,profiles!community_comments_user_id_fkey(name,username)').order('created_at', { ascending: false }).limit(100),
      supabase.from('community_posts').select('id,body,image_url,status,created_at,user_id,profiles!community_posts_user_id_fkey(name,username)').order('created_at', { ascending: false }).limit(100),
    ]);
    const failed = [r, c, cc, p].find(x => x.error);
    if (failed) setModerationError('Moderation tools need the database migration. In Supabase, run supabase/moderation.sql from GitHub. Details: ' + (failed.error.message || 'query failed'));
    else {
      setReports(r.data || []);
      setChapterComments(c.data || []);
      setCommunityComments(cc.data || []);
      setPosts(p.data || []);
    }
    setModerationLoading(false);
  }, []);

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
    if (failed) setError(friendly(failed.error, 'We could not load the admin data. Make sure the admin SQL setup has been run.'));
    else {
      setStats({ users: usersCount.count || 0, books: booksCount.count || 0, published: publishedCount.count || 0, chapters: chaptersCount.count || 0 });
      setProfiles(userRows.data || []);
      setBadges(Object.fromEntries((badgeRows.data || []).map((b) => [b.profile_id, b.badge_type])));
      setBooks(bookRows.data || []);
    }
    setLoading(false);
    await loadModeration();
  }, [loadModeration]);

  useEffect(() => { load(); }, [load]);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => [p.name, p.username, p.role, p.status].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [profiles, search]);

  async function runAction(id, label, action) {
    setBusyId(id); setError(''); setModerationError(''); setMessage('');
    const { error: actionError } = await action();
    if (actionError) setError(friendly(actionError, 'The action could not be completed.'));
    else { setMessage(label); await load(); }
    setBusyId('');
  }

  async function setBadge(profileId, badgeType) {
    setBusyId(profileId); setError(''); setMessage('');
    let result;
    if (badges[profileId] === badgeType) result = await supabase.from('profile_badges').delete().eq('profile_id', profileId);
    else result = await supabase.from('profile_badges').upsert({ profile_id: profileId, badge_type: badgeType, granted_by: user.id, granted_at: new Date().toISOString() }, { onConflict: 'profile_id' });
    if (result.error) setError(friendly(result.error, 'We could not update this badge. Run supabase/admin_dashboard.sql in Supabase first.'));
    else { setMessage('Verification badge updated.'); await load(); }
    setBusyId('');
  }

  async function suspendProfile(p) {
    const suspend = p.status !== 'suspended';
    const reason = suspend && typeof window !== 'undefined' ? window.prompt('Reason for suspending @' + p.username + ' (internal admin note):') : '';
    if (suspend && reason === null) return;
    if (suspend && !reason.trim()) { setError('Enter a reason before suspending an account.'); return; }
    await runAction(p.id, suspend ? 'Account suspended.' : 'Account restored.', () => supabase.rpc('admin_set_profile_status', { p_user_id: p.id, p_status: suspend ? 'suspended' : 'active', p_reason: reason || null }));
  }

  async function resolveReport(report, status) {
    await runAction(report.id, status === 'dismissed' ? 'Report dismissed.' : status === 'open' ? 'Report reopened.' : 'Report marked reviewed.', () => supabase.rpc('admin_resolve_moderation_report', { p_report_id: report.id, p_status: status, p_note: noteDrafts[report.id] || report.admin_note || '' }));
  }

  function targetLink(report) {
    if (report.target_type === 'book') return '/book/' + report.target_id;
    if (report.target_type === 'user') {
      const found = profiles.find(p => p.id === report.target_id);
      return found ? '/author/' + found.username : '';
    }
    if (report.target_type === 'community_post') return '/community';
    return '';
  }

  return (
    <div className="stack">
      <div className="stack">
        <p className="mono">Palixia administration</p>
        <h1 className="h1">Admin dashboard</h1>
        <p className="muted">Platform overview, author verification and community moderation. Moderation actions are restricted to active administrator accounts.</p>
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
        <div className="sechead"><h2 className="h2">User management</h2><button className="btn ghost small" type="button" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></div>
        <p className="fine">Suspend an account to prevent normal use of Palixia. Restore it if the issue is resolved. Admin accounts and your own account cannot be suspended here.</p>
        <div className="field"><label htmlFor="admin-user-search">Find a user</label><input id="admin-user-search" className="in" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, username or role" /></div>
        {loading ? <p className="muted">Loading users…</p> : <div className="tablewrap"><table><thead><tr><th>User</th><th>Role / status</th><th>Badge</th><th>Actions</th></tr></thead><tbody>
          {filteredProfiles.map(p => <tr key={p.id}><td><b>{p.name}</b><br/><span className="fine">@{p.username}</span></td><td><span style={{textTransform:'capitalize'}}>{p.role}</span><br/><span className="fine">{p.status || 'active'}</span></td><td><ProfileBadge type={badges[p.id]} /></td><td><div className="stack" style={{gap:'.35rem'}}>
            <div className="row" style={{gap:'.35rem',flexWrap:'wrap'}}><button className="btn ghost small" type="button" disabled={busyId===p.id} onClick={() => setBadge(p.id,'official')}>{badges[p.id]==='official'?'Remove official':'Official Palixia'}</button><button className="btn ghost small" type="button" disabled={busyId===p.id||p.role==='reader'} onClick={() => setBadge(p.id,'verified_author')}>{badges[p.id]==='verified_author'?'Remove verified':'Verify author'}</button></div>
            {p.role !== 'admin' && p.id !== user.id && <button className="btn ghost small" type="button" disabled={busyId===p.id} onClick={() => suspendProfile(p)}>{p.status==='suspended'?'Restore account':'Suspend account'}</button>}
          </div></td></tr>)}
          {filteredProfiles.length===0 && <tr><td colSpan="4">No matching users.</td></tr>}
        </tbody></table></div>}
      </section>

      <section className="stack">
        <div className="sechead"><h2 className="h2">Report queue</h2><span className="badge">{reports.filter(r=>r.status==='open').length} open</span></div>
        <p className="fine">Review reports submitted by users. Open a linked book or profile when available, then mark the report reviewed or dismiss it.</p>
        <div className="field"><label htmlFor="report-filter">Show reports</label><select id="report-filter" className="in" value={reportFilter} onChange={e=>setReportFilter(e.target.value)}><option value="open">Open</option><option value="reviewed">Reviewed</option><option value="dismissed">Dismissed</option><option value="all">All</option></select></div>
        {moderationLoading ? <p className="muted">Loading moderation queue…</p> : <div className="stack">{reports.filter(r=>reportFilter==='all'||r.status===reportFilter).map(r=><article className="panel stack" key={r.id} style={{padding:'1rem',border:'1px solid var(--border, #ddd)',borderRadius:'.75rem'}}>
          <div className="sechead"><b>{r.target_type.replaceAll('_',' ')}</b><span className="fine">{r.status} · {new Date(r.created_at).toLocaleString()}</span></div>
          <p>{r.reason}</p><p className="fine">Reported by {r.profiles?.name || 'User'} (@{r.profiles?.username || 'unknown'}) · Target: <code>{r.target_id}</code></p>
          {targetLink(r) && <p><Link className="linkbtn" href={targetLink(r)}>Open related page</Link></p>}
          <div className="field"><label htmlFor={'report-note-'+r.id}>Admin note</label><textarea id={'report-note-'+r.id} className="in" rows={2} value={noteDrafts[r.id] ?? r.admin_note ?? ''} onChange={e=>setNoteDrafts(v=>({...v,[r.id]:e.target.value}))} placeholder="Optional moderation note" /></div>
          <div className="row" style={{flexWrap:'wrap',gap:'.5rem'}}><button className="btn small" disabled={busyId===r.id} onClick={()=>resolveReport(r,'reviewed')}>Mark reviewed</button><button className="btn ghost small" disabled={busyId===r.id} onClick={()=>resolveReport(r,'dismissed')}>Dismiss</button>{r.status!=='open'&&<button className="btn ghost small" disabled={busyId===r.id} onClick={()=>resolveReport(r,'open')}>Reopen</button>}</div>
        </article>)}{reports.filter(r=>reportFilter==='all'||r.status===reportFilter).length===0&&<p className="fine">No reports in this view.</p>}</div>}
      </section>

      <section className="stack">
        <h2 className="h2">Comment moderation</h2>
        <p className="fine">Hide a comment to remove it from public view without permanently deleting it. You can restore it later.</p>
        {moderationLoading ? <p className="muted">Loading comments…</p> : <div className="stack">
          <h3 className="h2">Book chapter comments</h3>
          {chapterComments.map(c=><article key={c.id} className="panel stack" style={{padding:'1rem',border:'1px solid var(--border, #ddd)',borderRadius:'.75rem'}}><div className="sechead"><b>{c.profiles?.name||'Reader'} (@{c.profiles?.username||'unknown'})</b><span className="fine">{c.status}</span></div><p>{c.body}</p><p className="fine">{new Date(c.created_at).toLocaleString()} · Chapter ID {c.chapter_id}</p><div className="row"><button className="btn ghost small" disabled={busyId===c.id} onClick={()=>runAction(c.id,'Comment status updated.',()=>supabase.rpc('admin_set_chapter_comment_status',{p_comment_id:c.id,p_status:c.status==='hidden'?'visible':'hidden'}))}>{c.status==='hidden'?'Restore comment':'Hide comment'}</button></div></article>)}
          {chapterComments.length===0&&<p className="fine">No chapter comments found.</p>}
          <h3 className="h2">Community comments</h3>
          {communityComments.map(c=><article key={c.id} className="panel stack" style={{padding:'1rem',border:'1px solid var(--border, #ddd)',borderRadius:'.75rem'}}><div className="sechead"><b>{c.profiles?.name||'Reader'} (@{c.profiles?.username||'unknown'})</b><span className="fine">{c.status}</span></div><p>{c.body}</p><p className="fine">{new Date(c.created_at).toLocaleString()} · Post ID {c.post_id}</p><button className="btn ghost small" disabled={busyId===c.id} onClick={()=>runAction(c.id,'Comment status updated.',()=>supabase.rpc('admin_set_community_comment_status',{p_comment_id:c.id,p_status:c.status==='hidden'?'visible':'hidden'}))}>{c.status==='hidden'?'Restore comment':'Hide comment'}</button></article>)}
          {communityComments.length===0&&<p className="fine">No community comments found.</p>}
        </div>}
      </section>

      <section className="stack">
        <h2 className="h2">Community post moderation</h2>
        {moderationLoading ? <p className="muted">Loading posts…</p> : posts.map(p=><article key={p.id} className="panel stack" style={{padding:'1rem',border:'1px solid var(--border, #ddd)',borderRadius:'.75rem'}}><div className="sechead"><b>{p.profiles?.name||'User'} (@{p.profiles?.username||'unknown'})</b><span className="fine">{p.status}</span></div><p style={{whiteSpace:'pre-wrap'}}>{p.body}</p>{p.image_url&&<a href={p.image_url} target="_blank" rel="noreferrer" aria-label="Open community image"><img src={p.image_url} alt="Community post attachment" loading="lazy" style={{display:'block',width:'100%',maxWidth:'520px',maxHeight:'520px',objectFit:'contain',borderRadius:'.75rem',border:'1px solid var(--border, #ddd)'}} /></a>}<p className="fine">{new Date(p.created_at).toLocaleString()}</p><button className="btn ghost small" disabled={busyId===p.id} onClick={()=>runAction(p.id,'Post status updated.',()=>supabase.rpc('admin_set_community_post_status',{p_post_id:p.id,p_status:p.status==='hidden'?'visible':'hidden'}))}>{p.status==='hidden'?'Restore post':'Hide post'}</button></article>)}
        {!moderationLoading&&posts.length===0&&<p className="fine">No community posts found.</p>}
      </section>

      <section className="stack">
        <h2 className="h2">Recent books</h2>
        {loading ? <p className="muted">Loading books…</p> : <div className="tablewrap"><table><thead><tr><th>Book</th><th>Publishing</th><th>Story</th><th>Actions</th></tr></thead><tbody>{books.map(b=><tr key={b.id}><td><b>{b.title}</b></td><td>{b.status}</td><td>{b.story_status||'ongoing'}</td><td><div className="row" style={{gap:'.35rem',flexWrap:'wrap'}}><Link className="btn ghost small" href={'/book/'+b.id}>View</Link>{b.status!=='draft'&&<button className="btn ghost small" disabled={busyId===b.id} onClick={()=>runAction(b.id,'Book status updated.',()=>supabase.rpc('admin_set_book_status',{p_book_id:b.id,p_status:b.status==='published'?'unpublished':'published'}))}>{b.status==='published'?'Unpublish':'Republish'}</button>}</div></td></tr>)}</tbody></table></div>}
      </section>
      {moderationError && <p className="msg-err" role="alert">{moderationError}</p>}
    </div>
  );
}

export default function AdminPage() {
  return <Guard roles={['admin']}><AdminPanel /></Guard>;
}
