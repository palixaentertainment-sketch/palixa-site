'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { friendly } from '@/lib/errors';
import LikeButton from '@/components/LikeButton';
import Comments from '@/components/Comments';

function load(key, fallback) {
  try { const v = window.localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
}
function store(key, value) {
  try { window.localStorage.setItem(key, String(value)); } catch (e) { /* storage unavailable, ignore */ }
}

export default function Reader() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ch, setCh] = useState(undefined);
  const [book, setBook] = useState(null);
  const [sibs, setSibs] = useState([]);
  const [pages, setPages] = useState([]);
  const [theme, setTheme] = useState('light');
  const [size, setSize] = useState(1.1);
  const [panel, setPanel] = useState(false);
  const [marked, setMarked] = useState(false);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState('');
  const barRef = useRef(null);
  const frac = useRef(0);
  const saveTimer = useRef(null);
  const restore = useRef(null);

  useEffect(() => {
    setTheme(load('palixa-rtheme', 'light') === 'dark' ? 'dark' : 'light');
    const s = parseFloat(load('palixa-rsize', '1.1'));
    if (s >= 0.9 && s <= 1.7) setSize(s);
  }, []);

  const fetchAll = useCallback(async () => {
    setCh(undefined);
    const { data, error } = await supabase
      .from('chapters')
      .select('id,book_id,chapter_number,title,content,status,like_count')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) { setCh(null); return; }
    const { data: b } = await supabase.from('books').select('id,title,book_type,author_id,status').eq('id', data.book_id).maybeSingle();
    const { data: all } = await supabase.from('chapters').select('id,chapter_number,title,status').eq('book_id', data.book_id).order('chapter_number');
    const owner = user && b && user.id === b.author_id;
    const list = (all || []).filter((c) => owner || c.status === 'published');
    setBook(b || null);
    setSibs(list);
    if (b && b.book_type === 'comic') {
      const { data: pg } = await supabase.from('chapter_pages').select('id,page_number,image_url,alt').eq('chapter_id', id).order('page_number');
      setPages(pg || []);
    } else {
      setPages([]);
    }
    setCh(data);
  }, [id, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Per-reader state: bookmark, resume position, and the read count.
  useEffect(() => {
    if (!user || !ch || !book) return;
    (async () => {
      const { data: bm } = await supabase.from('bookmarks').select('id').eq('user_id', user.id).eq('chapter_id', ch.id).maybeSingle();
      setMarked(Boolean(bm));
      const { data: pr } = await supabase.from('reading_progress').select('chapter_id,progress').eq('user_id', user.id).eq('book_id', book.id).maybeSingle();
      const idx = sibs.findIndex((c) => c.id === ch.id);
      if (pr && pr.chapter_id === ch.id && sibs.length > 0 && idx > -1) {
        const f = (pr.progress / 100) * sibs.length - idx;
        restore.current = f > 0.02 && f < 0.98 ? f : null;
        // The scroll effect below may already have run, so try again once this answer arrives.
        setTimeout(() => {
          if (!restore.current) return;
          const max = document.documentElement.scrollHeight - window.innerHeight;
          if (max > 0) window.scrollTo(0, restore.current * max);
          restore.current = null;
        }, 250);
      }
    })();
    if (ch.status === 'published' && book.status === 'published') supabase.rpc('record_read', { p_chapter: ch.id }).then(() => {});
  }, [user, ch, book, sibs]);

  const index = ch ? sibs.findIndex((c) => c.id === ch.id) : -1;
  const total = sibs.length;

  const saveProgress = useCallback(() => {
    if (!user || !book || !ch || index < 0 || total === 0) return;
    if (ch.status !== 'published') return;
    const value = Math.max(0, Math.min(100, Math.round(((index + frac.current) / total) * 100)));
    supabase.from('reading_progress').upsert(
      { user_id: user.id, book_id: book.id, chapter_id: ch.id, progress: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,book_id' }
    ).then(() => {});
  }, [user, book, ch, index, total]);

  useEffect(() => {
    if (!ch) return undefined;
    frac.current = 0;
    setPct(0);
    window.scrollTo(0, 0);
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const f = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
      frac.current = f;
      if (barRef.current) barRef.current.style.width = (f * 100).toFixed(1) + '%';
      setPct(Math.round(f * 100));
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(saveProgress, 1200);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    // Put the reader back where they stopped, once the content has had time to lay out.
    const t = setTimeout(() => {
      if (restore.current) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0) window.scrollTo(0, restore.current * max);
        restore.current = null;
      }
      onScroll();
    }, 350);
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(t); clearTimeout(saveTimer.current); };
  }, [ch, saveProgress, pages.length]);

  // Save on the way out of the page too.
  useEffect(() => {
    function leave() { saveProgress(); }
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, [saveProgress]);

  async function toggleBookmark() {
    if (!user) { setMsg('Log in to bookmark chapters.'); return; }
    setMsg('');
    if (marked) {
      const { error } = await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('chapter_id', ch.id);
      if (error) { setMsg(friendly(error)); return; }
      setMarked(false);
    } else {
      const { error } = await supabase.from('bookmarks').insert({ user_id: user.id, book_id: book.id, chapter_id: ch.id });
      if (error) { setMsg(friendly(error)); return; }
      setMarked(true);
    }
  }

  function setThemeTo(t) { setTheme(t); store('palixa-rtheme', t); }
  function bump(d) {
    const next = Math.min(1.7, Math.max(0.9, Math.round((size + d) * 100) / 100));
    setSize(next); store('palixa-rsize', next);
  }

  if (ch === undefined) {
    return <div className="reader" data-rtheme={theme}><p className="wrap" style={{ padding: '2rem 16px' }}>Loading...</p></div>;
  }
  if (ch === null || !book) {
    return (
      <div className="reader" data-rtheme={theme}>
        <div className="wrap" style={{ padding: '2rem 16px', display: 'grid', gap: '1rem', justifyItems: 'start' }}>
          <p><b>We could not find that chapter.</b></p>
          <p className="muted">It may have been removed, or it may not be published yet.</p>
          <Link className="btn" href="/discover">Discover Stories</Link>
        </div>
      </div>
    );
  }

  const prev = index > 0 ? sibs[index - 1] : null;
  const next = index > -1 && index < sibs.length - 1 ? sibs[index + 1] : null;
  const isComic = book.book_type === 'comic';
  const paragraphs = (ch.content || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const bookPct = total > 0 && index > -1 ? Math.round(((index + pct / 100) / total) * 100) : 0;

  return (
    <div className="reader" data-rtheme={theme}>
      <div className="rprog" aria-hidden="true"><b ref={barRef} /></div>
      <header className="rbar">
        <div className="wrap">
          <Link className="rbtn" href={'/book/' + book.id} aria-label="Exit reader">&larr; Exit</Link>
          <div className="rtitle">
            <strong>{book.title}</strong>
            <span className="fine">Chapter {ch.chapter_number} of {total || ch.chapter_number} &middot; {bookPct}% of book</span>
          </div>
          <button type="button" className="rbtn" aria-pressed={panel} aria-expanded={panel} onClick={() => setPanel(!panel)}>Aa</button>
          <button type="button" className="rbtn" aria-pressed={marked} onClick={toggleBookmark} aria-label={marked ? 'Remove bookmark' : 'Bookmark this chapter'}>{marked ? 'Saved' : 'Mark'}</button>
        </div>
      </header>
      {panel && (
        <div className="rpanel">
          <div className="wrap">
            {!isComic && (
              <>
                <button type="button" className="rbtn" onClick={() => bump(-0.1)} aria-label="Smaller text">A&minus;</button>
                <button type="button" className="rbtn" onClick={() => bump(0.1)} aria-label="Larger text">A+</button>
              </>
            )}
            <button type="button" className="rbtn" aria-pressed={theme === 'light'} onClick={() => setThemeTo('light')}>Light</button>
            <button type="button" className="rbtn" aria-pressed={theme === 'dark'} onClick={() => setThemeTo('dark')}>Dark</button>
          </div>
        </div>
      )}
      {ch.status !== 'published' && (
        <p className="wrap fine" style={{ paddingBlock: '0.6rem', maxWidth: '44rem' }}>Draft preview. Readers cannot see this chapter yet, and your progress is not saved.</p>
      )}
      {msg && (
        <p className="wrap msg-err" role="alert" style={{ paddingBlock: '0.6rem', maxWidth: '44rem' }}>
          {msg} {!user && <Link className="linkbtn" href={'/login?next=/read/' + id}>Log in</Link>}
        </p>
      )}

      <main className="rbody">
        {isComic ? (
          <div className="rstrip" aria-label={ch.title}>
            {pages.length === 0 && <p className="rtext">This chapter has no pages yet.</p>}
            {pages.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.image_url} alt={p.alt || 'Page ' + p.page_number} loading="lazy" />
            ))}
          </div>
        ) : (
          <article className="rtext" style={{ fontSize: size + 'rem' }}>
            <h1>{ch.title}</h1>
            {paragraphs.length === 0 && <p>This chapter has no text yet.</p>}
            {paragraphs.map((p, n) => <p key={n}>{p}</p>)}
          </article>
        )}

        {ch.status === 'published' && book.status === 'published' && (
          <>
            <div className="rlike"><LikeButton kind="chapter" id={ch.id} count={ch.like_count} authorId={book.author_id} /></div>
            <Comments chapterId={ch.id} authorId={book.author_id} />
          </>
        )}

        <nav className="rnav" aria-label="Chapters">
          {prev ? <Link className="btn ghost" href={'/read/' + prev.id}>&larr; Previous</Link> : <span />}
          {next ? <Link className="btn" href={'/read/' + next.id}>Next chapter &rarr;</Link> : <Link className="btn ghost" href={'/book/' + book.id}>Back to book</Link>}
        </nav>
      </main>
    </div>
  );
}
