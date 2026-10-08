import Link from 'next/link';
import Cover from '@/components/Cover';
import { fmtNum } from '@/lib/format';

export default function BookCard({ b }) {
  return (
    <Link href={'/book/' + b.id} className="bcard">
      <Cover b={b} />
      <div>
        <h3>{b.title}</h3>
        <span className="sub">{b.author_name}</span>
        <span className="sub">{b.genre_name}{b.reads > 0 ? ' · ' + fmtNum(b.reads) + ' reads' : ''}</span>
      </div>
    </Link>
  );
}
