const PAIRS = [
  ['#2e1065', '#6d28d9'],
  ['#240b54', '#9333ea'],
  ['#4c1d95', '#a855f7'],
  ['#312e81', '#7c3aed'],
  ['#3b0764', '#8b5cf6'],
  ['#1e1b4b', '#6d28d9'],
  ['#4338ca', '#a78bfa'],
];

// Accepts a row from the book_cards view, or a books row with an embedded profiles object.
export default function Cover({ b }) {
  const title = b.title || '';
  const author = b.author_name || (b.profiles && b.profiles.name) || '';
  const sum = Array.from(title).reduce((a, c) => a + c.charCodeAt(0), 0);
  const pair = PAIRS[sum % PAIRS.length];
  const storyLabels = { ongoing: 'Ongoing', completed: 'Completed', hiatus: 'Hiatus' };
  const tags = (
    <span className="ctags">
      {b.story_status && <span className={'ctag ctag-story ' + b.story_status}>{storyLabels[b.story_status] || 'Ongoing'}</span>}
      {b.book_type === 'comic' && <span className="ctag">Comic</span>}
      {b.is_sample && <span className="ctag">Sample</span>}
    </span>
  );
  if (b.cover_url) {
    return (
      <div className="cover has-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.cover_url} alt={'Cover of ' + title} loading="lazy" />
        {tags}
      </div>
    );
  }
  return (
    <div className="cover" style={{ '--c1': pair[0], '--c2': pair[1] }}>
      <span className="cv-type">{b.book_type === 'comic' ? 'Comic' : 'Book'}</span>
      <span className="cv-title">{title}</span>
      <span className="cv-by">{author}</span>
      {tags}
    </div>
  );
}
