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
import PalixiaFridaysBanner from '@/components/PalixiaFridaysBanner';
import HomepagePromotionalBanners from '@/components/HomepagePromotionalBanners';
import ComingSoonPreview from '@/components/ComingSoonPreview';
import PalixiaDaily from '@/components/PalixiaDaily';

// Keep catalogue list queries lean: the view also exposes computed chapter_count/search fields.
const BOOK_CARD_FIELDS = 'id,author_id,title,description,cover_url,book_type,tags,reads,featured,is_sample,created_at,genre_id,genre_name,genre_slug,author_name,author_username,author_avatar,story_status';

export default function Home() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [featuredStories, setFeaturedStories] = useState([]);
  const [freshStories, setFreshStories] = useState([]);
  const [originals, setOriginals] = useState([]);
  const [genres, setGenres] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [continueReading, setContinueReading] = useState([]);
  const [followedUpdates, setFollowedUpdates] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [recommendationNote, setRecommendationNote] = useState('');
  const [failed, setFailed] = useState(false);
  const [creatorBook, setCreatorBook] = useState(null);
  const [creatorDescriptionExpanded, setCreatorDescriptionExpanded] = useState(false);
  const [benefitIndex, setBenefitIndex] = useState(0);
  const [comingSoonBooks, setComingSoonBooks] = useState([]);
  const publishBenefits = [
    { icon: '✦', title: 'Free to publish', text: 'Share your stories without a publishing fee.' },
    { icon: '♡', title: 'You keep your rights', text: 'Your original work remains yours.' },
    { icon: '⌕', title: 'Get discovered', text: 'Help new readers find your books and stories.' },
    { icon: '▤', title: 'Your own author page', text: 'Showcase your work in one place.' },
    { icon: '♡', title: 'Earn through reader support', text: 'Readers can support authors through Palixia Sparks.' },
  ];

  useEffect(() => {
    let cancelled = false;
    if (!configured) return () => { cancelled = true; };
    supabase.from('coming_soon_books')
      .select('id,title,author_name,description,cover_url,release_date')
      .eq('status', 'upcoming')
      .order('release_date', { ascending: true, nullsFirst: false })
      .limit(4)
      .then(({ data, error }) => {
        if (!cancelled && !error) setComingSoonBooks(data || []);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      setData({ trending: [] });
      setFeaturedStories([]);
      setFreshStories([]);
      setContinueReading([]);
      setFollowedUpdates([]);
      setRecommended([]);
      return () => { cancelled = true; };
    }

    // Fetch the primary homepage shelf first. The page no longer waits for every
    // secondary section, author lookup, or personalized recommendation query.
    (async () => {
      try {
        const { data: trendingData, error: trendingError } = await supabase
          .from('book_cards')
          .select(BOOK_CARD_FIELDS)
          .order('reads', { ascending: false })
          .limit(8);
        if (trendingError) throw trendingError;
        if (cancelled) return;
        setData({ trending: trendingData || [] });
        setFailed(false);
      } catch (error) {
        console.error('[Palixia home] Primary stories could not load:', error);
        if (!cancelled) setFailed(true);
      }
    })();

    // Secondary homepage content is independent: slow sections must not hold back
    // the first visible book shelf.
    const loadOptional = (label, query, apply) => {
      Promise.resolve(query).then(({ data: resultData, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[Palixia home] ' + label + ' could not load:', error);
          return;
        }
        apply(resultData || []);
      }).catch((error) => {
        if (!cancelled) console.warn('[Palixia home] ' + label + ' could not load:', error);
      });
    };

    loadOptional('Featured stories',
      supabase.from('book_cards').select(BOOK_CARD_FIELDS).eq('featured', true).order('reads', { ascending: false }).limit(6),
      (featuredData) => setFeaturedStories(featuredData));
    loadOptional('Fresh stories',
      supabase.from('book_cards').select(BOOK_CARD_FIELDS).order('created_at', { ascending: false }).limit(8),
      (freshData) => setFreshStories(freshData));
    loadOptional('Genres',
      supabase.from('genres').select('*').order('sort'),
      (genreData) => {
        const homepageGenreSlugs = new Set(['romance', 'thriller', 'crime', 'mystery', 'fantasy', 'horror', 'drama', 'sci-fi', 'short-stories']);
        setGenres(genreData.filter((genre) => homepageGenreSlugs.has(genre.slug)));
      });
    loadOptional('Popular authors',
      supabase.rpc('popular_authors', { lim: 8 }),
      (authorData) => setAuthors(authorData));
    loadOptional('Palixia Originals',
      supabase.from('palixia_originals_home_cards_v2').select(BOOK_CARD_FIELDS).order('created_at', { ascending: false }).limit(8),
      (originalData) => setOriginals(originalData));

    supabase.from('creator_of_week').select('book_id').eq('id', true).maybeSingle()
      .then(async ({ data: creatorSelection, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[Palixia home] Creator of the Week selection could not load:', error);
          return;
        }
        const selectedBookId = creatorSelection?.book_id;
        if (!selectedBookId) {
          setCreatorBook(null);
          return;
        }
        const { data: selected, error: selectedError } = await supabase
          .from('book_cards').select(BOOK_CARD_FIELDS).eq('id', selectedBookId).maybeSingle();
        if (cancelled) return;
        if (selectedError) console.warn('[Palixia home] Creator of the Week book could not load:', selectedError);
        else if (selected) setCreatorBook(selected);
      })
      .catch((error) => {
        if (!cancelled) console.warn('[Palixia home] Creator of the Week could not load:', error);
      });

    // Personalized shelves are only requested for signed-in readers and run in the
    // background, so their larger queries never block the public homepage.
    if (!user) {
      setContinueReading([]);
      setFollowedUpdates([]);
      setRecommended([]);
      setRecommendationNote('');
    } else {
      (async () => {
        try {
          const [progressResult, savedResult, followsResult, finishedResult, candidatesResult] = await Promise.all([
            supabase.from('reading_progress').select('book_id,chapter_id,progress,updated_at')
              .eq('user_id', user.id).lt('progress', 100).order('updated_at', { ascending: false }).limit(8),
            supabase.from('bookmarks').select('book_id').eq('user_id', user.id).is('chapter_id', null).limit(100),
            supabase.from('follows').select('author_id').eq('user_id', user.id).limit(100),
            supabase.from('reading_progress').select('book_id').eq('user_id', user.id).eq('progress', 100).limit(100),
            supabase.from('book_cards').select(BOOK_CARD_FIELDS).order('reads', { ascending: false }).limit(30),
          ]);
          if (cancelled) return;
          if (progressResult.error || savedResult.error || followsResult.error) {
            throw new Error('Personalized reading data could not load');
          }

          const progressRows = progressResult.data || [];
          const savedIds = (savedResult.data || []).map((row) => row.book_id).filter(Boolean);
          const progressIds = progressRows.map((row) => row.book_id).filter(Boolean);
          const finishedIds = finishedResult.error ? [] : (finishedResult.data || []).map((row) => row.book_id).filter(Boolean);
          const followedAuthors = new Set((followsResult.data || []).map((row) => row.author_id));
          const historyIds = [...new Set([...savedIds, ...progressIds, ...finishedIds])];

          const [historyResult, followedBooksResult] = await Promise.all([
            historyIds.length
              ? supabase.from('book_cards').select(BOOK_CARD_FIELDS).in('id', historyIds)
              : Promise.resolve({ data: [], error: null }),
            followedAuthors.size
              ? supabase.from('book_cards').select('id,title,cover_url,book_type,is_sample,author_id,author_name').in('author_id', [...followedAuthors]).limit(100)
              : Promise.resolve({ data: [], error: null }),
          ]);
          if (cancelled) return;
          if (historyResult.error) throw new Error('Reading history could not load');
          const historyBooks = historyResult.data || [];
          const historyById = new Map(historyBooks.map((book) => [book.id, book]));
          const continueRows = progressRows.map((row) => {
            const book = historyById.get(row.book_id);
            return book ? { ...book, progress: row.progress, chapter_id: row.chapter_id, updated_at: row.updated_at } : null;
          }).filter(Boolean);
          setContinueReading(continueRows);

          setFollowedUpdates([]);
          if (!followedBooksResult.error && followedBooksResult.data?.length) {
            const followedBooks = followedBooksResult.data;
            const followedBookIds = followedBooks.map((book) => book.id).filter(Boolean);
            if (followedBookIds.length) {
              const chapterResult = await supabase.from('chapters')
                .select('id,book_id,title,updated_at').in('book_id', followedBookIds)
                .eq('status', 'published').order('updated_at', { ascending: false }).limit(8);
              if (!cancelled && !chapterResult.error) {
                const bookById = new Map(followedBooks.map((book) => [book.id, book]));
                setFollowedUpdates((chapterResult.data || []).map((chapter) => {
                  const book = bookById.get(chapter.book_id);
                  return book ? {
                    ...chapter,
                    book_title: book.title,
                    cover_url: book.cover_url,
                    book_type: book.book_type,
                    is_sample: book.is_sample,
                    author_name: book.author_name || '',
                  } : null;
                }).filter(Boolean));
              }
            }
          } else if (followedBooksResult.error) {
            console.warn('[Palixia home] Followed-author books could not load:', followedBooksResult.error);
          }

          if (candidatesResult.error) {
            console.warn('[Palixia home] Recommendation candidates could not load:', candidatesResult.error);
            setRecommended([]);
            return;
          }
          const genreWeights = new Map();
          const tagWeights = new Map();
          for (const book of historyBooks) {
            if (book.genre_id) genreWeights.set(book.genre_id, (genreWeights.get(book.genre_id) || 0) + 2);
            for (const tag of (book.tags || [])) {
              const key = String(tag).toLowerCase().trim();
              if (key) tagWeights.set(key, (tagWeights.get(key) || 0) + 1);
            }
          }
          const alreadyKnown = new Set(historyIds);
          const candidates = (candidatesResult.data || []).filter((book) => !alreadyKnown.has(book.id));
          const hasHistory = genreWeights.size > 0 || tagWeights.size > 0 || followedAuthors.size > 0;
          const ranked = candidates.map((book) => {
            let score = 0;
            if (book.genre_id) score += genreWeights.get(book.genre_id) || 0;
            for (const tag of (book.tags || [])) score += tagWeights.get(String(tag).toLowerCase().trim()) || 0;
            if (followedAuthors.has(book.author_id)) score += 3;
            return { book, score };
          }).sort((left, right) => right.score - left.score || (right.book.reads || 0) - (left.book.reads || 0));
          if (cancelled) return;
          setRecommended(ranked.slice(0, 8).map((item) => item.book));
          setRecommendationNote(hasHistory
            ? 'Based on genres, tags and authors connected to your reading activity.'
            : 'Popular stories to get you started. Your picks will become more personal as you read and save books.');
        } catch (error) {
          console.warn('[Palixia home] Personalized shelves could not load:', error);
        }
      })();
    }

    return () => { cancelled = true; };
  }, [user?.id]);

  const featured = data && featuredStories.length ? featuredStories : data ? data.trending.slice(0, 3) : [];
  const picks = user ? (recommended.length ? recommended : (data ? data.trending.slice(0, 8) : [])) : [];

  return (
    <>
      <section className="homehero">
        <div className="homehero-copy">
          <span className="home-eyebrow">A HOME FOR INDEPENDENT STORIES</span>
          <h1>Every story deserves a reader.</h1>
          <p>Discover original stories from independent authors around the world. Find your next favourite, keep your place as you read, and follow the writers you love.</p>
          <div className="row homehero-actions">
            <Link className="btn" href="/discover">Find your next read</Link>
            <PublishLink className="btn ghost">Publish your story</PublishLink>
          </div>
          <p className="homehero-free-note">Read for free. Publishing is free too. Readers can support the authors they love through Sparks.</p>
        </div>
        <div className="homehero-art" aria-hidden="true">
          <div className="hero-book hero-book-back"><span>NEW WORLDS</span><b>Find a story<br />that stays.</b></div>
          <div className="hero-book hero-book-front"><span>PALIXIA PICKS</span><b>Turn the<br />next page.</b><small>READ SOMETHING DIFFERENT</small></div>
          <div className="hero-spark">✦</div>
        </div>
      </section>

      <PalixiaDaily />

      <HomepagePromotionalBanners />

      <PalixiaFridaysBanner />

      {comingSoonBooks.length > 0 && (
        <section>
          <div className="sechead"><div><h2 className="h2">Coming Soon</h2><p className="fine">A first look at stories on the way.</p></div></div>
          <div className="shelf">
            {comingSoonBooks.map((b) => (
              <article key={b.id} className="bcard">
                <div style={{ position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden', borderRadius: '.5rem', background: 'var(--soft)' }}>
                  <img src={b.cover_url} alt={b.title + ' cover'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  <span style={{ position: 'absolute', top: '.5rem', left: '.5rem', background: 'var(--accent)', color: 'white', borderRadius: '999px', padding: '.25rem .5rem', fontSize: '.68rem', fontWeight: 700 }}>COMING SOON</span>
                </div>
                <div><h3>{b.title}</h3><span className="sub">{b.author_name}</span>{b.release_date && <p className="sub">Expected {new Date(b.release_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</p>}<ComingSoonPreview book={b} /></div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="publish-benefits">
        <div className="publish-benefits-intro">
          <span className="home-eyebrow">FOR THE STORYTELLERS</span>
          <h2 className="h2">Why publish on Palixia?</h2>
          <p className="fine">Share your work, reach new readers, and build your place in a community that loves stories.</p>
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
              <p className={creatorDescriptionExpanded ? 'creator-week-description expanded' : 'creator-week-description'}>{creatorBook.description || 'Discover this story on Palixia.'}</p>
              {(creatorBook.description || '').length > 140 && <button type="button" className="creator-week-read-more" aria-expanded={creatorDescriptionExpanded} onClick={() => setCreatorDescriptionExpanded((expanded) => !expanded)}>{creatorDescriptionExpanded ? 'Read less' : 'Read more'}</button>}
              <Link className="btn small" href={'/book/' + creatorBook.id}>Read the book</Link>
            </>
          ) : (
            <>
              <h2 className="h2">Your story could be next.</h2>
              <p className="fine">We're making room for creators and their stories. Publish your book on Palixia and be part of the community.</p>
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
          <div><b>No stories are published yet.</b><p>Be the first. Create an author account and publish a book.</p></div>
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

      {user && followedUpdates.length > 0 && (
        <section>
          <div className="sechead">
            <div><h2 className="h2">New chapters from authors you follow</h2><p className="fine">The writers you follow have added something new.</p></div>
            <Link href="/library">Your library</Link>
          </div>
          <div className="shelf">
            {followedUpdates.map((chapter) => (
              <Link key={chapter.id} href={'/read/' + chapter.id} className="bcard">
                <Cover b={{ id: chapter.book_id, title: chapter.book_title, cover_url: chapter.cover_url, book_type: chapter.book_type, is_sample: chapter.is_sample, author_name: chapter.author_name }} />
                <div>
                  <h3>{chapter.book_title}</h3>
                  <span className="sub">{chapter.author_name}</span>
                  <span className="sub">{chapter.title || 'New chapter'}</span>
                  <span className="sub">Read new chapter →</span>
                </div>
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
          <div className="sechead"><div><h2 className="h2">Featured stories</h2><p className="fine">A few stories we think you should know.</p></div><Link href="/discover">Explore</Link></div>
          <div className="featured">
            {featured.map((b) => (
              <article className="fcard" key={b.id}>
                <Link href={'/book/' + b.id} aria-label={'Open ' + b.title}><Cover b={b} /></Link>
                <div><p className="mono">{b.genre_name || 'Story'}</p><h3>{b.title}</h3><p className="fine">by {b.author_name}</p><p>{b.description}</p><Link className="btn small" href={'/book/' + b.id}>Read story</Link></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {originals.length > 0 && (
        <section className="palixia-originals">
          <div className="sechead"><div><h2 className="h2">Palixia Originals</h2><p className="fine">Stories created by Palixia, made for our readers.</p></div><Link href="/discover">Explore stories</Link></div>
          <div className="shelf">{originals.map((b) => <BookCard key={b.id} b={b} badge="PALIXIA ORIGINAL" />)}</div>
        </section>
      )}

      {data && data.trending.length > 0 && (
        <section><div className="sechead"><div><h2 className="h2">Trending now</h2><p className="fine">Popular with readers.</p></div><Link href="/discover?sort=most_read">See all</Link></div><div className="shelf">{data.trending.map((b) => <BookCard key={b.id} b={b} />)}</div></section>
      )}

      {freshStories.length > 0 && (
        <section><div className="sechead"><div><h2 className="h2">Just released</h2><p className="fine">Fresh stories and new chapters to discover.</p></div><Link href="/discover?sort=newest">See all</Link></div><div className="shelf">{freshStories.map((b) => <BookCard key={b.id} b={b} />)}</div></section>
      )}

      {genres.length > 0 && (
        <section><div className="sechead"><div><h2 className="h2">Find your kind of story</h2><p className="fine">Browse by the mood or genre you love.</p></div><Link href="/categories">All genres</Link></div><div className="genres">{genres.map((g) => <Link key={g.id} href={'/discover?genre=' + g.slug} className="gcard" style={genreStyle(g.slug)}>{g.name}</Link>)}</div></section>
      )}



      <section className="home-cta"><div><span className="home-eyebrow">MADE FOR STORYTELLERS</span><h2>Have a story to share?</h2><p>Publish for free and let readers around the world discover your work.</p></div><PublishLink className="btn">Start publishing</PublishLink></section>
    </>
  );
}
