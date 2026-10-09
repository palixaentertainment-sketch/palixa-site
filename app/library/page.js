'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';
import Cover from '@/components/Cover';
import Empty from '@/components/Empty';

const TABS = [['reading', 'Currently Reading'], ['saved', 'Saved'], ['history', 'Reading History']];

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

  useEffect(() => {
    if (!user) return;
    (async () => {
      const sel = 'id,title,cover_url,book_type,is_sample,status,profiles(name)';
      const [pr, sv] = await Promise.all([
        supabase.from('reading_progress').select('book_id,chapter_id,progress,updated_at,books(' + sel + ')').eq('user_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('bookmarks').select('book_id,created_at,books(' + sel + ')').eq('user_id', user.id).is('chapter_id', null).order('created_at', { ascending: false }),
      ]);
      if (pr.error || sv.error) { setFailed(true); setReading([]); setSaved([]); return; }
      setReading((pr.data || []).filter((r) => r.books && r.books.status === 'published'));
      setSaved((sv.data || []).filter((r) => r.books && r.books.status === 'published'));
    })();
  }, [user]);

  const current = reading ? reading.filter((r) => r.progress < 100) : null;

  return (
    <>
      <h1 className="h1">Your library</h1>
      <div className="chips" role="tablist" aria-label="Library sections">
        {TABS.map(([v, label]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} className="chip" aria-pressed={tab === v} onClick={() => setTab(v)}>{label}</button>
        ))}
      </div>
      {failed && <p className="notice">We could not load your library. Check your connection and refresh.</p>}
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
