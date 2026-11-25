import Link from 'next/link';
import Cover from '@/components/Cover';

export default function BookCard({ b, badge }) {
  return (
    <Link href={'/book/' + b.id} className="bcard reader-book-card">
      <div className="reader-book-cover">
        <Cover b={b} />
        {badge && <span className="reader-book-badge">{badge}</span>}
      </div>
      <div className="reader-book-info">
        <h3>{b.title}</h3>
        {b.author_name && <span className="sub reader-book-author">{b.author_name}</span>}
        {b.genre_name && <span className="reader-book-genre">{b.genre_name}</span>}
      </div>
    </Link>
  );
}
