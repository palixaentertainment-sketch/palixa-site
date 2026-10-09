'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePublishHref } from '@/components/PublishLink';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import BookCard from '@/components/BookCard';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';

const PAGE = 24;
const SORTS = [
  ['popular', 'Popular'],
  ['newest', 'Newest'],
  ['most_read', 'Most Read'],
];

function Discover() {
  const router = useRouter();
  const publishHref = usePublishHref();
  const params = useSearchParams();
  const q = params.get('q') || '';
  const type = params.get('type') || 'all';
  const genre = params.get('genre') || '';
  const sort = params.get('sort') || 'popular';
  const storyStatus = params.get('story') || 'all';

  const [input, setInput] = useState(q);
  const [genres, setGenres] = useState([]);
  const [rows, setRows] = useState(null);
  const [authors, setAuthors] = useState([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function go(patch) {
    const next = new URLSearchParams(params.toString());
    Object.keys(patch).forEach((k) => {
      if (patch[k]) next.set(k, patch[k]); else next.delete(k);
    });
    router.replace('/discover' + (next.toString() ? '?' + next.toString() : ''));
  }

  useEffect(() => { setInput(q); }, [q]);

  useEffect(() => {
    if (!configured) return;
    supabase.from('genres').select('*').order('sort').then(({ data }) => setGenres(data || []));
  }, []);

  function build(from) {
    let query = supabase.from('book_cards').select('*');
    if (type === 'text') query = query.eq('book_type', 'text');
    if (type === 'comic') query = query.eq('book_type', 'comic');
    if (storyStatus !== 'all') query = query.eq('story_status', storyStatus);
    if (genre) query = query.eq('genre_slug', genre);
    const term = q.trim().toLowerCase().replace(/[%,()]/g, ' ');
    if (term) query = query.ilike('search', '%' + term + '%');
    if (sort === 'newest') query = query.order('created_at', { ascending: false });
    else query = query.order('reads', { ascending: false });
    return query.range(from, from + PAGE - 1);
  }

  useEffect(() => {
    if (!configured) { setRows([]); return; }
    let alive = true;
    setRows(null); setFailed(false);
    build(0).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setFailed(true); setRows([]); return; }
      setRows(data || []);
      setMore((data || []).length === PAGE);
    });
    const term = q.trim().replace(/[%,()]/g, ' ');
    if (term && configured) {
      supabase.from('profiles').select('id,name,username,avatar_url,bio').eq('status', 'active')
        .or('name.ilike.%' + term + '%,username.ilike.%' + term + '%').limit(6)
        .then(({ data }) => { if (alive) setAuthors((data || []).filter((p) => p)); });
    } else {
      setAuthors([]);
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, genre, sort, storyStatus]);

  async function loadMore() {
    setBusy(true);
    const { data, error } = await build(rows.length);
    setBusy(false);
    if (error) { setFailed(true); return; }
    setRows([...rows, ...(data || [])]);
    setMore((data || []).length === PAGE);
  }

  function submit(e) {
    e.preventDefault();
    go({ q: input.trim() });
  }

  return (
    <>
      <div className="stack">
        <h1 className="h1">Discover stories</h1>
        <form onSubmit={submit} role="search" className="row" style={{ flexWrap: 'nowrap' }}>
          <label className="sr-only" htmlFor="dq">Search books, authors or genres</label>
          <input id="dq" className="in" type="search" placeholder="Search books, authors or genres" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn" type="submit">Search</button>
        </form>
        <div className="chips" role="group" aria-label="Format">
          {[['all', 'All'], ['text', 'Books'], ['comic', 'Comics']].map(([v, label]) => (
            <button key={v} type="button" className="chip" aria-pressed={type === v} onClick={() => go({ type: v === 'all' ? '' : v })}>{label}</button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="story-status-filter">Story status</label>
          <div className="chips" id="story-status-filter" role="group" aria-label="Story status">
            {[[ 'all', 'All stories' ], [ 'ongoing', 'Ongoing' ], [ 'completed', 'Completed' ], [ 'hiatus', 'On hiatus' ]].map(([v, label]) => (
              <button key={v} type="button" className="chip" aria-pressed={storyStatus === v} onClick={() => go({ story: v === 'all' ? '' : v })}>{label}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ minWidth: '10rem', flex: 1 }}>
            <label htmlFor="dg">Genre</label>
            <select id="dg" className="in" value={genre} onChange={(e) => go({ genre: e.target.value })}>
              <option value="">All genres</option>
              {genres.map((g) => <option key={g.id} value={g.slug}>{g.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: '10rem', flex: 1 }}>
            <label htmlFor="ds">Sort by</label>
            <select id="ds" className="in" value={sort} onChange={(e) => go({ sort: e.target.value === 'popular' ? '' : e.target.value })}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {authors.length > 0 && (
        <section>
          <div className="sechead"><h2 className="h2">Authors</h2></div>
          <div className="alist">
            {authors.map((a) => (
              <Link key={a.id} href={'/author/' + a.username} className="arow">
                <Avatar src={a.avatar_url} name={a.name} size="3rem" />
                <div><b>{a.name}</b><p>{a.bio || '@' + a.username}</p></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        {q && <div className="sechead"><h2 className="h2">Books matching &ldquo;{q}&rdquo;</h2></div>}
        {failed && <p className="notice">We could not load stories. Check your connection and try again.</p>}
        {rows === null && <p className="muted">Loading...</p>}
        {rows && rows.length === 0 && !failed && (
          q || genre || type !== 'all' ? (
            <Empty title="Nothing matches that." text="Try a different word, or clear the filters." href="/discover" cta="Clear filters" />
          ) : (
            <Empty title="No stories are published yet." text="Be the first to publish on Palixia." href={publishHref} cta="Publish Your Story" />
          )
        )}
        {rows && rows.length > 0 && (
          <>
            <div className="grid">{rows.map((b) => <BookCard key={b.id} b={b} />)}</div>
            {more && (
              <div className="row" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
                <button type="button" className="btn ghost" onClick={loadMore} disabled={busy}>{busy ? 'Loading...' : 'Load more'}</button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<p className="muted">Loading...</p>}>
      <Discover />
    </Suspense>
  );
}
