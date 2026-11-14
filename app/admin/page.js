'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';
import ProfileBadge from '@/components/ProfileBadge';
import { friendly } from '@/lib/errors';


function ReaderActivitySection() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('readers');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase.rpc('admin_reader_activity', { p_limit: 1000 });
    if (queryError) { setError('Reader Activity needs its database setup. Run supabase/admin_reader_activity.sql in Supabase SQL Editor, then refresh. Details: ' + queryError.message); setRows([]); }
    else setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const q = search.trim().toLowerCase();
  const filtered = rows.filter(r => [r.reader_name,r.reader_username,r.book_title,r.author_name].some(v => String(v||'').toLowerCase().includes(q)));
  const activeRows = filtered.filter(r => Number(r.progress||0)<100);
  const completedRows = filtered.filter(r => Number(r.progress||0)>=100);
  const bookStats = Object.values(rows.reduce((acc,r) => {
    if (!acc[r.book_id]) acc[r.book_id]={id:r.book_id,title:r.book_title,cover:r.book_cover,author:r.author_name,readers:0,active:0,completed:0,latest:r.updated_at};
    const b=acc[r.book_id]; b.readers++; if(Number(r.progress||0)>=100)b.completed++;else b.active++;
    if(r.updated_at&&(!b.latest||r.updated_at>b.latest))b.latest=r.updated_at; return acc;
  },{})).sort((a,b)=>b.active-a.active||b.readers-a.readers);
  const fmt=v=>v?new Date(v).toLocaleString():'—';
  const list=view==='readers'?filtered:view==='currently'?activeRows:view==='completed'?completedRows:bookStats;
  return <section className="stack">
    <div className="sechead"><h2 className="h2">Reader Activity</h2><button className="btn ghost small" type="button" onClick={load} disabled={loading}>{loading?'Loading…':'Refresh activity'}</button></div>
    <p className="fine">Private admin view of reading progress recorded in reader libraries. This activity is not visible to authors or other readers.</p>
    {error&&<p className="msg-err" role="alert">{error}</p>}
    <div className="stats">
      <div className="stat"><span className="mono">Readers with progress</span><b>{new Set(rows.map(r=>r.user_id)).size}</b></div>
      <div className="stat"><span className="mono">Books being read</span><b>{new Set(rows.filter(r=>Number(r.progress||0)<100).map(r=>r.book_id)).size}</b></div>
      <div className="stat"><span className="mono">Reading records</span><b>{rows.length}</b></div>
      <div className="stat"><span className="mono">Completed records</span><b>{rows.filter(r=>Number(r.progress||0)>=100).length}</b></div>
    </div>
    <div className="field"><label htmlFor="reader-activity-search">Search readers or books</label><input id="reader-activity-search" className="in" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Reader, username, book or author"/></div>
    <div className="chips" role="tablist" aria-label="Reader activity views">{[['readers','All reading'],['currently','Currently reading'],['completed','Completed'],['books','Book momentum']].map(([key,label])=><button key={key} type="button" role="tab" aria-selected={view===key} aria-pressed={view===key} className="chip" onClick={()=>setView(key)}>{label}</button>)}</div>
    {loading?<p className="muted">Loading reader activity…</p>:view==='books'?<div className="tablewrap"><table><thead><tr><th>Book</th><th>Currently reading</th><th>Completed</th><th>Latest activity</th></tr></thead><tbody>
      {list.map(b=><tr key={b.id}><td><div className="row" style={{gap:'.6rem',alignItems:'center'}}>{b.cover&&<img src={b.cover} alt="" loading="lazy" style={{width:38,height:54,objectFit:'cover',borderRadius:'.25rem'}}/>}<span><b>{b.title}</b><br/><span className="fine">{b.author}</span></span></div></td><td>{b.active}</td><td>{b.completed}</td><td>{fmt(b.latest)}</td></tr>)}
      {!list.length&&<tr><td colSpan="4">No reading records yet.</td></tr>}
    </tbody></table></div>:<div className="stack">
      {list.map(r=><article key={r.user_id+'-'+r.book_id} className="panel" style={{padding:'.85rem 1rem',border:'1px solid var(--border, #ddd)',borderRadius:'.75rem'}}><div className="row" style={{alignItems:'center',gap:'.75rem'}}>
        {r.reader_avatar?<img src={r.reader_avatar} alt="" loading="lazy" style={{width:40,height:40,borderRadius:'50%',objectFit:'cover'}}/>:<span className="avatar">{(r.reader_name||'R').slice(0,1).toUpperCase()}</span>}
        {r.book_cover&&<img src={r.book_cover} alt="" loading="lazy" style={{width:42,height:58,objectFit:'cover',borderRadius:'.25rem'}}/>}
        <div className="stack" style={{gap:'.15rem',minWidth:0,flex:1}}><b>{r.reader_name} <span className="fine">@{r.reader_username}</span></b><Link href={'/book/'+r.book_id}>{r.book_title}</Link><span className="fine">{r.author_name} · {Number(r.progress||0)}% complete{r.chapter_number?' · Chapter '+r.chapter_number:''}{r.chapter_title?' — '+r.chapter_title:''}</span><span className="fine">Last active: {fmt(r.updated_at)}</span></div>
        <span className="badge">{Number(r.progress||0)>=100?'Completed':'Reading'}</span>
      </div></article>)}
      {!list.length&&<p className="fine">No matching reading activity found.</p>}
    </div>}
  </section>;
}

function AdminPanel() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [badges, setBadges] = useState({});
  const [books, setBooks] = useState([]);
  const [viewDrafts, setViewDrafts] = useState({});
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
  const [creatorBooks, setCreatorBooks] = useState([]);
  const [creatorSelection, setCreatorSelection] = useState('');
  const [creatorLoading, setCreatorLoading] = useState(true);
  const [creatorError, setCreatorError] = useState('');
  const [creatorBusy, setCreatorBusy] = useState(false);

  const loadCreatorWeek = useCallback(async () => {
    setCreatorLoading(true);
    setCreatorError('');
    const [bookResult, selectionResult] = await Promise.all([
      supabase.from('book_cards').select('id,title,author_name').order('created_at', { ascending: false }).limit(100),
      supabase.from('creator_of_week').select('book_id').eq('id', true).maybeSingle(),
    ]);
    if (bookResult.error || selectionResult.error) {
      setCreatorError('Creator of the Week needs the database setup. Run supabase/creator_of_week.sql in Supabase SQL Editor, then refresh this page.');
    } else {
      setCreatorBooks(bookResult.data || []);
      setCreatorSelection(selectionResult.data?.book_id || '');
    }
    setCreatorLoading(false);
  }, []);

  useEffect(() => { loadCreatorWeek(); }, [loadCreatorWeek]);

  async function saveCreatorWeek() {
    setCreatorBusy(true);
    setCreatorError('');
    setMessage('');
    const { error: saveError } = await supabase.rpc('admin_set_creator_of_week', { p_book_id: creatorSelection || null });
    if (saveError) {
      const details = [saveError.message, saveError.code ? `Code: ${saveError.code}` : '', saveError.details, saveError.hint].filter(Boolean).join(' — ');
      setCreatorError(`Could not save Creator of the Week: ${details || 'Unknown database error. Please refresh and try again.'}`);
    } else {
      setMessage(creatorSelection ? 'Creator of the Week updated.' : 'Creator of the Week cleared.');
      await loadCreatorWeek();
    }
    setCreatorBusy(false);
  }

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
      supabase.from('books').select('id,title,status,story_status,created_at,author_id,reads,read_adjustment,is_palixia_original').order('created_at', { ascending: false }).limit(100),
    ]);
    const failed = [usersCount, booksCount, publishedCount, chaptersCount, userRows, badgeRows, bookRows].find((r) => r.error);
    if (failed) setError(friendly(failed.error, 'We could not load the admin data. Make sure the admin SQL setup has been run.'));
    else {
      setStats({ users: usersCount.count || 0, books: booksCount.count || 0, published: publishedCount.count || 0, chapters: chaptersCount.count || 0 });
      setProfiles(userRows.data || []);
      setBadges(Object.fromEntries((badgeRows.data || []).map((b) => [b.profile_id, b.badge_type])));
      setBooks(bookRows.data || []);
      setViewDrafts(Object.fromEntries((bookRows.data || []).map((b) => [b.id, String(Math.max(0, Number(b.reads || 0) + Number(b.read_adjustment || 0)))])));
    }
    setLoading(false);
    await loadModeration();
  }, [loadModeration]);

  useEffect(() => { load(); }, [load]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    const { data, error: analyticsQueryError } = await supabase.rpc('admin_analytics_summary');
    if (analyticsQueryError) {
      setAnalyticsError('Visitor analytics needs its database setup. Run supabase/visitor_analytics.sql in the Supabase SQL Editor, then refresh.');
      setAnalytics(null);
    } else {
      setAnalytics(data || null);
    }
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

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

  async function setDisplayedReads(book) {
    const raw = String(viewDrafts[book.id] ?? '').trim();
    const displayedReads = raw === '' ? null : Number(raw);
    if (displayedReads === null || !Number.isSafeInteger(displayedReads) || displayedReads < 0) {
      setError('Enter a whole number of 0 or more.');
      return;
    }
    setBusyId(book.id); setError(''); setMessage('');
    const { error: saveError } = await supabase.rpc('admin_set_book_read_count', { p_book_id: book.id, p_display_reads: displayedReads });
    if (saveError) {
      setError('Could not save displayed reads. Run supabase/global_read_counts.sql in the Supabase SQL Editor first. Details: ' + saveError.message);
    } else {
      setMessage('Displayed reads updated for "' + book.title + '".');
      await load();
    }
    setBusyId('');
  }

  async function setPalixiaOriginal(book) {
    const nextValue = !book.is_palixia_original;
    setBusyId(book.id); setError(''); setMessage('');
    const { error: saveError } = await supabase.rpc('admin_set_palixia_original', {
      p_book_id: book.id,
      p_is_original: nextValue,
    });
    if (saveError) {
      setError('Could not update Palixia Originals. Run supabase/palixia-originals-admin.sql in Supabase SQL Editor, then try again. Details: ' + saveError.message);
    } else {
      setMessage(nextValue ? '"' + book.title + '" added to Palixia Originals.' : '"' + book.title + '" removed from Palixia Originals.');
      await load();
    }
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
        <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}><Link className="btn" href="/admin/finance">Financial overview</Link><Link className="btn ghost" href="/admin/coming-soon">Manage Coming Soon covers</Link><Link className="btn ghost" href="/admin/announcements">Manage announcements</Link><Link className="btn ghost" href="/admin/homepage-banner">Homepage banner</Link></div>
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
        <div className="sechead"><h2 className="h2">Traffic & reading analytics</h2><button className="btn ghost small" type="button" onClick={loadAnalytics} disabled={analyticsLoading}>{analyticsLoading ? 'Loading…' : 'Refresh analytics'}</button></div>
        <p className="fine">Page views are counted from the moment visitor tracking is installed. Unique visitors are estimated using a random browser session ID, not a person's identity. Historical visits are not available.</p>
        {analyticsError && <p className="msg-err" role="alert">{analyticsError}</p>}
        {analyticsLoading ? <p className="muted">Loading analytics…</p> : analytics && <>
          <div className="stats">
            <div className="stat"><span className="mono">Page views</span><b>{Number(analytics.page_views || 0).toLocaleString()}</b></div>
            <div className="stat"><span className="mono">Unique visitors</span><b>{Number(analytics.unique_visitors || 0).toLocaleString()}</b></div>
            <div className="stat"><span className="mono">Views today</span><b>{Number(analytics.views_today || 0).toLocaleString()}</b></div>
            <div className="stat"><span className="mono">Last 7 days</span><b>{Number(analytics.views_7_days || 0).toLocaleString()}</b></div>
            <div className="stat"><span className="mono">People who have read</span><b>{Number(analytics.readers || 0).toLocaleString()}</b></div>
            <div className="stat"><span className="mono">Authors</span><b>{Number(analytics.authors || 0).toLocaleString()}</b></div>
            <div className="stat"><span className="mono">Book reads</span><b>{Number(analytics.total_reads || 0).toLocaleString()}</b></div>
          </div>
          <h3 className="h2">Most visited pages (last 30 days)</h3>
          {Array.isArray(analytics.top_pages) && analytics.top_pages.length > 0
            ? <div className="tablewrap"><table><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>{analytics.top_pages.map((p) => <tr key={p.path}><td><code>{p.path}</code></td><td>{Number(p.views || 0).toLocaleString()}</td></tr>)}</tbody></table></div>
            : <p className="fine">No page views recorded yet. Visit a few pages on Palixia after the database setup is complete.</p>}
        </>}
      </section>

      <ReaderActivitySection />

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
        <h2 className="h2">Creator of the Week</h2>
        <p className="fine">Choose one published book to feature on the homepage. It stays featured until you change or clear your selection. New uploads will not replace it automatically.</p>
        {creatorError && <p className="msg-err" role="alert">{creatorError}</p>}
        {creatorLoading ? <p className="muted">Loading Creator of the Week…</p> : !creatorError && <>
          <div className="field">
            <label htmlFor="creator-week-book">Featured book</label>
            <select id="creator-week-book" className="in" value={creatorSelection} onChange={e => setCreatorSelection(e.target.value)}>
              <option value="">No creator selected</option>
              {creatorBooks.map(b => <option key={b.id} value={b.id}>{b.title} — {b.author_name}</option>)}
            </select>
          </div>
          <div className="row" style={{gap:'.5rem',flexWrap:'wrap'}}>
            <button className="btn" type="button" onClick={saveCreatorWeek} disabled={creatorBusy}>{creatorBusy ? 'Saving…' : 'Save selection'}</button>
            <button className="btn ghost" type="button" onClick={() => { setCreatorSelection(''); }} disabled={creatorBusy}>Clear selection</button>
          </div>
        </>}
      </section>


      <section className="stack">
        <div className="sechead"><h2 className="h2">Palixia Originals</h2><span className="badge">{books.filter(b => b.is_palixia_original).length} selected</span></div>
        <p className="fine">Choose books created by Palixia to feature in the Palixia Originals shelf on the homepage. Only mark stories Palixia owns or created.</p>
        {loading ? <p className="muted">Loading books…</p> : <div className="tablewrap"><table><thead><tr><th>Book</th><th>Status</th><th>Homepage shelf</th></tr></thead><tbody>
          {books.map(b => <tr key={'original-'+b.id}><td><b>{b.title}</b></td><td>{b.status}</td><td><button className={b.is_palixia_original ? 'btn small' : 'btn ghost small'} type="button" disabled={busyId===b.id || b.status!=='published'} onClick={() => setPalixiaOriginal(b)}>{busyId===b.id ? 'Saving…' : b.is_palixia_original ? 'Remove Original' : 'Mark Original'}</button></td></tr>)}
          {books.length===0 && <tr><td colSpan="3">No books found.</td></tr>}
        </tbody></table></div>}
      </section>

      <section className="stack">
        <h2 className="h2">Recent books</h2>
        <p className="fine">Set the displayed read count. Real reads continue increasing in the background, so the displayed total will keep moving with new readers.</p>
        {loading ? <p className="muted">Loading books…</p> : <div className="tablewrap"><table><thead><tr><th>Book</th><th>Publishing</th><th>Story</th><th>Displayed reads</th><th>Actions</th></tr></thead><tbody>{books.map(b=><tr key={b.id}><td><b>{b.title}</b><br/><span className="fine">Real reads: {Number(b.reads || 0).toLocaleString()}</span></td><td>{b.status}</td><td>{b.story_status||'ongoing'}</td><td><div className="stack" style={{gap:'.35rem',minWidth:'9rem'}}><input aria-label={'Displayed reads for '+b.title} className="in" type="number" min="0" step="1" inputMode="numeric" value={viewDrafts[b.id] ?? ''} onChange={e=>setViewDrafts(v=>({...v,[b.id]:e.target.value}))} placeholder="Displayed total"/><button className="btn small" type="button" disabled={busyId===b.id} onClick={()=>setDisplayedReads(b)}>{busyId===b.id?'Saving…':'Save reads'}</button></div></td><td><div className="row" style={{gap:'.35rem',flexWrap:'wrap'}}><Link className="btn ghost small" href={'/book/'+b.id}>View</Link>{b.status!=='draft'&&<button className="btn ghost small" disabled={busyId===b.id} onClick={()=>runAction(b.id,'Book status updated.',()=>supabase.rpc('admin_set_book_status',{p_book_id:b.id,p_status:b.status==='published'?'unpublished':'published'}))}>{b.status==='published'?'Unpublish':'Republish'}</button>}</div></td></tr>)}</tbody></table></div>}
      </section>
      {moderationError && <p className="msg-err" role="alert">{moderationError}</p>}
    </div>
  );
}

export default function AdminPage() {
  return <Guard roles={['admin']}><AdminPanel /></Guard>;
}
