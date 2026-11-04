'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import styles from './notifications.module.css';

function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function kindLabel(kind) {
  return ({
    community_like: 'Community',
    community_comment: 'Comment',
    follow: 'New follower',
    new_book: 'New book',
    new_chapter: 'New chapter',
    palixia_news: 'Palixia news',
  })[kind] || 'Activity';
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
      setError('Notifications could not be loaded. Please try again.');
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
      setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row));
    }
    window.location.href = item.link_url || '/community';
  }

  async function markAllRead() {
    if (!user) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase.from('notifications').update({ read_at: readAt }).eq('recipient_id', user.id).is('read_at', null);
    if (updateError) setError('Could not mark notifications as read. Please try again.');
    else setItems(current => current.map(item => ({ ...item, read_at: item.read_at || readAt })));
  }

  if (loading) return <section className="stack"><h1 className="h1">Activity</h1><p className="muted">Loading…</p></section>;
  if (!user) return <section className="stack"><h1 className="h1">Activity</h1><p>Log in to view your activity.</p><Link className="btn" href="/login">Log in</Link></section>;

  return (
    <section className="stack">
      <div className={styles.header}>
        <div><span className="eyebrow">YOUR PALIXIA</span><h1 className="h1">Activity</h1><p className="muted">Updates from authors and readers connected to you.</p></div>
        <button className="btn ghost small" onClick={markAllRead} disabled={!items.some(item => !item.read_at)}>Mark all read</button>
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      {busy && <p className="muted">Loading your activity…</p>}
      {!busy && !error && items.length === 0 && <div className="empty"><b>You’re all caught up.</b><p className="muted">New books, chapters, follows and conversations from your Palixia community will appear here.</p><Link className="btn ghost small" href="/discover">Discover stories</Link></div>}
      <div className={styles.feed}>
        {items.map(item => {
          const actor = item.profiles;
          const official = item.kind === 'palixia_news';
          return (
            <button key={item.id} type="button" onClick={() => openNotification(item)} className={`${styles.card} ${!item.read_at ? styles.cardUnread : ''}`}>
              <span className={styles.avatarWrap}>
                <Avatar src={official ? '/brand/icon-512.png' : actor?.avatar_url} name={official ? 'Palixia' : actor?.name || 'Palixia member'} size="3rem" />
              </span>
              <span className={styles.copy}>
                <span className={styles.kind}>{kindLabel(item.kind)}</span>
                <p><span className={styles.actor}>{official ? 'Palixia' : actor?.name || 'A Palixia member'}</span>{' '}{item.message}</p>
                <small>{timeLabel(item.created_at)}{actor?.username && !official ? ` · @${actor.username}` : ''}</small>
              </span>
              {!item.read_at && <span className={styles.unread} aria-label="Unread" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
