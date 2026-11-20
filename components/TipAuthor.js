'use client';

import Link from 'next/link';

export default function TipAuthor({ authorName, compact = false }) {
  return (
    <div className="tip-author-wrap stack" style={{ gap: '0.4rem', alignItems: 'flex-start' }}>
      <p className="fine" style={{ margin: 0 }}>
        Sparks are being prepared for all Palixia readers. Soon, you’ll be able to support {authorName ? authorName : 'this author'} directly through the platform.
      </p>
      <Link className={compact ? 'btn ghost small' : 'btn ghost'} href="/sparks">Learn about Sparks <span aria-hidden="true">→</span></Link>
    </div>
  );
}
