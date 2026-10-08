'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { fmtNum } from '@/lib/format';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';

export default function Authors() {
  const [list, setList] = useState(null);
  useEffect(() => {
    if (!configured) { setList([]); return; }
    supabase.rpc('popular_authors', { lim: 60 }).then(({ data }) => setList(data || []));
  }, []);
  return (
    <>
      <h1 className="h1">Authors</h1>
      {list === null && <p className="muted">Loading...</p>}
      {list && list.length === 0 && (
        <Empty title="No authors have published yet." text="Publish a book and your profile will appear here." href="/signup?as=author" cta="Publish Your Story" />
      )}
      {list && list.length > 0 && (
        <div className="alist">
          {list.map((a) => (
            <Link key={a.id} href={'/author/' + a.username} className="arow">
              <Avatar src={a.avatar_url} name={a.name} size="3.2rem" />
              <div>
                <b>{a.name}</b>
                <p>{a.bio || '@' + a.username}</p>
                <span className="fine">{a.book_count} {a.book_count === 1 ? 'book' : 'books'} &middot; {fmtNum(a.total_reads)} reads</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
