import Link from 'next/link';
import Cover from '@/components/Cover';

export default function BookCard({ b, badge }) {
  return (
    <Link href={'/book/' + b.id} className="bcard">
      <div style={{ position: 'relative' }}>
        <Cover b={b} />
        {badge && <span style={{ position: 'absolute', top: '.55rem', left: '.55rem', zIndex: 2, background: 'var(--accent)', color: '#fff', borderRadius: '999px', padding: '.3rem .5rem', fontSize: '.62rem', fontWeight: 800, letterSpacing: '.04em' }}>{badge}</span>}
      </div>
      <div>
        <h3>{b.title}</h3>
        <span className="sub">{b.author_name}</span>
        <span className="sub">{b.genre_name}</span>
      </div>
    </Link>
  );
}
