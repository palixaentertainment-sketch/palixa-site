'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function timeLabel(value) {
  const date = new Date(value);
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user || !configured) { setItems([]); setBusy(false); return; }
    setBusy(true);
    const { data, error: queryError } = await supabase.from('notifications')
      .select('id,kind,message,link_url,read_at,created_at,profiles!notifications_actor_id_fkey(name,username,avatar_url)')
      .eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(60);
    if (queryError) {
      setError('Notifications need to be enabled in the Palixia database first.');
      setItems([]);
    } else {
      setError('');
      setItems(data || []);
    }
    setBusy(false);
  }, [user]);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  async function openNotification(item) {
    if (!item.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id).eq('recipient_id', user.id);
    }
    window.location.href = item.link_url || '/community';
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', user.id).is('read_at', null);
    await load();
  }

  if (loading) return <section className="stack"><h1 className="h1">Notifications</h1><p className="muted">Loading…</p></section>;
  if (!user) return <section className="stack"><h1 className="h1">Notifications</h1><p>Log in to view your notifications.</p><Link className="btn" href="/login">Log in</Link></section>;

  return (
    <section className="stack">
      <div className="sechead"><h1 className="h1">Notifications</h1><button className="btn ghost small" onClick={markAllRead}>Mark all read</button></div>
      {error && <p className="notice">{error} Run <code>supabase/notifications.sql</code> in Supabase SQL Editor, then refresh.</p>}
      {busy && <p className="muted">Loading notifications…</p>}
      {!busy && !error && items.length === 0 && <div className="empty"><b>You’re all caught up.</b><p className="muted">Likes, comments, new followers, new books from authors you follow, and new chapters from followed or saved books will show up here.</p></div>}
      {items.map((item) => {
        const actor = item.profiles;
        return <button key={item.id} type="button" onClick={() => openNotification(item)} className="notification-item" style={{ background: item.read_at ? 'var(--bg)' : 'var(--surface)' }}>
          <span className="notification-dot" aria-hidden="true" style={{ opacity: item.read_at ? 0 : 1 }} />
          <span className="notification-copy"><b>{actor?.name || 'A Palixia member'}</b> {item.message}<small>{timeLabel(item.created_at)}</small></span>
        </button>;
      })}
    </section>
  );
}
