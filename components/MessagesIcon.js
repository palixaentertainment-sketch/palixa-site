'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';

export default function MessagesIcon({ user }) {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    if (!configured || !user) { setCount(0); return; }
    const { count: unread, error } = await supabase.from('admin_message_recipients')
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
  return <Link href="/messages" className="notification-bell" aria-label={count ? `Messages, ${count} unread` : 'Messages'} title="Messages">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5h18v13H3z" /><path d="m4 7 8 6 8-6" /></svg>
    {count > 0 && <span className="notification-count">{count > 99 ? '99+' : count}</span>}
  </Link>;
}
