'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function utcDateString(date) {
  return date.toISOString().slice(0, 10);
}

function calculateStreak(rows) {
  const dates = new Set((rows || []).map((row) => row.activity_date));
  const today = utcDateString(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = utcDateString(yesterdayDate);

  if (!dates.has(today) && !dates.has(yesterday)) return 0;

  let cursor = dates.has(today) ? new Date(today + 'T00:00:00Z') : new Date(yesterday + 'T00:00:00Z');
  let streak = 0;
  while (dates.has(utcDateString(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export default function PalixiaDaily() {
  const { user } = useAuth();
  const [activity, setActivity] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const completedToday = activity.some((row) => row.activity_date === utcDateString(new Date()));
  const streak = calculateStreak(activity);

  useEffect(() => {
    let cancelled = false;
    if (!user || !configured) {
      setActivity([]);
      setLoaded(true);
      return () => { cancelled = true; };
    }

    setLoaded(false);
    supabase.from('reading_activity')
      .select('activity_date')
      .eq('user_id', user.id)
      .order('activity_date', { ascending: false })
      .limit(90)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[Palixia Daily] Reading activity could not load:', error);
          setActivity([]);
        } else {
          setActivity(data || []);
        }
        setLoaded(true);
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <section className="palixia-daily" aria-labelledby="palixia-daily-title">
      <div className="palixia-daily-main">
        <div className="palixia-daily-heading">
          <span className="palixia-daily-kicker">A LITTLE READING, EVERY DAY</span>
          <span className="palixia-daily-spark" aria-hidden="true">✦</span>
        </div>
        <h2 id="palixia-daily-title">Palixia Daily</h2>
        <p className="palixia-daily-intro">Small reading goals. New discoveries. A little progress every day.</p>
        <div className="palixia-daily-challenge">
          <div className="palixia-daily-challenge-icon" aria-hidden="true">📖</div>
          <div className="palixia-daily-challenge-copy">
            <span className="palixia-daily-label">TODAY'S READING CHALLENGE</span>
            <h3>Read one chapter today</h3>
            <p>{!user ? 'Sign in to track your daily reading.' : !loaded ? 'Checking your reading progress…' : completedToday ? 'Challenge complete. Well done!' : 'Open any story and read a chapter to complete today’s challenge.'}</p>
          </div>
          <span className={completedToday ? 'palixia-daily-status is-complete' : 'palixia-daily-status'}>{completedToday ? 'Completed ✓' : '1 chapter'}</span>
        </div>
        <div className="palixia-daily-footer">
          <div className="palixia-daily-streak">
            <span aria-hidden="true">🔥</span>
            <div><b>{user && loaded ? streak : '—'} day{streak === 1 ? '' : 's'}</b><small>Reading streak</small></div>
          </div>
          <Link className="palixia-daily-link" href={user ? '/discover' : '/login'}>{user ? 'Find a story to read' : 'Sign in to join'} <span aria-hidden="true">→</span></Link>
        </div>
      </div>
      <aside className="palixia-daily-recognition">
        <span className="palixia-daily-label">READER RECOGNITION</span>
        <div className="palixia-daily-award" aria-hidden="true">✧</div>
        <h3>Readers deserve a spotlight.</h3>
        <p>Our weekly reader shout-outs are coming soon. Keep reading, reviewing, and supporting the stories you love.</p>
        <span className="palixia-daily-coming">WEEKLY RECOGNITION · COMING SOON</span>
      </aside>
    </section>
  );
}
