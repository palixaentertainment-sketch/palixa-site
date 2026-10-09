'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PublishLink from '@/components/PublishLink';
import { supabase, configured } from '@/lib/supabase';
import { fmtNum } from '@/lib/format';
import { genreStyle } from '@/lib/genres';
import Cover from '@/components/Cover';
import BookCard from '@/components/BookCard';
import Avatar from '@/components/Avatar';

export default function Home() {
  const [data, setData] = useState(null);
  const [genres, setGenres] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!configured) { setData({ featured: [], trending: [], fresh: [] }); return; }
    (async () => {
      try {
        const [f, t, n, g, a] = await Promise.all([
          supabase.from('book_cards').select('*').eq('featured', true).order('reads', { ascending: false }).limit(6),
          supabase.from('book_cards').select('*').order('reads', { ascending: false }).limit(10),
          supabase.from('book_cards').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('genres').select('*').order('sort'),
          supabase.rpc('popular_authors', { lim: 8 }),
        ]);
        if (f.error || t.error || n.error) throw new Error('load');
        setData({ featured: f.data || [], trending: t.data || [], fresh: n.data || [] });
        setGenres(g.data || []);
        setAuthors(a.data || []);
      } catch (e) {
        setFailed(true);
        setData({ featured: [], trending: [], fresh: [] });
      }
    })();
  }, []);

  const heroBooks = data ? (data.featured.length ? data.featured : data.trending).slice(0, 3) : [];
  const featured = data && data.featured.length ? data.featured : data ? data.trending.slice(0, 3) : [];

  return (
    <>
      <section className="hero">
        <div>
          <h1 className="sr-only">Palixia</h1>
          <div className="row">
            <Link className="btn" href="/discover">Start Reading</Link>
            <PublishLink className="btn ghost">Publish Your Story</PublishLink>
          </div>
        </div>
        {heroBooks.length > 0 && (
          <div className="herocovers" aria-hidden="true">
            {heroBooks.map((b) => <Cover key={b.id} b={b} />)}
          </div>
        )}
      </section>

      {!configured && (
        <p className="notice">Palixia is not connected to its database yet. Follow the setup steps in README.md, then reload this page.</p>
      )}
      {failed && <p className="notice">We could not load stories right now. Check your connection and refresh.</p>}
      {data === null && <p className="muted">Loading stories...</p>}

      {data && data.trending.length === 0 && configured && !failed && (
        <div className="empty">
          <div>
            <b>No stories are published yet.</b>
            <p>Be the first. Create an author account and publish a book or comic.</p>
          </div>
          <PublishLink className="btn">Publish Your Story</PublishLink>
        </div>
      )}

      {featured.length > 0 && (
        <section>
          <div className="sechead"><h2 className="h2">Featured</h2></div>
          <div className="featured">
            {featured.map((b) => (
              <article className="fcard" key={b.id}>
                <Link href={'/book/' + b.id} aria-label={'Open ' + b.title}><Cover b={b} /></Link>
                <div>
                  <p className="mono">{b.genre_name || 'Story'}{b.book_type === 'comic' ? ' · Comic' : ''}</p>
                  <h3>{b.title}</h3>
                  <p className="fine">by {b.author_name}</p>
                  <p>{b.description}</p>
                  <Link className="btn small" href={'/book/' + b.id}>Read</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {data && data.trending.length > 0 && (
        <section>
          <div className="sechead"><h2 className="h2">Trending</h2><Link href="/discover?sort=most_read">See all</Link></div>
          <div className="shelf">
            {data.trending.map((b) => <BookCard key={b.id} b={b} />)}
          </div>
        </section>
      )}

      {data && data.fresh.length > 0 && (
        <section>
          <div className="sechead"><h2 className="h2">New releases</h2><Link href="/discover?sort=newest">See all</Link></div>
          <div className="shelf">
            {data.fresh.map((b) => <BookCard key={b.id} b={b} />)}
          </div>
        </section>
      )}

      {genres.length > 0 && (
        <section>
          <div className="sechead"><h2 className="h2">Discover by genre</h2><Link href="/categories">All categories</Link></div>
          <div className="genres">
            {genres.map((g) => (
              <Link key={g.id} href={'/discover?genre=' + g.slug} className="gcard" style={genreStyle(g.slug)}>{g.name}</Link>
            ))}
          </div>
        </section>
      )}

      {authors.length > 0 && (
        <section>
          <div className="sechead"><h2 className="h2">Popular authors</h2><Link href="/authors">All authors</Link></div>
          <div className="authors">
            {authors.map((a) => (
              <Link key={a.id} href={'/author/' + a.username} className="acard">
                <Avatar src={a.avatar_url} name={a.name} size="4.2rem" />
                <b>{a.name}</b>
                <span className="fine">{fmtNum(a.total_reads)} reads</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="cta">
        <h2 className="h2">Your story deserves readers.</h2>
        <PublishLink className="btn">Publish with Palixia</PublishLink>
      </section>
    </>
  );
}
