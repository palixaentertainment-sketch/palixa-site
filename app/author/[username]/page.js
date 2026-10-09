'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { friendly } from '@/lib/errors';
import { fmtNum, SHOW_PUBLIC_READS } from '@/lib/format';
import Avatar from '@/components/Avatar';
import BookCard from '@/components/BookCard';
import Empty from '@/components/Empty';
import Link from 'next/link';

export default function AuthorPage() {
  const { username } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState(undefined);
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [following, setFollowing] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('id,name,username,avatar_url,bio,country,role,status').eq('username', String(username).toLowerCase()).maybeSingle();
      if (!data || data.status !== 'active') { setP(null); return; }
      setP(data);
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

  if (p === undefined) return <p className="muted">Loading...</p>;
  if (p === null) return <Empty title="We could not find that author." href="/authors" cta="Browse Authors" />;

  const self = user && user.id === p.id;

  return (
    <>
      <section className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: '1.1rem' }}>
        <Avatar src={p.avatar_url} name={p.name} size="5.5rem" />
        <div className="stack" style={{ gap: '0.5rem', minWidth: 0 }}>
          <h1 className="h1">{p.name}</h1>
          <p className="muted">@{p.username}{p.country ? ' · ' + p.country : ''}</p>
          <p style={{ maxWidth: '38rem' }}>{p.bio || 'This author has not added a bio yet.'}</p>
          <dl className="facts">
            <div><dt>Followers</dt><dd>{stats ? fmtNum(stats.followers) : '0'}</dd></div>
            {SHOW_PUBLIC_READS && <div><dt>Total reads</dt><dd>{stats ? fmtNum(stats.reads) : '0'}</dd></div>}
            <div><dt>Books</dt><dd>{stats ? stats.books : books.length}</dd></div>
          </dl>
          <div className="row">
            {self ? <Link className="btn ghost" href="/profile">Edit profile</Link> : (
              <button type="button" className={'btn' + (following ? ' ghost on' : '')} aria-pressed={following} onClick={toggle}>{following ? 'Following' : 'Follow'}</button>
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
