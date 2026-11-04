'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import styles from './notifications.module.css';

const filters = [{ id: 'all', label: 'Everything' }, { id: 'reading', label: 'Reading' }, { id: 'people', label: 'People' }, { id: 'palixia', label: 'Palixia' }];
function timeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function kindLabel(kind) {
  return ({ community_like: 'Community', community_comment: 'Conversation', follow: 'New follower', new_book: 'A new story', new_chapter: 'New chapter', palixia_news: 'From Palixia' })[kind] || 'Activity';
}
function belongsToFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'reading') return ['new_book', 'new_chapter'].includes(item.kind);
  if (filter === 'people') return ['follow', 'community_like', 'community_comment'].includes(item.kind);
  return item.kind === 'palixia_news';
}
export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const load = useCallback(async () => {
    if (!user || !configured) { setItems([]); setBusy(false); return; }
    setBusy(true);
    const { data, error: queryError } = await supabase.from('notifications')
      .select('id,kind,message,link_url,read_at,created_at,newsletter_title,newsletter_body,newsletter_image_url,newsletter_button_label,profiles!notifications_actor_id_fkey(name,username,avatar_url)')
      .eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(60);
    if (queryError) { setError('Your activity could not be loaded. Please try again.'); setItems([]); }
    else { setError(''); setItems(data || []); }
    setBusy(false);
  }, [user]);
  useEffect(() => { if (!loading) load(); }, [loading, load]);
  const visibleItems = useMemo(() => items.filter(item => belongsToFilter(item, activeFilter)), [items, activeFilter]);
  const unreadCount = items.filter(item => !item.read_at).length;
  async function openNotification(item) {
    if (!item.read_at) {
      const readAt = new Date().toISOString();
      await supabase.from('notifications').update({ read_at: readAt }).eq('id', item.id).eq('recipient_id', user.id);
      setItems(current => current.map(row => row.id === item.id ? { ...row, read_at: readAt } : row));
    }
    window.location.href = item.link_url || '/community';
  }
  async function markAllRead() {
    if (!user || !unreadCount) return;
    const readAt = new Date().toISOString();
    const { error: updateError } = await supabase.from('notifications').update({ read_at: readAt }).eq('recipient_id', user.id).is('read_at', null);
    if (updateError) setError('Could not mark activity as read. Please try again.');
    else setItems(current => current.map(item => ({ ...item, read_at: item.read_at || readAt })));
  }
  if (loading) return <section className="stack"><h1 className="h1">Activity</h1><p className="muted">Loading…</p></section>;
  if (!user) return <section className="stack"><h1 className="h1">Activity</h1><p>Log in to see what’s happening in your Palixia community.</p><Link className="btn" href="/login">Log in</Link></section>;
  return (
    <section className={'stack ' + styles.page}>
      <header className={styles.masthead}>
        <div className={styles.headingCopy}>
          <span className={styles.kicker}>YOUR STORY COMMUNITY</span>
          <h1 className={styles.title}>The latest from<br /><em>your Palixia.</em></h1>
          <p className={styles.subtitle}>Stories, people and little moments worth catching up on.</p>
        </div>
        <div className={styles.issueMark} aria-hidden="true"><span>PALIXIA</span><b>✳</b><small>YOUR<br />READING<br />CIRCLE</small></div>
      </header>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="tablist" aria-label="Activity categories">
          {filters.map(filter => <button key={filter.id} type="button" role="tab" aria-selected={activeFilter === filter.id}
            className={activeFilter === filter.id ? styles.filterActive : styles.filter}
            onClick={() => setActiveFilter(filter.id)}>{filter.label}</button>)}
        </div>
        <button className={styles.readButton} onClick={markAllRead} disabled={!unreadCount}>{unreadCount ? 'Mark all read · ' + unreadCount : 'All caught up'}</button>
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      {busy && <p className="muted">Gathering your latest activity…</p>}
      {!busy && !error && visibleItems.length === 0 && <div className={styles.emptyState}>
        <span className={styles.emptyGlyph}>✳</span>
        <h2>{items.length ? 'Nothing in this corner yet.' : 'A little quiet for now.'}</h2>
        <p>{items.length ? 'Try another section to see more of your Palixia activity.' : 'When authors you follow publish, readers connect, or Palixia shares news, you’ll find it here.'}</p>
        <Link className="btn ghost small" href="/discover">Find your next story</Link>
      </div>}
      <div className={styles.feed}>
        {visibleItems.map(item => {
          const actor = item.profiles;
          const official = item.kind === 'palixia_news';
          return <button key={item.id} type="button" onClick={() => openNotification(item)}
            className={[styles.card, official ? styles.officialCard : '', !item.read_at ? styles.cardUnread : ''].join(' ')}>
            <span className={styles.timeline}><span className={styles.timelineDot} /></span>
            <span className={styles.avatarWrap}><Avatar src={official ? '/brand/icon-512.png' : actor?.avatar_url} name={official ? 'Palixia' : actor?.name || 'Palixia member'} size="2.75rem" /></span>
            <span className={styles.copy}>
              <span className={styles.cardTopline}><span className={styles.kind}>{kindLabel(item.kind)}</span><small className={styles.timestamp}>{timeLabel(item.created_at)}</small></span>
              <span className={styles.message}><strong>{official ? 'Palixia' : actor?.name || 'A Palixia member'}</strong>{' '}{item.message}</span>
              {official && item.newsletter_title && <strong className={styles.newsTitle}>{item.newsletter_title}</strong>}
              {official && item.newsletter_body && <span className={styles.newsBody}>{item.newsletter_body}</span>}
              {official && item.newsletter_image_url && <img className={styles.newsImage} src={item.newsletter_image_url} alt="" loading="lazy" />}
              {official && item.newsletter_button_label && item.link_url && <span className={styles.actionLink}>{item.newsletter_button_label} <span aria-hidden="true">↗</span></span>}
              {!official && actor?.username && <small className={styles.handle}>@{actor.username}</small>}
            </span>
            {!item.read_at && <span className={styles.unread} aria-label="Unread" />}
          </button>;
        })}
      </div>
    </section>
  );
}
