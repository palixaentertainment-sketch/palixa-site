'use client';
import { useState } from 'react';

// Opens the phone's share sheet when there is one, otherwise copies the link.
export default function ShareButton({ title, author, path }) {
  const [note, setNote] = useState('');

  function say(text) {
    setNote(text);
    setTimeout(() => setNote(''), 2500);
  }

  async function share() {
    const url = window.location.origin + path;
    const text = author ? 'Read "' + title + '" by ' + author + ' on Palixia' : 'Read "' + title + '" on Palixia';
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); } catch (e) { /* closed without sharing */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      say('Link copied');
    } catch (e) {
      window.prompt('Copy this link', url);
    }
  }

  return (
    <button type="button" className="btn ghost" onClick={share} aria-live="polite">
      {note || 'Share'}
    </button>
  );
}
