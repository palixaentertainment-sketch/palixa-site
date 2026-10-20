'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const DB_NAME = 'palixia-offline-library';
const STORE_NAME = 'books';

function openLibrary() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveOfflineBook(book) {
  const db = await openLibrary();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(book);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}

export default function OfflineDownloadButton({ book, chapters }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function download() {
    setMessage('');
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      setMessage('Offline saving is not supported by this browser.');
      return;
    }
    if (book.book_type === 'comic') {
      setMessage('Offline saving for comics is not available yet. We are starting with text-based books.');
      return;
    }
    if (book.status !== 'published') {
      setMessage('Only published books can be saved for offline reading.');
      return;
    }
    setBusy(true);
    try {
      // Fetch only published chapters for this published book. Do not save drafts.
      const { data, error } = await supabase
        .from('chapters')
        .select('id,chapter_number,title,content,status')
        .eq('book_id', book.id)
        .eq('status', 'published')
        .order('chapter_number');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('There are no published chapters to save yet.');
      const payload = {
        id: book.id,
        title: book.title,
        author: book.author_name || 'Palixia author',
        coverUrl: book.cover_url || '',
        savedAt: new Date().toISOString(),
        chapters: data.map((chapter) => ({
          id: chapter.id,
          number: chapter.chapter_number,
          title: chapter.title || 'Untitled chapter',
          content: chapter.content || '',
        })),
      };
      const bytes = new Blob([JSON.stringify(payload)]).size;
      if (bytes > 20 * 1024 * 1024) throw new Error('This book is too large to save on this device (20 MB limit).');
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage + bytes > estimate.quota * 0.9) {
          throw new Error('Your device is low on browser storage. Remove some saved books and try again.');
        }
      }
      await saveOfflineBook(payload);
      setMessage('Saved on this device. Open My Offline Books to read without internet.');
    } catch (error) {
      setMessage(error && error.message ? error.message : 'Could not save this book. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: '0.45rem', alignItems: 'start' }}>
      <div className="row">
        <button type="button" className="btn ghost" onClick={download} disabled={busy}>
          {busy ? 'Saving book…' : '↓ Save for offline'}
        </button>
        <Link className="btn ghost" href="/offline-library">My Offline Books</Link>
      </div>
      {message && <p className="fine" role="status">{message}</p>}
      <p className="fine">Text books only for now. Saved chapters stay in this browser on this device.</p>
    </div>
  );
}
