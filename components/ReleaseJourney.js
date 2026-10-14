'use client';

function releaseDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
}

function activityTime(chapter) {
  return chapter.updated_at || chapter.created_at || null;
}

export default function ReleaseJourney({ chapters = [], bookTitle = 'this story', compact = false }) {
  const published = chapters.filter((chapter) => chapter.status === 'published');
  const now = Date.now();
  const recent = published.filter((chapter) => {
    const time = activityTime(chapter);
    return time && now - new Date(time).getTime() <= 30 * 24 * 60 * 60 * 1000;
  });
  const timeline = [...published]
    .sort((a, b) => new Date(activityTime(b) || 0).getTime() - new Date(activityTime(a) || 0).getTime())
    .slice(0, compact ? 3 : 4);
  const latest = timeline[0] ? activityTime(timeline[0]) : null;

  if (!published.length) return null;

  return (
    <section className={'release-journey' + (compact ? ' release-journey-compact' : '')} aria-label="Release Journey">
      <div className="release-heading">
        <span className="release-book-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M4.5 7.5c4.7-1.7 8.5-.8 11.5 2.2v17c-3-3-6.8-3.9-11.5-2.2v-17Z" />
            <path d="M27.5 7.5c-4.7-1.7-8.5-.8-11.5 2.2v17c3-3 6.8-3.9 11.5-2.2v-17Z" />
            <path d="M8 12c2-.5 4-.2 5.5.8M8 16c2-.5 4-.2 5.5.8M24 12c-2-.5-4-.2-5.5.8M24 16c-2-.5-4-.2-5.5.8" />
            <path className="release-spark" d="M25 2v4M23 4h4" />
          </svg>
        </span>
        <div>
          <p className="mono">THE STORY SO FAR</p>
          <h2 className="h2">Release Journey</h2>
          <p className="muted release-subtitle">A little look at how {bookTitle} is growing.</p>
        </div>
      </div>

      <div className="release-summary">
        <div className="release-summary-number"><strong>{recent.length}</strong><span>chapter{recent.length === 1 ? '' : 's'} active in the last 30 days</span></div>
        <div className="release-summary-date"><span className="release-pulse" aria-hidden="true" /><span>{latest ? 'Last chapter activity ' + releaseDate(latest) : 'No recent activity'}</span></div>
      </div>

      <div className="release-timeline">
        <p className="release-timeline-label">RECENT CHAPTERS</p>
        <ol>
          {timeline.map((chapter, index) => (
            <li key={chapter.id} className={index === 0 ? 'release-latest' : ''}>
              <span className="release-dot" aria-hidden="true">{index === 0 ? '✦' : ''}</span>
              <div className="release-chapter-copy">
                <strong>Chapter {chapter.chapter_number}{chapter.title ? ' · ' + chapter.title : ''}</strong>
                <span>{releaseDate(activityTime(chapter))}</span>
              </div>
              {index === 0 && <span className="release-new">LATEST</span>}
            </li>
          ))}
        </ol>
      </div>
      <p className="release-footnote">Based on the latest activity recorded for published chapters.</p>
    </section>
  );
}
