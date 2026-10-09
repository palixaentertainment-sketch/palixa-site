import Link from 'next/link';
import Cover from '@/components/Cover';
import { fmtNum, SHOW_PUBLIC_READS } from '@/lib/format';

export default function BookCard({ b }) {
  return (
    <Link href={'/book/' + b.id} className="bcard">
      <Cover b={b} />
      <div>
        <h3>{b.title}</h3>
        <span className="sub">{b.author_name}</span>
        <span className="sub">{b.genre_name}{SHOW_PUBLIC_READS && b.reads > 0 ? ' · ' + fmtNum(b.reads) + (b.reads === 1 ? ' read' : ' reads') : ''}</span>
      </div>
    </Link>
  );
}
