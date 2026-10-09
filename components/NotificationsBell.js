'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';

export default function NotificationsBell({ user }) {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    if (!configured || !user) { setCount(0); return; }
    const { count: unread, error } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', user.id).is('read_at', null);
    if (!error) setCount(unread || 0);
  }, [user]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 45000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);
  return (
    <Link href="/notifications" className="notification-bell" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'} title="Notifications">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {count > 0 && <span className="notification-count">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
