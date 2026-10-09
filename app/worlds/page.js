'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import Empty from '@/components/Empty';

export default function StoryWorldsPage() {
  const [worlds, setWorlds] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!configured) { setWorlds([]); return; }
    let alive = true;
    supabase.from('story_worlds')
      .select('id,title,description,author_id,created_at,profiles:author_id(name,username)')
      .eq('status', 'published')
      .order('updated_at', { ascending: false })
      .limit(60)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setFailed(true); setWorlds([]); return; }
        setWorlds(data || []);
      });
    return () => { alive = false; };
  }, []);

  return (
    <div className="stack">
      <div className="worlds-hero">
        <span className="mono">STORY WORLDS</span>
        <h1 className="h1">More than one story.</h1>
        <p>Explore connected books and comics, follow a series from its beginning, and step deeper into the worlds creators build.</p>
      </div>
      {failed && <p className="notice">Story Worlds needs its database setup. An administrator should run <code>supabase/story_worlds.sql</code> in Supabase SQL Editor.</p>}
      {worlds === null && <p className="muted">Loading Story Worlds...</p>}
      {worlds && worlds.length === 0 && !failed && (
        <Empty title="No Story Worlds yet." text="When creators connect books into a series or shared universe, you’ll find them here." />
      )}
      {worlds && worlds.length > 0 && (
        <div className="world-grid">
          {worlds.map((world) => (
            <Link key={world.id} href={'/worlds/' + world.id} className="world-card">
              <span className="world-card-mark" aria-hidden="true">✦</span>
              <span className="mono">A PALIXIA STORY WORLD</span>
              <h2>{world.title}</h2>
              <p>{world.description || 'A collection of connected stories by an independent creator.'}</p>
              <span className="world-card-author">By {world.profiles?.name || 'Palixia creator'}</span>
              <span className="world-card-link">Explore world ↗</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
