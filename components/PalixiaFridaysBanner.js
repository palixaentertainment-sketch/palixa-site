'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';

function getNextFriday(from = new Date()) {
  const target = new Date(from);
  const daysUntilFriday = (5 - target.getDay() + 7) % 7;
  target.setDate(target.getDate() + daysUntilFriday);
  target.setHours(10, 4, 0, 0);
  if (target <= from) target.setDate(target.getDate() + 7);
  return target;
}

function getCountdown(target, now) {
  const remaining = Math.max(0, target.getTime() - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return [
    { value: days, label: 'Days' },
    { value: hours, label: 'Hours' },
    { value: minutes, label: 'Mins' },
    { value: seconds, label: 'Secs' },
  ];
}

export default function PalixiaFridaysBanner() {
  const [hunt, setHunt] = useState(null);
  const [now, setNow] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadHunt() {
      if (!configured) return;
      const current = new Date().toISOString();
      const { data } = await supabase.from('palixia_friday_hunts')
        .select('id,title,starts_at,ends_at,status')
        .eq('status', 'published')
        .gte('ends_at', current)
        .order('starts_at', { ascending: true })
        .limit(1);
      if (!cancelled) setHunt(data?.[0] || null);
    }
    loadHunt();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const upcoming = hunt && Date.now() < new Date(hunt.starts_at).getTime();
  const countdownTarget = hunt && upcoming ? new Date(hunt.starts_at) : getNextFriday(now ? new Date(now) : new Date());
  const countdown = now !== null ? getCountdown(countdownTarget, now) : null;
  const title = hunt
    ? (upcoming ? 'A new story hunt is coming.' : 'Your next clue is waiting.')
    : 'The next story hunt is getting closer.';
  const detail = hunt
    ? hunt.title
    : 'A fresh mystery, new clues, and another chance to put your reading skills to the test.';
  const action = hunt ? (upcoming ? 'Get ready' : 'Join the hunt') : 'Explore Palixia Fridays';
  const ariaLabel = hunt ? (upcoming ? 'See the upcoming Palixia Fridays hunt' : 'Join the Palixia Fridays hunt') : 'Explore Palixia Fridays';

  return (
    <section className="fridays-home-banner" aria-label="Palixia Fridays">
      <div className="fridays-home-banner-copy">
        <span className="fridays-home-banner-kicker"><span className="fridays-home-banner-mark" aria-hidden="true">✦</span> Palixia Fridays</span>
        <h2>{title}</h2>
        <p>{detail}</p>
        {!hunt && (
          <div className="fridays-countdown-wrap" aria-label="Countdown to the next Friday at 10:04">
            <span className="fridays-countdown-label">Next hunt in</span>
            <div className="fridays-countdown" aria-live="off">
              {countdown ? countdown.map((unit) => (
                <span className="fridays-countdown-unit" key={unit.label}>
                  <b>{String(unit.value).padStart(2, '0')}</b>
                  <small>{unit.label}</small>
                </span>
              )) : <span className="fridays-countdown-loading">Loading countdown…</span>}
            </div>
          </div>
        )}
      </div>
      <Link className="fridays-home-banner-action" href="/fridays" aria-label={ariaLabel}>
        {action} <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
