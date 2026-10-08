'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { genreStyle } from '@/lib/genres';

export default function Categories() {
  const [genres, setGenres] = useState(null);
  useEffect(() => {
    if (!configured) { setGenres([]); return; }
    supabase.from('genres').select('*').order('sort').then(({ data }) => setGenres(data || []));
  }, []);
  return (
    <>
      <h1 className="h1">Categories</h1>
      {genres === null && <p className="muted">Loading...</p>}
      {genres && genres.length === 0 && <p className="notice">Categories will appear here once the database is connected.</p>}
      {genres && genres.length > 0 && (
        <div className="genres">
          {genres.map((g) => (
            <Link key={g.id} href={'/discover?genre=' + g.slug} className="gcard" style={genreStyle(g.slug)}>{g.name}</Link>
          ))}
        </div>
      )}
    </>
  );
}
