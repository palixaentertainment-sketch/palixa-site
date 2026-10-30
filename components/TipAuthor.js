'use client';

export default function TipAuthor({ authorName, contextTitle, compact = false }) {
  return (
    <span className="tip-author-wrap">
      <button type="button" className={compact ? 'btn ghost small' : 'btn ghost'} disabled aria-label={`Tip ${authorName || 'the author'} — coming soon`}>
        Tip the Author
      </button>
      {!compact && <span className="fine">Coming soon</span>}
    </span>
  );
}
