import Link from 'next/link';
import Cover from '@/components/Cover';

export default function BookCard({ b }) {
  return (
    <Link href={'/book/' + b.id} className="bcard">
      <Cover b={b} />
      <div>
        <h3>{b.title}</h3>
        <span className="sub">{b.author_name}</span>
        <span className="sub">{b.genre_name}</span>
      </div>
    </Link>
  );
}
