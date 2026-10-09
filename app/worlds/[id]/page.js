'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import BookCard from '@/components/BookCard';
import Empty from '@/components/Empty';

export default function StoryWorldPage() {
  const { id } = useParams();
  const [world, setWorld] = useState(undefined);
  const [books, setBooks] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from('story_worlds')
        .select('id,title,description,author_id,status,profiles(name,username)')
        .eq('id', String(id)).eq('status', 'published').maybeSingle();
      if (!alive) return;
      if (error) { setFailed(true); setWorld(null); return; }
      if (!data) { setWorld(null); return; }
      setWorld(data);

      const { data: memberships, error: membershipError } = await supabase
        .from('story_world_books').select('book_id,position').eq('world_id', data.id).order('position');
      if (membershipError) { setFailed(true); return; }
      const ids = (memberships || []).map((row) => row.book_id);
      if (!ids.length) { setBooks([]); return; }
      const { data: cards, error: booksError } = await supabase.from('book_cards').select('*').in('id', ids);
      if (!alive) return;
      if (booksError) { setFailed(true); return; }
      const byId = new Map((cards || []).map((book) => [book.id, book]));
      setBooks(ids.map((bookId) => byId.get(bookId)).filter(Boolean));
    })();
    return () => { alive = false; };
  }, [id]);

  if (world === undefined) return <p className="muted">Loading Story World...</p>;
  if (world === null) return <Empty title="We couldn't find that Story World." text="It may be unpublished or no longer available." href="/worlds" cta="Browse Story Worlds" />;

  return (
    <div className="stack">
      <Link className="linkbtn" href="/worlds">← All Story Worlds</Link>
      <header className="world-detail-hero">
        <span className="mono">A PALIXIA STORY WORLD</span>
        <h1 className="h1">{world.title}</h1>
        <p>{world.description || 'Connected stories from one creator.'}</p>
        <span className="fine">Created by <Link href={'/author/' + world.profiles?.username}>{world.profiles?.name || 'an independent creator'}</Link></span>
      </header>
      {failed && <p className="notice">Some stories in this world could not be loaded. Refresh and try again.</p>}
      <section>
        <div className="sechead"><div><h2 className="h2">Stories in this world</h2><p className="fine">Start at the beginning, or discover another corner of the same universe.</p></div></div>
        {books.length ? <div className="grid">{books.map((book) => <BookCard key={book.id} b={book} />)}</div> : <Empty title="This world is just getting started." text="The creator hasn't added any published books yet." />}
      </section>
    </div>
  );
}
