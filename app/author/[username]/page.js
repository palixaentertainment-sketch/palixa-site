'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { friendly } from '@/lib/errors';
import { fmtNum } from '@/lib/format';
import Avatar from '@/components/Avatar';
import BookCard from '@/components/BookCard';
import Empty from '@/components/Empty';
import Link from 'next/link';
import ProfileBadge from '@/components/ProfileBadge';

export default function AuthorPage() {
  const { username } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState(undefined);
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [following, setFollowing] = useState(false);
  const [msg, setMsg] = useState('');
  const [badge, setBadge] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('id,name,username,avatar_url,bio,country,role,status').eq('username', String(username).toLowerCase()).maybeSingle();
      if (!data || data.status !== 'active') { setP(null); return; }
      setP(data);
      const { data: badgeRow } = await supabase.from('profile_badges').select('badge_type').eq('profile_id', data.id).maybeSingle();
      setBadge(badgeRow ? badgeRow.badge_type : null);
      const { data: bk } = await supabase.from('book_cards').select('*').eq('author_id', data.id).order('created_at', { ascending: false });
      setBooks(bk || []);
      const { data: st } = await supabase.rpc('author_stats', { p_author: data.id });
      setStats(st || null);
    })();
  }, [username]);

  useEffect(() => {
    if (!user || !p) return;
    supabase.from('follows').select('id').eq('user_id', user.id).eq('author_id', p.id).maybeSingle().then(({ data }) => setFollowing(Boolean(data)));
  }, [user, p]);

  async function toggle() {
    if (!user) { setMsg('Log in to follow authors.'); return; }
    setMsg('');
    if (following) {
      const { error } = await supabase.from('follows').delete().eq('user_id', user.id).eq('author_id', p.id);
      if (error) { setMsg(friendly(error)); return; }
      setFollowing(false);
      setStats((s) => (s ? { ...s, followers: Math.max(0, s.followers - 1) } : s));
    } else {
      const { error } = await supabase.from('follows').insert({ user_id: user.id, author_id: p.id });
      if (error) { setMsg(friendly(error)); return; }
      setFollowing(true);
      setStats((s) => (s ? { ...s, followers: s.followers + 1 } : s));
    }
  }

  async function reportAuthor() {
    if (!user) { setMsg('Log in to report this author.'); return; }
    const reason = window.prompt('Why are you reporting this author?');
    if (reason === null) return;
    if (reason.trim().length < 3) { setMsg('Please enter a short reason for the report.'); return; }
    const { error } = await supabase.rpc('submit_moderation_report', { p_target_type: 'user', p_target_id: p.id, p_reason: reason.trim().slice(0, 500) });
    setMsg(error ? 'The report could not be saved. Please try again.' : 'Your report has been sent to Palixia moderation.');
  }

  if (p === undefined) return <p className="muted">Loading...</p>;
  if (p === null) return <Empty title="We could not find that author." href="/authors" cta="Browse Authors" />;

  const self = user && user.id === p.id;

  return (
    <>
      <section className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: '1.1rem' }}>
        <Avatar src={p.avatar_url} name={p.name} size="5.5rem" />
        <div className="stack" style={{ gap: '0.5rem', minWidth: 0 }}>
          <div className="row" style={{ alignItems: 'center', gap: '0.6rem' }}><h1 className="h1">{p.name}</h1><ProfileBadge type={badge} /></div>
          <p className="muted">@{p.username}{p.country ? ' · ' + p.country : ''}</p>
          <p style={{ maxWidth: '38rem' }}>{p.bio || 'This author has not added a bio yet.'}</p>
          <dl className="facts">
            <div><dt>Followers</dt><dd>{stats ? fmtNum(stats.followers) : '0'}</dd></div>
            <div><dt>Total reads</dt><dd>{stats ? fmtNum(stats.reads) : '0'}</dd></div>
            <div><dt>Books</dt><dd>{stats ? stats.books : books.length}</dd></div>
          </dl>
          <div className="row">
            {self ? <Link className="btn ghost" href="/profile">Edit profile</Link> : (
              <><button type="button" className={'btn' + (following ? ' ghost on' : '')} aria-pressed={following} onClick={toggle}>{following ? 'Following' : 'Follow'}</button>{user && <button type="button" className="btn ghost" onClick={reportAuthor}>Report author</button>}</>
            )}
          </div>
          {msg && <p className="msg-err" role="alert">{msg} {!user && <Link className="linkbtn" href={'/login?next=/author/' + p.username}>Log in</Link>}</p>}
        </div>
      </section>

      <section>
        <div className="sechead"><h2 className="h2">Books by {p.name}</h2></div>
        {books.length === 0 ? (
          self ? (
            <Empty title="You haven't published anything yet." href="/dashboard/books/new" cta="Create Your First Book" />
          ) : (
            <p className="empty">No published books yet.</p>
          )
        ) : (
          <div className="grid">{books.map((b) => <BookCard key={b.id} b={b} />)}</div>
        )}
      </section>
    </>
  );
}
