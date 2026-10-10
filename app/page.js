'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PublishLink from '@/components/PublishLink';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fmtNum } from '@/lib/format';
import { genreStyle } from '@/lib/genres';
import Cover from '@/components/Cover';
import BookCard from '@/components/BookCard';
import Avatar from '@/components/Avatar';

export default function Home() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [genres, setGenres] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [continueReading, setContinueReading] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [recommendationNote, setRecommendationNote] = useState('');
  const [failed, setFailed] = useState(false);
  const [creatorBook, setCreatorBook] = useState(null);
  const [benefitIndex, setBenefitIndex] = useState(0);
  const publishBenefits = [
    { icon: '✦', title: 'Free to publish', text: 'Share your stories without a publishing fee.' },
    { icon: '♡', title: 'You keep your rights', text: 'Your original work remains yours.' },
    { icon: '⌕', title: 'Get discovered', text: 'Help new readers find your books and comics.' },
    { icon: '▤', title: 'Your own author page', text: 'Showcase your work in one place.' },
  ];

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      setData({ featured: [], trending: [], fresh: [] });
      setContinueReading([]);
      setRecommended([]);
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const [f, t, n, g, a, own] = await Promise.all([
          supabase.from('book_cards').select('*').eq('featured', true).order('reads', { ascending: false }).limit(6),
          supabase.from('book_cards').select('*').order('reads', { ascending: false }).limit(12),
          supabase.from('book_cards').select('*').order('created_at', { ascending: false }).limit(12),
          supabase.from('genres').select('*').order('sort'),
          supabase.rpc('popular_authors', { lim: 8 }),
          supabase.from('book_cards').select('*').ilike('author_name', 'Paul Osula').order('created_at', { ascending: false }).limit(1),
        ]);
        if (f.error || t.error || n.error) throw new Error('Could not load books');
        if (cancelled) return;

        const featured = f.data || [];
        const trending = t.data || [];
        const fresh = n.data || [];
        setData({ featured, trending, fresh });
        setGenres(g.data || []);
        setAuthors(a.data || []);
        setCreatorBook((own.data || [])[0] || (n.data || [])[0] || null);
        setFailed(false);

        if (!user) {
          setContinueReading([]);
          setRecommended([]);
          setRecommendationNote('');
          return;
        }

        const [pr, sv, fo] = await Promise.all([
          supabase.from('reading_progress').select('book_id,chapter_id,progress,updated_at')
            .eq('user_id', user.id).lt('progress', 100).order('updated_at', { ascending: false }).limit(8),
          supabase.from('bookmarks').select('book_id').eq('user_id', user.id).is('chapter_id', null),
          supabase.from('follows').select('author_id').eq('user_id', user.id),
        ]);
        if (pr.error || sv.error || fo.error) throw new Error('Could not load personalised books');

        const progressRows = pr.data || [];
        const savedIds = (sv.data || []).map((r) => r.book_id).filter(Boolean);
        const progressIds = progressRows.map((r) => r.book_id).filter(Boolean);
        const followedAuthors = new Set((fo.data || []).map((r) => r.author_id));
        const historyIds = [...new Set([...savedIds, ...progressIds])];

        let historyBooks = [];
        if (historyIds.length) {
          const historyResult = await supabase.from('book_cards').select('*').in('id', historyIds);
          if (historyResult.error) throw new Error('Could not load reading history');
          historyBooks = historyResult.data || [];
        }
        const historyById = new Map(historyBooks.map((b) => [b.id, b]));
        const continueRows = progressRows.map((row) => {
          const book = historyById.get(row.book_id);
          return book ? { ...book, progress: row.progress, chapter_id: row.chapter_id, updated_at: row.updated_at } : null;
        }).filter(Boolean);
        if (cancelled) return;
        setContinueReading(continueRows);

        const genreWeights = new Map();
        const tagWeights = new Map();
        for (const book of historyBooks) {
          if (book.genre_id) genreWeights.set(book.genre_id, (genreWeights.get(book.genre_id) || 0) + 2);
          for (const tag of (book.tags || [])) {
            const key = String(tag).toLowerCase().trim();
            if (key) tagWeights.set(key, (tagWeights.get(key) || 0) + 1);
          }
        }

        const candidatesResult = await supabase.from('book_cards').select('*').order('reads', { ascending: false }).limit(100);
        if (candidatesResult.error) throw new Error('Could not load recommendations');
        const alreadyKnown = new Set(historyIds);
        const candidates = (candidatesResult.data || []).filter((b) => !alreadyKnown.has(b.id));
        const hasHistory = genreWeights.size > 0 || tagWeights.size > 0 || followedAuthors.size > 0;
        const ranked = candidates.map((book) => {
          let score = 0;
          if (book.genre_id) score += genreWeights.get(book.genre_id) || 0;
          for (const tag of (book.tags || [])) score += tagWeights.get(String(tag).toLowerCase().trim()) || 0;
          if (followedAuthors.has(book.author_id)) score += 3;
          return { book, score };
        }).sort((x, y) => y.score - x.score || (y.book.reads || 0) - (x.book.reads || 0));
        if (cancelled) return;
        setRecommended(ranked.slice(0, 8).map((r) => r.book));
        setRecommendationNote(hasHistory
          ? 'Based on genres, tags and authors connected to your reading activity.'
          : 'Popular stories to get you started. Your picks will become more personal as you read and save books.');
      } catch (e) {
        console.error('[Palixia home] Could not load homepage:', e);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const featured = data && data.featured.length ? data.featured : data ? data.trending.slice(0, 3) : [];
  const picks = user ? (recommended.length ? recommended : (data ? data.trending.slice(0, 8) : [])) : [];

  return (
    <>
      <section className="homehero">
        <div className="homehero-copy">
          <span className="home-eyebrow">YOUR NEXT FAVOURITE STORY STARTS HERE</span>
          <h1>Stories worth staying up for.</h1>
          <p>Books and comics from African and diaspora creators. Read free, or publish your own.</p>
          <div className="row homehero-actions">
            <Link className="btn" href="/discover">Explore stories</Link>
            <PublishLink className="btn ghost">Publish your story</PublishLink>
          </div>
          <p className="homehero-free-note">Free to read. Free to publish.</p>
        </div>
        <div className="homehero-art" aria-hidden="true">
          <div className="hero-book hero-book-back"><span>NEW WORLDS</span><b>Find a story<br />that stays.</b></div>
          <div className="hero-book hero-book-front"><span>PALIXIA PICKS</span><b>Turn the<br />next page.</b><small>READ SOMETHING DIFFERENT</small></div>
          <div className="hero-spark">✦</div>
        </div>
      </section>

      <section className="publish-benefits">
        <div className="publish-benefits-intro">
          <span className="home-eyebrow">FOR THE STORYTELLERS</span>
          <h2 className="h2">Why publish on Palixia?</h2>
          <p className="fine">A place to share your work, build your presence, and help new readers discover your stories.</p>
        </div>
        <div className="publish-benefits-slider" aria-roledescription="carousel" aria-label="Reasons to publish on Palixia">
          <article className="publish-benefit-card" aria-live="polite">
            <span aria-hidden="true">{publishBenefits[benefitIndex].icon}</span>
            <div><h3>{publishBenefits[benefitIndex].title}</h3><p>{publishBenefits[benefitIndex].text}</p></div>
          </article>
          <div className="publish-benefits-controls">
            <button type="button" className="benefit-arrow" aria-label="Previous benefit" onClick={() => setBenefitIndex((i) => (i - 1 + publishBenefits.length) % publishBenefits.length)}>‹</button>
            <div className="benefit-dots" aria-label="Choose a benefit">
              {publishBenefits.map((benefit, i) => <button key={benefit.title} type="button" className={i === benefitIndex ? 'benefit-dot active' : 'benefit-dot'} aria-label={benefit.title} aria-pressed={i === benefitIndex} onClick={() => setBenefitIndex(i)} />)}
            </div>
            <button type="button" className="benefit-arrow" aria-label="Next benefit" onClick={() => setBenefitIndex((i) => (i + 1) % publishBenefits.length)}>›</button>
          </div>
        </div>
      </section>

      <section className="creator-week">
        <div className="creator-week-copy">
          <span className="home-eyebrow">CREATOR OF THE WEEK</span>
          {creatorBook ? (
            <>
              <h2 className="h2">{creatorBook.author_name || 'Meet a Palixia creator'}</h2>
              <p className="fine">Discover a story from the Palixia community.</p>
              <h3>{creatorBook.title}</h3>
              <p>{creatorBook.description || 'Discover this story on Palixia.'}</p>
              <Link className="btn" href={'/book/' + creatorBook.id}>Read the book</Link>
            </>
          ) : (
            <>
              <h2 className="h2">Your story could be next.</h2>
              <p className="fine">We're making room for creators and their stories. Publish your book or comic on Palixia and be part of the community.</p>
              <PublishLink className="btn">Publish your story</PublishLink>
            </>
          )}
        </div>
        {creatorBook && (
          <Link className="creator-week-cover" href={'/book/' + creatorBook.id} aria-label={'Read ' + creatorBook.title}>
            <Cover b={creatorBook} />
          </Link>
        )}
      </section>

      {!configured && <p className="notice">Palixia is not connected to its database yet. Follow the setup steps in README.md, then reload this page.</p>}
      {failed && <p className="notice">Some stories could not load right now. Please refresh the page and try again.</p>}
      {data === null && <p className="muted">Loading stories...</p>}

      {data && data.trending.length === 0 && configured && !failed && (
        <div className="empty">
          <div><b>No stories are published yet.</b><p>Be the first. Create an author account and publish a book or comic.</p></div>
          <PublishLink className="btn">Publish your story</PublishLink>
        </div>
      )}

      {user && continueReading.length > 0 && (
        <section>
          <div className="sechead"><div><h2 className="h2">Pick up where you left off</h2><p className="fine">Your reading, right where you stopped.</p></div><Link href="/library">Your library</Link></div>
          <div className="shelf">
            {continueReading.map((b) => (
              <Link key={b.id} href={b.chapter_id ? '/read/' + b.chapter_id : '/book/' + b.id} className="bcard continue-card">
                <Cover b={b} />
                <div><h3>{b.title}</h3><span className="sub">{b.author_name}</span><div className="progress"><b style={{ width: (b.progress || 0) + '%' }} /></div><span className="sub">{b.progress || 0}% read · Continue</span></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {user && (
        <section>
          <div className="sechead"><div><h2 className="h2">Picked for you</h2><p className="fine">{recommendationNote || 'Finding stories you might enjoy.'}</p></div><Link href="/discover">Explore all</Link></div>
          {picks.length > 0 ? <div className="shelf">{picks.map((b) => <BookCard key={b.id} b={b} />)}</div> : <p className="muted">More recommendations will appear as stories are published.</p>}
        </section>
      )}

      {featured.length > 0 && (
        <section>
          <div className="sechead"><div><h2 className="h2">Featured stories</h2><p className="fine">Stories worth a closer look.</p></div><Link href="/discover">Explore</Link></div>
          <div className="featured">
            {featured.map((b) => (
              <article className="fcard" key={b.id}>
                <Link href={'/book/' + b.id} aria-label={'Open ' + b.title}><Cover b={b} /></Link>
                <div><p className="mono">{b.genre_name || 'Story'}{b.book_type === 'comic' ? ' · Comic' : ''}</p><h3>{b.title}</h3><p className="fine">by {b.author_name}</p><p>{b.description}</p><Link className="btn small" href={'/book/' + b.id}>Read story</Link></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {data && data.trending.length > 0 && (
        <section><div className="sechead"><div><h2 className="h2">Trending now</h2><p className="fine">Popular with readers.</p></div><Link href="/discover?sort=most_read">See all</Link></div><div className="shelf">{data.trending.map((b) => <BookCard key={b.id} b={b} />)}</div></section>
      )}

      <section className="home-games-card">
        <div className="home-games-art" aria-hidden="true">🎮</div>
        <div className="home-games-copy">
          <span className="home-eyebrow">TAKE A STORY BREAK</span>
          <h2 className="h2">Read. Play. Repeat.</h2>
          <p>Test your book knowledge, guess the story, and explore books from the Palixia community.</p>
        </div>
        <Link className="btn home-games-button" href="/games">Explore Palixia Games <span aria-hidden="true">→</span></Link>
      </section>

      {data && data.fresh.length > 0 && (
        <section><div className="sechead"><div><h2 className="h2">Just released</h2><p className="fine">Fresh stories and new chapters to discover.</p></div><Link href="/discover?sort=newest">See all</Link></div><div className="shelf">{data.fresh.map((b) => <BookCard key={b.id} b={b} />)}</div></section>
      )}

      {genres.length > 0 && (
        <section><div className="sechead"><div><h2 className="h2">Find your kind of story</h2><p className="fine">Browse by the mood or genre you love.</p></div><Link href="/categories">All genres</Link></div><div className="genres">{genres.map((g) => <Link key={g.id} href={'/discover?genre=' + g.slug} className="gcard" style={genreStyle(g.slug)}>{g.name}</Link>)}</div></section>
      )}

      {authors.length > 0 && (
        <section><div className="sechead"><div><h2 className="h2">Meet the authors</h2><p className="fine">Follow writers and keep up with their work.</p></div><Link href="/authors">All authors</Link></div><div className="authors">{authors.map((a) => <Link key={a.id} href={'/author/' + a.username} className="acard"><Avatar src={a.avatar_url} name={a.name} size="4.2rem" /><b>{a.name}</b><span className="fine">{fmtNum(a.total_reads)} reads</span></Link>)}</div></section>
      )}

      <section className="home-cta"><div><span className="home-eyebrow">MADE FOR STORYTELLERS</span><h2>Your story deserves readers.</h2><p>Publish your work, grow your audience, and give readers something new to love.</p></div><PublishLink className="btn">Start publishing</PublishLink></section>
    </>
  );
}
