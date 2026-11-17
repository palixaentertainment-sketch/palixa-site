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
const BOOK_CARD_FIELDS = 'id,author_id,title,description,cover_url,book_type,tags,reads,featured,is_sample,created_at,genre_id,genre_name,genre_slug,author_name,author_username,author_avatar,story_status';
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
  const genre = params.get('genre') || '';
  const sort = params.get('sort') || 'popular';
  const storyStatus = params.get('status') || '';

  const [input, setInput] = useState(q);
  const [genres, setGenres] = useState([]);
  const [rows, setRows] = useState(null);
  const [authors, setAuthors] = useState([]);
  const [shelves, setShelves] = useState({ featured: [], updated: [], newest: [], completed: [] });
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
    let alive = true;
    async function loadAvailableGenres() {
      // book_cards contains published books only, so categories without a published book stay hidden.
      const { data: books, error: booksError } = await supabase
        .from('book_cards').select('genre_id').eq('book_type', 'text').not('genre_id', 'is', null);
      if (booksError || !alive) return;
      const genreIds = [...new Set((books || []).map((book) => book.genre_id).filter(Boolean))];
      if (!genreIds.length) { setGenres([]); return; }
      const { data } = await supabase.from('genres').select('*').in('id', genreIds).order('sort');
      if (alive) setGenres((data || []).filter((item) => item.slug !== 'comics'));
    }
    loadAvailableGenres();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    async function loadShelves() {
      const [featuredResult, chapterResult, newestResult, completedResult] = await Promise.all([
        supabase.from('book_cards').select(BOOK_CARD_FIELDS).eq('book_type', 'text').eq('featured', true).order('created_at', { ascending: false }).limit(6),
        supabase.from('chapters').select('book_id,updated_at').eq('status', 'published').order('updated_at', { ascending: false }).limit(60),
        supabase.from('book_cards').select(BOOK_CARD_FIELDS).eq('book_type', 'text').order('created_at', { ascending: false }).limit(36),
        supabase.from('book_cards').select(BOOK_CARD_FIELDS).eq('book_type', 'text').eq('story_status', 'completed').order('created_at', { ascending: false }).limit(6),
      ]);
      const updatedIds = [...new Set((chapterResult.data || []).map((chapter) => chapter.book_id).filter(Boolean))].slice(0, 6);
      const updatedResult = updatedIds.length ? await supabase.from('book_cards').select(BOOK_CARD_FIELDS).eq('book_type', 'text').in('id', updatedIds) : { data: [], error: null };
      if (!alive) return;
      const updatedById = new Map((updatedResult.data || []).map((book) => [book.id, book]));
      const seenAuthors = new Set();
      const recentByDifferentAuthors = (newestResult.data || []).filter((book) => {
        if (!book.author_id || seenAuthors.has(book.author_id)) return false;
        seenAuthors.add(book.author_id);
        return true;
      }).slice(0, 6);
      setShelves({ featured: featuredResult.error ? [] : (featuredResult.data || []), updated: updatedIds.map((id) => updatedById.get(id)).filter(Boolean), newest: newestResult.error ? [] : recentByDifferentAuthors, completed: completedResult.error ? [] : (completedResult.data || []) });
    }
    loadShelves();
    return () => { alive = false; };
  }, []);
  function build(from) {
    let query = supabase.from('book_cards').select(BOOK_CARD_FIELDS);
    query = query.eq('book_type', 'text');
    if (genre) query = query.eq('genre_slug', genre);
    if (storyStatus) query = query.eq('story_status', storyStatus);
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
  }, [q, genre, sort, storyStatus]);

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
      <div className="stack discover-intro">
        <h1 className="h1">Find your next favourite story.</h1>
        <p className="fine">Explore books from independent authors around the world. Your next great read might come from a voice you have not discovered yet.</p>
        <form onSubmit={submit} role="search" className="row" style={{ flexWrap: 'nowrap' }}>
          <label className="sr-only" htmlFor="dq">Search for a book, author or genre</label>
          <input id="dq" className="in" type="search" placeholder="Search for a book, author or genre" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn" type="submit">Search</button>
        </form>
        <div className="chips" role="group" aria-label="Format">
          <span className="chip" aria-current="true">Books</span>
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
            <label htmlFor="dstatus">Story status</label>
            <select id="dstatus" className="in" value={storyStatus} onChange={(e) => go({ status: e.target.value })}>
              <option value="">Any status</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="hiatus">On hiatus</option>
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

      {!q && !genre && !storyStatus && (
        <div className="discover-shelves">
          {shelves.featured.length > 0 && <section className="discover-shelf"><div className="sechead"><div><h2 className="h2">Featured on Palixia</h2><p className="fine">Stories selected by the Palixia team.</p></div></div><div className="grid discover-book-grid">{shelves.featured.map((b, index) => <div className="discover-book-reveal" key={b.id} style={{ "--discover-index": index }}><BookCard b={b} /></div>)}</div></section>}
          {shelves.updated.length > 0 && <section className="discover-shelf"><div className="sechead"><div><h2 className="h2">Recently Updated</h2><p className="fine">Stories with newly published chapters.</p></div></div><div className="grid discover-book-grid">{shelves.updated.map((b, index) => <div className="discover-book-reveal" key={b.id} style={{ "--discover-index": index }}><BookCard b={b} /></div>)}</div></section>}
          {shelves.newest.length > 0 && <section className="discover-shelf"><div className="sechead"><div><h2 className="h2">New stories</h2><p className="fine">Recent releases, with room for different authors to be discovered.</p></div></div><div className="grid discover-book-grid">{shelves.newest.map((b, index) => <div className="discover-book-reveal" key={b.id} style={{ "--discover-index": index }}><BookCard b={b} /></div>)}</div></section>}
          {shelves.completed.length > 0 && <section className="discover-shelf"><div className="sechead"><div><h2 className="h2">Completed Stories</h2><p className="fine">Enjoy a story from beginning to end.</p></div><button type="button" className="btn ghost" onClick={() => go({ status: 'completed' })}>See all</button></div><div className="grid discover-book-grid">{shelves.completed.map((b, index) => <div className="discover-book-reveal" key={b.id} style={{ "--discover-index": index }}><BookCard b={b} /></div>)}</div></section>}
        </div>
      )}
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
        {(q || genre || storyStatus) && <div className="sechead"><h2 className="h2">{q ? `Stories matching “${q}”` : storyStatus === 'completed' ? 'Completed stories' : storyStatus === 'hiatus' ? 'Stories on hiatus' : storyStatus === 'ongoing' ? 'Ongoing stories' : genres.find((g) => g.slug === genre)?.name || 'Explore stories'}</h2></div>}
        {failed && <p className="notice">We could not load stories. Check your connection and try again.</p>}
        {rows === null && <p className="muted">Loading...</p>}
        {rows && rows.length === 0 && !failed && (
          q || genre || storyStatus ? (
            <Empty title="Nothing matches that." text="Try a different word, or clear the filters." href="/discover" cta="Clear filters" />
          ) : (
            <Empty title="No stories are published yet." text="Be the first to publish on Palixia." href={publishHref} cta="Publish Your Story" />
          )
        )}
        {rows && rows.length > 0 && (
          <>
            <div className="grid discover-book-grid">{rows.map((b, index) => <div className="discover-book-reveal" key={b.id} style={{ "--discover-index": index % 12 }}><BookCard b={b} /></div>)}</div>
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
