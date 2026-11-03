'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase, configured } from '@/lib/supabase';

const storageKey = (id) => 'palixia:announcement-read:' + id;

export default function CommunityAnnouncement() {
  const { user, loading: authLoading } = useAuth();
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    let alive = true;

    async function loadAnnouncement() {
      setLoading(true);
      setError('');
      if (!configured) { setLoading(false); return; }

      const { data, error: fetchError } = await supabase
        .from('community_announcements')
        .select('id,title,body,button_label,image_url,link_label,link_url')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;
      if (fetchError || !data) {
        setAnnouncement(null);
        setLoading(false);
        return;
      }

      if (user) {
        const { data: readRow, error: readError } = await supabase
          .from('announcement_reads')
          .select('announcement_id')
          .eq('announcement_id', data.id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!alive) return;
        if (readError) {
          setAnnouncement(null);
          setLoading(false);
          return;
        }
        setAnnouncement(readRow ? null : data);
      } else {
        let alreadyRead = false;
        try { alreadyRead = window.localStorage.getItem(storageKey(data.id)) === '1'; } catch {}
        setAnnouncement(alreadyRead ? null : data);
      }
      setLoading(false);
    }

    loadAnnouncement();
    return () => { alive = false; };
  }, [user, authLoading]);

  useEffect(() => {
    if (!announcement) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [announcement]);

  async function acknowledge() {
    if (!announcement || saving) return;
    setSaving(true);
    setError('');

    if (user) {
      const { error: saveError } = await supabase.from('announcement_reads').insert({
        announcement_id: announcement.id,
        user_id: user.id,
      });
      if (saveError && saveError.code !== '23505') {
        setError("We couldn't save that you've read this message. Please try again.");
        setSaving(false);
        return;
      }
    } else {
      try {
        window.localStorage.setItem(storageKey(announcement.id), '1');
      } catch {
        setError('Your browser could not save this acknowledgement. Please enable site storage and try again.');
        setSaving(false);
        return;
      }
    }

    setAnnouncement(null);
    setSaving(false);
  }

  if (loading || !announcement) return null;

  return (
    <div className="community-announcement-backdrop">
      <section
        className="community-announcement"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-announcement-title"
        aria-describedby="community-announcement-body"
      >
        <div className="community-announcement-brand">
          <span className="community-announcement-mark" aria-hidden="true">✦</span>
          <div>
            <p className="community-announcement-eyebrow">PALIXIA COMMUNITY</p>
            <p className="community-announcement-subtitle">A message for our readers</p>
          </div>
        </div>
        <h2 id="community-announcement-title">{announcement.title}</h2>
        {announcement.image_url && <img className="community-announcement-image" src={announcement.image_url} alt="" />}
        <div id="community-announcement-body" className="community-announcement-body">{announcement.body}</div>
        {announcement.link_url && announcement.link_label && <a className="btn ghost community-announcement-link" href={announcement.link_url} target={/^https:\/\//i.test(announcement.link_url) ? '_blank' : undefined} rel={/^https:\/\//i.test(announcement.link_url) ? 'noopener noreferrer' : undefined}>{announcement.link_label}</a>}
        {error && <p className="msg-err" role="alert">{error}</p>}
        <button className="btn community-announcement-ack" type="button" onClick={acknowledge} disabled={saving}>
          {saving ? 'Saving…' : (announcement.button_label || "I've read this")}
        </button>
      </section>
    </div>
  );
}
