'use client';

export default function TipAuthor({ authorName, compact = false }) {
  return (
    <span className="tip-author-wrap">
      <button
        type="button"
        className={compact ? 'btn ghost small' : 'btn'}
        disabled
        aria-label={`Send a Spark to ${authorName || 'the author'} — coming soon`}
      >
        ✨ Send a Spark
      </button>
      {!compact && <span className="fine">Coming soon</span>}
    </span>
  );
}
