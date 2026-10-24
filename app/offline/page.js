'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Cover from '@/components/Cover';

const DB_NAME = 'palixia-offline-books';
const STORE = 'chapters';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function savedChapters() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
async function saveChapters(rows) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    rows.forEach((row) => tx.objectStore(STORE).put({ ...row, cachedAt: Date.now() }));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function removeBookChapters(bookId) {
  const rows = await savedChapters();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    rows.filter((row) => row.book_id === bookId).forEach((row) => tx.objectStore(STORE).delete(row.id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export default function OfflineBooksPage() {
  const { user, loading } = useAuth();
  const [books, setBooks] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [online, setOnline] = useState(true);
  const refreshDownloads = useCallback(async () => {
    try { setDownloads(await savedChapters()); } catch { setDownloads([]); }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    refreshDownloads();
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, [refreshDownloads]);

  useEffect(() => {
    if (!user || !online) return;
    let cancelled = false;
    (async () => {
      setError('');
      const [progress, bookmarks] = await Promise.all([
        supabase.from('reading_progress').select('book_id').eq('user_id', user.id),
        supabase.from('bookmarks').select('book_id').eq('user_id', user.id).is('chapter_id', null),
      ]);
      if (progress.error || bookmarks.error) {
        if (!cancelled) setError('We could not load your library. Please try again.');
        return;
      }
      const ids = [...new Set([...(progress.data || []), ...(bookmarks.data || [])].map((r) => r.book_id).filter(Boolean))];
      if (!ids.length) { if (!cancelled) setBooks([]); return; }
      const result = await supabase.from('books')
        .select('id,title,cover_url,book_type,is_sample,status,author_id')
        .in('id', ids).eq('status', 'published');
      if (result.error) { if (!cancelled) setError('We could not load book details. Please try again.'); return; }
      const authorIds = [...new Set((result.data || []).map((b) => b.author_id).filter(Boolean))];
      let profiles = [];
      if (authorIds.length) {
        const authors = await supabase.from('profiles').select('id,name').in('id', authorIds);
        profiles = authors.data || [];
      }
      const names = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
      if (!cancelled) setBooks((result.data || []).map((b) => ({ ...b, author_name: names[b.author_id] || 'Palixia author' })));
    })();
    return () => { cancelled = true; };
  }, [user, online]);

  async function downloadBook(book) {
    if (!online) { setError('Connect to the internet to download this story.'); return; }
    setBusy(book.id); setError('');
    try {
      const result = await supabase.from('chapters')
        .select('id,book_id,chapter_number,title,content,status')
        .eq('book_id', book.id).eq('status', 'published').order('chapter_number');
      if (result.error) throw result.error;
      if (!result.data || !result.data.length) throw new Error('No published chapters are available to download yet.');
      await saveChapters(result.data.map((ch) => ({ ...ch, book_title: book.title, author_name: book.author_name })));
      await refreshDownloads();
    } catch (e) {
      setError(e.message || 'Download failed. Please try again.');
    } finally { setBusy(''); }
  }

  async function removeDownload(bookId) {
    await removeBookChapters(bookId);
    await refreshDownloads();
  }

  const downloadedIds = new Set(downloads.map((ch) => ch.book_id));
  const downloadedBooks = books.filter((b) => downloadedIds.has(b.id));
  const notDownloaded = books.filter((b) => !downloadedIds.has(b.id));
  const offlineBooks = [...new Set(downloads.map((ch) => ch.book_id))].map((id) => {
    const chapters = downloads.filter((ch) => ch.book_id === id).sort((a, b) => a.chapter_number - b.chapter_number);
    return { id, title: chapters[0]?.book_title || 'Downloaded story', author_name: chapters[0]?.author_name || '', chapters };
  });

  if (loading) return <main className="page wrap"><p className="muted">Loading your library…</p></main>;
  if (!user) return <main className="page wrap"><h1 className="h1">My Books</h1><p>Log in to manage your offline downloads.</p><Link className="btn" href="/login?next=%2Foffline">Log in</Link></main>;

  return (
    <main className="page wrap offline-page">
      <div className="stack" style={{ gap: '.5rem' }}>
        <p className="mono">YOUR PERSONAL LIBRARY</p>
        <h1 className="h1">My Books</h1>
        <p className="muted">Download stories while online, then keep reading when you’re offline.</p>
        <p className="fine">{online ? '● Connected · Downloads are available' : '○ Offline · Showing books saved on this device'}</p>
      </div>

      {error && <p className="notice" role="alert">{error}</p>}

      <section className="stack" style={{ gap: '.8rem' }}>
        <div className="sechead"><div><h2 className="h2">Downloaded</h2><p className="fine">{offlineBooks.length} {offlineBooks.length === 1 ? 'book' : 'books'} saved on this device</p></div></div>
        {offlineBooks.length ? <div className="offline-list">{offlineBooks.map((b) => (
          <article className="offline-card" key={b.id}>
            <div className="offline-cover"><span>{b.title}</span></div>
            <div className="offline-details"><h3>{b.title}</h3><p className="fine">{b.author_name}</p><p className="fine">{b.chapters.length} chapters saved</p>
              <div className="row"><Link className="btn small" href={'/offline/read/' + b.id}>Read offline</Link><button type="button" className="btn ghost small" onClick={() => removeDownload(b.id)}>Remove</button></div>
            </div>
          </article>
        ))}</div> : <div className="empty offline-empty"><b>No downloads yet</b><p className="muted">Stories you save for offline reading will appear here.</p></div>}
      </section>

      {online && <section className="stack" style={{ gap: '.8rem' }}>
        <div className="sechead"><div><h2 className="h2">Cloud</h2><p className="fine">Books in your Palixia library</p></div></div>
        {notDownloaded.length ? <div className="offline-list">{notDownloaded.map((b) => (
          <article className="offline-card" key={b.id}>
            <div className="offline-cover"><span>{b.title}</span></div>
            <div className="offline-details"><h3>{b.title}</h3><p className="fine">{b.author_name}</p><button className="btn small" type="button" disabled={busy === b.id} onClick={() => downloadBook(b)}>{busy === b.id ? 'Downloading…' : '↓ Download book'}</button></div>
          </article>
        ))}</div> : <p className="muted">No other books in your library yet. Save a book or start reading one to find it here.</p>}
      </section>}
      <p className="fine">Downloads are stored in this browser on this device. Clearing browser data may remove them. Offline downloads are personal and do not count as extra reads.</p>
      <style jsx>{`
        .offline-page { gap: 2rem; }
        .offline-list { display:grid; gap:.8rem; }
        .offline-card { display:flex; align-items:center; gap:1rem; padding:.8rem; border:1px solid var(--line); border-radius:10px; background:var(--surface); min-width:0; }
        .offline-cover { flex:0 0 5rem; width:5rem; aspect-ratio:2/3; border-radius:5px; padding:.45rem; display:flex; align-items:center; justify-content:center; text-align:center; overflow:hidden; background:linear-gradient(145deg,#30105e,#8c65d8); color:#fff; font-family:var(--read); font-size:.72rem; font-weight:700; }
        .offline-details { min-width:0; display:grid; gap:.35rem; }
        .offline-details h3 { font-size:1rem; overflow-wrap:anywhere; }
        .offline-empty { border:1px dashed var(--line); border-radius:10px; padding:1.5rem; display:grid; gap:.4rem; }
      `}</style>
    </main>
  );
}
