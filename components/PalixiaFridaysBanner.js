'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';

const LAUNCH_DATE = new Date('2026-10-23T00:00:00');

export default function PalixiaFridaysBanner() {
  const [hunt, setHunt] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadHunt() {
      if (!configured) { setChecked(true); return; }
      const now = new Date().toISOString();
      const { data } = await supabase.from('palixia_friday_hunts')
        .select('id,title,starts_at,ends_at,status')
        .eq('status', 'published')
        .gte('ends_at', now)
        .order('starts_at', { ascending: true })
        .limit(1);
      if (!cancelled) {
        setHunt(data?.[0] || null);
        setChecked(true);
      }
    }
    loadHunt();
    return () => { cancelled = true; };
  }, []);

  const upcoming = hunt && Date.now() < new Date(hunt.starts_at).getTime();
  const live = hunt && !upcoming;
  const prelaunch = !hunt && Date.now() < LAUNCH_DATE.getTime();
  const title = hunt
    ? (upcoming ? 'A new story hunt is coming.' : 'Your next clue is waiting.')
    : prelaunch ? 'Palixia Fridays launches next week.' : 'The next story hunt is being prepared.';
  const detail = hunt
    ? hunt.title
    : prelaunch
      ? 'Explore stories, solve clues, and compete for a prize every Friday.'
      : 'Check back soon for the next round of clues and prizes.';
  const action = hunt ? (upcoming ? 'Get ready' : 'Join the hunt') : 'See what it is';
  const ariaLabel = hunt ? (upcoming ? 'See the upcoming Palixia Fridays hunt' : 'Join the Palixia Fridays hunt') : 'See Palixia Fridays details';

  return (
    <section className="fridays-home-banner" aria-label="Palixia Fridays">
      <div className="fridays-home-banner-copy">
        <span className="fridays-home-banner-kicker"><span className="fridays-home-banner-mark" aria-hidden="true">✦</span> Palixia Fridays</span>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      <Link className="fridays-home-banner-action" href="/fridays" aria-label={ariaLabel}>
        {action} <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
