'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';

const blank = { title: '', body: '', button_label: "I've read this", image_url: '', link_label: '', link_url: '', is_active: false };

function AnnouncementManager() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('community_announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (queryError) {
      setError('Announcement management needs its database setup. Run supabase/community_announcements.sql in the Supabase SQL Editor, then refresh. Details: ' + queryError.message);
    } else setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function edit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      body: item.body || '',
      button_label: item.button_label || "I've read this",
      image_url: item.image_url || '',
      link_label: item.link_label || '',
      link_url: item.link_url || '',
      is_active: Boolean(item.is_active),
    });
    setImageFile(null);
    setRemoveImage(false);
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setEditingId('');
    setForm(blank);
    setImageFile(null);
    setRemoveImage(false);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!form.title.trim() || !form.body.trim()) {
      setError('Add both a heading and a message before saving.');
      return;
    }
    setBusy(true);
    try {
      let imageUrl = removeImage ? null : form.image_url;
      if (imageFile) {
        if (!user) throw new Error('Please sign in again before uploading an image.');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) throw new Error('Use a JPG, PNG or WebP image.');
        if (imageFile.size > 2 * 1024 * 1024) throw new Error('Announcement images must be 2 MB or smaller.');
        const extension = imageFile.name.split('.').pop().toLowerCase();
        const path = user.id + '/community-announcements/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + extension;
        const upload = await supabase.storage.from('covers').upload(path, imageFile, { upsert: false, contentType: imageFile.type });
        if (upload.error) throw new Error('Image upload failed. Please try again.');
        imageUrl = supabase.storage.from('covers').getPublicUrl(upload.data.path).data.publicUrl;
      }
      const linkUrl = form.link_url.trim();
      if (linkUrl && !(/^https:\/\//i.test(linkUrl) || (linkUrl.startsWith('/') && !linkUrl.startsWith('//')))) throw new Error('Use a full https:// link or a Palixia path beginning with a single /.');
      if (linkUrl && !form.link_label.trim()) throw new Error('Add button text for your optional link.');
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        button_label: form.button_label.trim() || "I've read this",
        image_url: imageUrl || null,
        link_label: linkUrl ? form.link_label.trim() : null,
        link_url: linkUrl || null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };
      const result = editingId
        ? await supabase.from('community_announcements').update(payload).eq('id', editingId)
        : await supabase.from('community_announcements').insert(payload);
      if (result.error) {
      setError(result.error.code === '23505'
        ? 'Another announcement is already active. Deactivate it before publishing this one.'
        : 'Could not save the announcement. ' + result.error.message);
      } else {
        setMessage(editingId ? 'Announcement updated.' : 'Announcement created.');
        reset();
        await load();
      }
    } catch (uploadError) {
      setError(uploadError.message || 'Could not save the announcement.');
    }
    setBusy(false);
  }

  async function toggle(item) {
    setBusy(true);
    setError('');
    setMessage('');
    const { error: updateError } = await supabase
      .from('community_announcements')
      .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    if (updateError) {
      setError(updateError.code === '23505'
        ? 'Another announcement is already active. Deactivate it first.'
        : 'Could not change the announcement status. ' + updateError.message);
    } else {
      setMessage(item.is_active ? 'Announcement deactivated.' : 'Announcement published.');
      await load();
    }
    setBusy(false);
  }

  return (
    <div className="stack narrow">
      <Link className="linkbtn" href="/admin">← Admin dashboard</Link>
      <h1 className="h1">Community announcements</h1>
      <p className="fine">Create a message that appears when visitors enter the website. Only one announcement can be active at a time. Readers who acknowledge it will not see that same announcement again.</p>
      {error && <p className="msg-err" role="alert">{error}</p>}
      {message && <p className="msg-ok" role="status">{message}</p>}

      <form className="panel stack" onSubmit={save} style={{ padding: '1rem', border: '1px solid var(--line)', borderRadius: '.8rem' }}>
        <h2 className="h2">{editingId ? 'Edit announcement' : 'Create announcement'}</h2>
        <div className="field">
          <label htmlFor="announcement-title">Heading</label>
          <input id="announcement-title" className="in" maxLength={120} required value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder="PALIXIA FRIDAY IS COMING!" />
        </div>
        <div className="field">
          <label htmlFor="announcement-body">Message</label>
          <textarea id="announcement-body" className="in" rows={9} maxLength={4000} required value={form.body} onChange={e => setForm(v => ({ ...v, body: e.target.value }))} placeholder="Write the message readers will see…" />
          <span className="fine">Line breaks are preserved in the pop-up.</span>
        </div>
        <div className="field">
          <label htmlFor="announcement-image">Optional image (JPG, PNG or WebP · max 2 MB)</label>
          <input id="announcement-image" className="in" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setImageFile(e.target.files?.[0] || null); setRemoveImage(false); }} />
          {(form.image_url && !removeImage && !imageFile) && <div><img src={form.image_url} alt="Current announcement" style={{ display: 'block', width: 'min(100%, 220px)', maxHeight: '140px', objectFit: 'contain', borderRadius: '.6rem', marginTop: '.5rem' }} /><button type="button" className="linkbtn" onClick={() => setRemoveImage(true)}>Remove current image</button></div>}
          {imageFile && <p className="fine">Selected: {imageFile.name}</p>}
          <span className="fine">Images are displayed at a modest size in the pop-up.</span>
        </div>
        <div className="field">
          <label htmlFor="announcement-link-label">Optional link button text</label>
          <input id="announcement-link-label" className="in" maxLength={50} value={form.link_label} onChange={e => setForm(v => ({ ...v, link_label: e.target.value }))} placeholder="Explore the book" />
        </div>
        <div className="field">
          <label htmlFor="announcement-link-url">Optional link</label>
          <input id="announcement-link-url" className="in" maxLength={500} value={form.link_url} onChange={e => setForm(v => ({ ...v, link_url: e.target.value }))} placeholder="https://… or /book/…" />
          <span className="fine">Leave both link fields empty if the announcement does not need a link.</span>
        </div>
        <div className="field">
          <label htmlFor="announcement-button">Acknowledgement button</label>
          <input id="announcement-button" className="in" maxLength={40} value={form.button_label} onChange={e => setForm(v => ({ ...v, button_label: e.target.value }))} />
        </div>
        <label className="row" style={{ gap: '.55rem' }}>
          <input type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} />
          <span>Publish this announcement immediately</span>
        </label>
        <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create announcement'}</button>
          {editingId && <button type="button" className="btn ghost" disabled={busy} onClick={reset}>Cancel</button>}
        </div>
      </form>

      <section className="stack">
        <h2 className="h2">Saved announcements</h2>
        {loading ? <p className="muted">Loading announcements…</p> : items.length === 0 ? <p className="fine">No announcements yet.</p> : items.map(item => (
          <article key={item.id} className="panel stack" style={{ padding: '1rem', border: '1px solid var(--line)', borderRadius: '.8rem' }}>
            <div className="row between">
              <b>{item.title}</b>
              <span className={item.is_active ? 'badge live' : 'badge draft'}>{item.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <p className="fine" style={{ whiteSpace: 'pre-line' }}>{item.body}</p>
            <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn ghost small" disabled={busy} onClick={() => edit(item)}>Edit</button>
              <button type="button" className="btn small" disabled={busy} onClick={() => toggle(item)}>{item.is_active ? 'Deactivate' : 'Publish'}</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export default function CommunityAnnouncementsPage() {
  return <Guard roles={['admin']}><AnnouncementManager /></Guard>;
}
