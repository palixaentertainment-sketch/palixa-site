'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';
import Cover from '@/components/Cover';
import Empty from '@/components/Empty';

const TABS = [['reading', 'Currently Reading'], ['saved', 'Saved'], ['history', 'Reading History'], ['journey', 'Reading Journey']];

function cardFields(b) {
  return {
    id: b.id,
    title: b.title,
    cover_url: b.cover_url,
    book_type: b.book_type,
    is_sample: b.is_sample,
    author_name: b.profiles ? b.profiles.name : '',
  };
}

function Shelf() {
  const { user } = useAuth();
  const [tab, setTab] = useState('reading');
  const [reading, setReading] = useState(null);
  const [saved, setSaved] = useState(null);
  const [failed, setFailed] = useState(false);
  const [journey, setJourney] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        // Fetch progress and saved-book rows separately from book/author details.
        // Deep nested Supabase joins can fail when relationship metadata is stale.
        const [pr, sv] = await Promise.all([
          supabase.from('reading_progress')
            .select('book_id,chapter_id,progress,updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false }),
          supabase.from('bookmarks')
            .select('book_id,created_at')
            .eq('user_id', user.id)
            .is('chapter_id', null)
            .order('created_at', { ascending: false }),
        ]);

        if (pr.error) throw new Error('Reading progress: ' + pr.error.message);
        if (sv.error) throw new Error('Saved books: ' + sv.error.message);

        const progressRows = pr.data || [];
        const savedRows = sv.data || [];
        const ids = [...new Set([...progressRows, ...savedRows].map((r) => r.book_id).filter(Boolean))];
        let books = [];
        if (ids.length) {
          const br = await supabase.from('books')
            .select('id,title,cover_url,book_type,is_sample,status,author_id')
            .in('id', ids);
          if (br.error) throw new Error('Book details: ' + br.error.message);
          books = br.data || [];
        }

        const authorIds = [...new Set(books.map((b) => b.author_id).filter(Boolean))];
        let profiles = [];
        if (authorIds.length) {
          const ar = await supabase.from('profiles').select('id,name').in('id', authorIds);
          if (ar.error) throw new Error('Author details: ' + ar.error.message);
          profiles = ar.data || [];
        }

        const authorById = Object.fromEntries(profiles.map((p) => [p.id, p]));
        const bookById = Object.fromEntries(books.map((b) => [
          b.id,
          { ...b, profiles: authorById[b.author_id] ? { name: authorById[b.author_id].name } : null },
        ]));
        const visible = (row) => {
          const book = bookById[row.book_id];
          return book && book.status === 'published' ? { ...row, books: book } : null;
        };

        if (!cancelled) {
          setReading(progressRows.map(visible).filter(Boolean));
          setSaved(savedRows.map(visible).filter(Boolean));
          setFailed(false);
        }
      } catch (error) {
        console.error('[Palixia library] Could not load library:', error);
        if (!cancelled) {
          setFailed(true);
          setReading([]);
          setSaved([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setJourney(null);
    (async () => {
      try {
        const [activityResult, followsResult] = await Promise.all([
          supabase.from('reading_activity')
            .select('book_id,chapter_id,activity_date')
            .eq('user_id', user.id)
            .order('activity_date', { ascending: false }),
          supabase.from('follows')
            .select('author_id')
            .eq('user_id', user.id),
        ]);
        if (activityResult.error) throw activityResult.error;
        if (followsResult.error) throw followsResult.error;

        const followedIds = [...new Set((followsResult.data || []).map((row) => row.author_id).filter(Boolean))];
        let authors = [];
        if (followedIds.length) {
          const profileResult = await supabase.from('profiles')
            .select('id,name,username')
            .in('id', followedIds);
          if (profileResult.error) throw profileResult.error;
          authors = profileResult.data || [];
        }

        if (!cancelled) {
          setJourney({
            activity: activityResult.data || [],
            authors,
            monthStart: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10),
            failed: false,
          });
        }
      } catch (error) {
        console.error('[Palixia Reading Journey] Could not load stats:', error);
        if (!cancelled) setJourney({ activity: [], authors: [], failed: true });
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const current = reading ? reading.filter((r) => r.progress < 100) : null;
  const completed = reading ? reading.filter((r) => r.progress >= 100) : [];
  const activity = journey ? journey.activity : [];
  const monthActivity = journey && journey.monthStart
    ? activity.filter((row) => row.activity_date >= journey.monthStart)
    : [];
  const uniqueChapters = new Set(activity.map((row) => row.chapter_id)).size;
  const monthBooks = new Set(monthActivity.map((row) => row.book_id)).size;


  return (
    <>
      <h1 className="h1">Your library</h1>
      <div className="chips" role="tablist" aria-label="Library sections">
        {TABS.map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} className="chip" aria-pressed={tab === v} onClick={() => setTab(v)}>{label}</button>
        ))}
      </div>
      {failed && <p className="notice">We could not load your library. Please refresh the page. If the problem continues, the library database request needs checking.</p>}
      {reading === null && <p className="muted">Loading...</p>}

      {tab === 'reading' && current && (
        current.length === 0 ? (
          <Empty title="Your library is empty." text="Open a book and start reading. It will appear here with your progress." href="/discover" cta="Discover Stories" />
        ) : (
          <div>
            {current.map((r) => (
              <div className="libitem" key={r.book_id}>
                <Link href={'/book/' + r.book_id}><Cover b={cardFields(r.books)} /></Link>
                <div className="stack" style={{ gap: '0.5rem' }}>
                  <h3>{r.books.title}</h3>
                  <p className="fine">{r.books.profiles ? r.books.profiles.name : ''}</p>
                  <div className="progress" aria-hidden="true"><b style={{ width: r.progress + '%' }} /></div>
                  <p className="fine">{r.progress}% read</p>
                  <div><Link className="btn small" href={r.chapter_id ? '/read/' + r.chapter_id : '/book/' + r.book_id}>Continue reading</Link></div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'saved' && saved && (
        saved.length === 0 ? (
          <Empty title="No saved books." text="Tap Save on any book page to keep it here." href="/discover" cta="Discover Stories" />
        ) : (
          <div className="grid">
            {saved.map((r) => (
              <Link key={r.book_id} href={'/book/' + r.book_id} className="bcard">
                <Cover b={cardFields(r.books)} />
                <h3>{r.books.title}</h3>
                <span className="sub">{r.books.profiles ? r.books.profiles.name : ''}</span>
              </Link>
            ))}
          </div>
        )
      )}

      {tab === 'journey' && (
        <section className="stack" style={{ gap: '1rem' }}>
          <p className="muted">Your reading stats are private. Only you can see this page.</p>
          {journey && journey.failed ? (
            <div className="notice">
              Reading Journey needs its database setup before your activity can appear. Your other Library tabs will keep working normally.
            </div>
          ) : journey === null || reading === null ? (
            <p className="muted">Loading your Reading Journey...</p>
          ) : (
            <>
              <h2 className="h2">Your reading at a glance</h2>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.75rem' }}>
                {[
                  ['Books completed', completed.length],
                  ['Chapters opened', uniqueChapters],
                  ['Authors followed', journey.authors.length],
                  ['Books this month', monthBooks],
                ].map(([label, value]) => (
                  <div key={label} className="bcard" style={{ padding: '1rem', minWidth: 0 }}>
                    <p className="fine" style={{ margin: 0 }}>{label}</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.35rem 0 0' }}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="stack" style={{ gap: '0.5rem' }}>
                <h2 className="h2">This month</h2>
                <div className="notice">
                  {monthActivity.length === 0
                    ? 'Your next reading session will start your monthly recap.'
                    : `You opened ${new Set(monthActivity.map((row) => row.chapter_id)).size} chapters across ${monthBooks} ${monthBooks === 1 ? 'book' : 'books'} this month.`}
                  {' '}{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.
                </div>
              </div>

              <div className="stack" style={{ gap: '0.5rem' }}>
                <h2 className="h2">Reading milestones</h2>
                <div className="stack" style={{ gap: '0.5rem' }}>
                  {[
                    [completed.length >= 1, 'First book completed', 'Finish your first book to unlock this milestone.'],
                    [completed.length >= 5, 'Five books completed', 'Keep reading to reach five completed books.'],
                    [uniqueChapters >= 10, 'Ten chapters explored', 'Open ten different chapters to unlock this milestone.'],
                  ].map(([unlocked, title, hint]) => (
                    <div key={title} className="notice" style={{ opacity: unlocked ? 1 : 0.75 }}>
                      <strong>{unlocked ? '✓ ' : '○ '}{title}</strong>
                      {!unlocked && <p className="fine" style={{ margin: '0.25rem 0 0' }}>{hint}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="stack" style={{ gap: '0.5rem' }}>
                <h2 className="h2">Authors you follow</h2>
                {journey.authors.length === 0 ? (
                  <p className="muted">Follow authors whose stories you want to keep up with. They’ll appear here.</p>
                ) : (
                  <div className="chips">
                    {journey.authors.map((author) => (
                      <Link key={author.id} className="chip" href={'/author/' + author.username}>{author.name}</Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'history' && reading && (
        reading.length === 0 ? (
          <Empty title="Nothing here yet." text="Books you open will show up in your reading history." href="/discover" cta="Discover Stories" />
        ) : (
          <ol className="chap">
            {reading.map((r) => (
              <li key={r.book_id}>
                <Link href={'/book/' + r.book_id} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                  <span>{r.books.title}</span>
                  <span className="fine">{new Date(r.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                </Link>
              </li>
            ))}
          </ol>
        )
      )}
    </>
  );
}

export default function Library() {
  return <Guard><Shelf /></Guard>;
}
