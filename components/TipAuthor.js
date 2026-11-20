'use client';

import Link from 'next/link';

export default function TipAuthor({ authorName, compact = false }) {
  return (
    <div className="tip-author-wrap stack" style={{ gap: '0.4rem', alignItems: 'flex-start' }}>
      <p className="fine" style={{ margin: 0 }}>
        Support {authorName || 'this author'} with Sparks. Buy Sparks in your reader wallet and send support to authors whose stories you enjoy.
      </p>
      <Link className={compact ? 'btn ghost small' : 'btn ghost'} href="/sparks">Get Sparks <span aria-hidden="true">→</span></Link>
    </div>
  );
}
