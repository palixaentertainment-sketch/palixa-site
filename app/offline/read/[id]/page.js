'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

function readSaved(bookId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('palixia-offline-books', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('chapters')) request.result.createObjectStore('chapters', { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const query = db.transaction('chapters', 'readonly').objectStore('chapters').getAll();
      query.onsuccess = () => resolve((query.result || []).filter((ch) => ch.book_id === bookId).sort((a, b) => a.chapter_number - b.chapter_number));
      query.onerror = () => reject(query.error);
    };
  });
}

export default function OfflineReaderPage() {
  const { id } = useParams();
  const [chapters, setChapters] = useState(null);
  const [selected, setSelected] = useState(0);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    setTheme(localStorage.getItem('palixa-rtheme') === 'dark' ? 'dark' : 'light');
    readSaved(String(id)).then(setChapters).catch(() => setChapters([]));
  }, [id]);

  if (chapters === null) return <main className="page wrap"><p className="muted">Opening downloaded story…</p></main>;
  if (!chapters.length) return <main className="page wrap stack"><h1 className="h1">No saved chapters found</h1><p className="muted">Connect to the internet and download this book first.</p><Link className="btn" href="/offline">Back to My Books</Link></main>;

  const chapter = chapters[Math.min(selected, chapters.length - 1)];
  const paragraphs = (chapter.content || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return <main className="page wrap" data-theme={theme}>
    <div className="row between"><Link href="/offline" className="linkbtn">← My Books</Link><button className="btn ghost small" onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); localStorage.setItem('palixa-rtheme', next); }}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button></div>
    <section className="stack" style={{gap:'.4rem'}}><p className="mono">OFFLINE READING</p><h1 className="h1">{chapters[0].book_title}</h1><p className="muted">{chapters[0].author_name}</p></section>
    <div className="row"><label htmlFor="offline-chapter">Chapter</label><select id="offline-chapter" className="input" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>{chapters.map((ch, i) => <option value={i} key={ch.id}>{ch.chapter_number}. {ch.title || 'Chapter ' + ch.chapter_number}</option>)}</select></div>
    <article className="offline-reader" data-theme={theme}><h2>{chapter.title || 'Chapter ' + chapter.chapter_number}</h2>{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</article>
    <div className="row between"><button className="btn ghost small" disabled={selected === 0} onClick={() => {setSelected((v) => v - 1); window.scrollTo(0,0);}}>← Previous</button><span className="fine">Chapter {selected + 1} of {chapters.length}</span><button className="btn small" disabled={selected >= chapters.length - 1} onClick={() => {setSelected((v) => v + 1); window.scrollTo(0,0);}}>Next →</button></div>
    <style jsx>{`
      .offline-reader { max-width:44rem; margin:0 auto; width:100%; padding:clamp(1rem,4vw,2rem); border:1px solid var(--line); border-radius:10px; background:var(--surface); color:var(--fg); font-family:var(--read); font-size:1.08rem; line-height:1.9; }
      .offline-reader[data-theme="dark"] { background:#171321; color:#f2edf9; border-color:#393044; }
      .offline-reader h2 { font-family:var(--display); line-height:1.25; margin-bottom:1.5rem; }
      .offline-reader p { margin:0 0 1.25rem; white-space:pre-wrap; }
      select { max-width:100%; }
    `}</style>
  </main>;
}
