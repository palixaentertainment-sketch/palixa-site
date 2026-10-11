'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function getSessionId() {
  try {
    const key = 'palixia_analytics_session';
    let id = window.localStorage.getItem(key);
    if (!id) {
      id = typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : 'px-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      window.localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return null;
  }
}

export default function VisitorTracker() {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    const sessionId = getSessionId();
    if (!sessionId) return;

    supabase.from('visitor_events').insert({
      session_id: sessionId,
      path: pathname.slice(0, 500),
      user_id: user?.id || null,
      event_type: 'page_view',
    }).then(({ error }) => {
      if (error) console.warn('Palixia visit analytics unavailable:', error.message);
    });
  }, [pathname, user?.id]);

  return null;
}
