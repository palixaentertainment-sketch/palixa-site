'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { friendly } from '@/lib/errors';
import { fmtNum, typeLabel } from '@/lib/format';
import Cover from '@/components/Cover';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';

export default function BookPage() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const [book, setBook] = useState(undefined);
  const [chapters, setChapters] = useState([]);
  const [stats, setStats] = useState(null);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [marked, setMarked] = useState({});
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('books')
      .select('id,author_id,title,description,cover_url,book_type,status,reads,is_sample,genres(name,slug),profiles(id,name,username,avatar_url,bio)')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) { setBook(null); return; }
    setBook(data);
    const { data: chs } = await supabase
      .from('chapters')
      .select('id,chapter_number,title,status,reads')
      .eq('book_id', id)
      .order('chapter_number');
    setChapters(chs || []);
    const { data: st } = await supabase.rpc('author_stats', { p_author: data.author_id });
    setStats(st || null);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user || !book) return;
    (async () => {
      const [bm, fl, pr] = await Promise.all([
        supabase.from('bookmarks').select('chapter_id').eq('user_id', user.id).eq('book_id', id),
        supabase.from('follows').select('id').eq('user_id', user.id).eq('author_id', book.author_id).maybeSingle(),
        supabase.from('reading_progress').select('chapter_id,progress').eq('user_id', user.id).eq('book_id', id).maybeSingle(),
      ]);
      const rows = bm.data || [];
      setSaved(rows.some((r) => !r.chapter_id));
      const m = {};
      rows.forEach((r) => { if (r.chapter_id) m[r.chapter_id] = true; });
      setMarked(m);
      setFollowing(Boolean(fl.data));
      setProgress(pr.data || null);
    })();
  }, [user, book, id]);

  async function toggleSave() {
    if (!user) { setMsg('Log in to save books to your library.'); return; }
    setMsg('');
    if (saved) {
      const { error } = await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('book_id', id).is('chapter_id', null);
      if (error) { setMsg(friendly(error)); return; }
      setSaved(false);
    } else {
      const { error } = await supabase.from('bookmarks').insert({ user_id: user.id, book_id: id, chapter_id: null });
      if (error) { setMsg(friendly(error)); return; }
      setSaved(true);
    }
  }

  async function toggleFollow() {
    if (!user) { setMsg('Log in to follow authors.'); return; }
    if (user.id === book.author_id) { setMsg('You cannot follow yourself.'); return; }
    setMsg('');
    if (following) {
      const { error } = await supabase.from('follows').delete().eq('user_id', user.id).eq('author_id', book.author_id);
      if (error) { setMsg(friendly(error)); return; }
      setFollowing(false);
      setStats((s) => (s ? { ...s, followers: Math.max(0, s.followers - 1) } : s));
    } else {
      const { error } = await supabase.from('follows').insert({ user_id: user.id, author_id: book.author_id });
      if (error) { setMsg(friendly(error)); return; }
      setFollowing(true);
      setStats((s) => (s ? { ...s, followers: s.followers + 1 } : s));
    }
  }

  if (book === undefined) return <p className="muted">Loading...</p>;
  if (book === null) {
    return <Empty title="We could not find that book." text="It may have been unpublished or the link may be wrong." href="/discover" cta="Discover Stories" />;
  }

  const author = book.profiles;
  const isOwner = user && user.id === book.author_id;
  const live = chapters.filter((c) => c.status === 'published');
  const visible = isOwner ? chapters : live;
  const first = live[0] || visible[0];
  const resumeId = progress && progress.chapter_id && live.some((c) => c.id === progress.chapter_id) ? progress.chapter_id : null;
  const readTarget = resumeId || (first && first.id);

  return (
    <>
      {book.status !== 'published' && (
        <p className="notice">
          This book is {book.status === 'draft' ? 'a draft' : 'unpublished'}, so only you can see it.{' '}
          <Link className="linkbtn" href={'/dashboard/books/' + book.id}>Manage this book</Link>
        </p>
      )}

      <div className="bhead">
        <Cover b={{ ...book, author_name: author && author.name }} />
        <div className="stack">
          <p className="mono">{book.genres ? book.genres.name : 'Story'} &middot; {typeLabel(book.book_type)}</p>
          <h1 className="h1">{book.title}</h1>
          <p className="muted">by <Link className="linkbtn" href={'/author/' + (author ? author.username : '')}>{author ? author.name : 'Unknown'}</Link></p>
          <dl className="facts">
            <div><dt>Reads</dt><dd>{fmtNum(book.reads)}</dd></div>
            <div><dt>Chapters</dt><dd>{live.length}</dd></div>
            <div><dt>Format</dt><dd>{typeLabel(book.book_type)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="row">
        {readTarget ? (
          <Link className="btn" href={'/read/' + readTarget}>{resumeId ? 'Continue reading' : 'Read Now'}</Link>
        ) : (
          <button type="button" className="btn" disabled>No chapters yet</button>
        )}
        <button type="button" className={'btn ghost' + (saved ? ' on' : '')} aria-pressed={saved} onClick={toggleSave}>{saved ? 'Saved' : 'Save'}</button>
        {!isOwner && (
          <button type="button" className={'btn ghost' + (following ? ' on' : '')} aria-pressed={following} onClick={toggleFollow}>{following ? 'Following' : 'Follow Author'}</button>
        )}
        {isOwner && <Link className="btn ghost" href={'/dashboard/books/' + book.id}>Edit</Link>}
      </div>
      {resumeId && progress && <p className="fine">You are {progress.progress}% through this book.</p>}
      {msg && <p className="msg-err" role="alert">{msg} {!user && <Link className="linkbtn" href={'/login?next=/book/' + id}>Log in</Link>}</p>}

      <section className="stack">
        <h2 className="h2">About this {book.book_type === 'comic' ? 'comic' : 'book'}</h2>
        <p style={{ maxWidth: '40rem', whiteSpace: 'pre-line' }}>{book.description || 'The author has not added a description yet.'}</p>
      </section>

      <section>
        <div className="sechead"><h2 className="h2">Chapters</h2></div>
        {visible.length === 0 ? (
          <p className="empty">No chapters have been published yet. Check back soon.</p>
        ) : (
          <ol className="chap">
            {visible.map((c) => (
              <li key={c.id}>
                <Link href={'/read/' + c.id}>
                  <span className="n">{String(c.chapter_number).padStart(2, '0')}</span>
                  <span>Chapter {c.chapter_number} &mdash; {c.title}</span>
                  <span className="fine">
                    {c.status === 'draft' ? <span className="badge draft">Draft</span> : marked[c.id] ? <span className="badge">Bookmarked</span> : resumeId === c.id ? <span className="badge">Here</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {author && (
        <section>
          <div className="sechead"><h2 className="h2">About the author</h2></div>
          <div className="authorbox">
            <Avatar src={author.avatar_url} name={author.name} size="4rem" />
            <div className="stack" style={{ gap: '0.5rem' }}>
              <b>{author.name}</b>
              <p className="muted">{author.bio || 'This author has not added a bio yet.'}</p>
              <p className="fine">{stats ? stats.books + ' published ' + (stats.books === 1 ? 'book' : 'books') + ' · ' + fmtNum(stats.followers) + ' followers' : ''}</p>
              <div><Link className="btn ghost small" href={'/author/' + author.username}>View Author</Link></div>
            </div>
          </div>
        </section>
      )}

      {profile && profile.status === 'suspended' && <p className="fine">Your account is suspended.</p>}
    </>
  );
}
