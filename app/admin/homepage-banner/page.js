'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';

const empty = { image_url: '', alt_text: 'Palixia announcement', link_url: '', is_active: false };

function HomepageBannerManager() {
  const { user } = useAuth();
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase.from('homepage_banner').select('*').eq('id', true).maybeSingle();
    if (queryError) {
      setError('Homepage banner needs its database setup. Run supabase/homepage_banner.sql in Supabase SQL Editor, then refresh. Details: ' + queryError.message);
    } else if (data) {
      setForm({ image_url: data.image_url || '', alt_text: data.alt_text || 'Palixia announcement', link_url: data.link_url || '', is_active: Boolean(data.is_active) });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      let imageUrl = form.image_url || null;
      if (file) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
        if (file.size > 2 * 1024 * 1024) throw new Error('The banner image must be 2 MB or smaller.');
        if (!user) throw new Error('Please sign in again before uploading.');
        const extension = file.name.split('.').pop().toLowerCase();
        const path = user.id + '/homepage-banner/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + extension;
        const upload = await supabase.storage.from('covers').upload(path, file, { upsert: false, contentType: file.type });
        if (upload.error) throw new Error('Image upload failed: ' + upload.error.message);
        imageUrl = supabase.storage.from('covers').getPublicUrl(upload.data.path).data.publicUrl;
      }
      const linkUrl = form.link_url.trim();
      if (linkUrl && !(/^https:\/\//i.test(linkUrl) || (linkUrl.startsWith('/') && !linkUrl.startsWith('//')))) {
        throw new Error('Use a full https:// link or a Palixia path beginning with a single /.');
      }
      if (!imageUrl && form.is_active) throw new Error('Upload a banner image before publishing it.');
      const { error: saveError } = await supabase.from('homepage_banner').upsert({
        id: true,
        image_url: imageUrl,
        alt_text: form.alt_text.trim() || 'Palixia announcement',
        link_url: linkUrl || null,
        is_active: Boolean(form.is_active && imageUrl),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (saveError) throw new Error('Could not save the banner: ' + saveError.message);
      setMessage(form.is_active && imageUrl ? 'Homepage banner published.' : 'Homepage banner settings saved.');
      setFile(null);
      await load();
    } catch (e) {
      setError(e.message || 'Could not save the banner.');
    }
    setBusy(false);
  }

  async function removeBanner() {
    if (!window.confirm('Remove the homepage banner? The homepage will return to its normal layout.')) return;
    setBusy(true); setError(''); setMessage('');
    const { error: removeError } = await supabase.from('homepage_banner').upsert({
      id: true, image_url: null, alt_text: 'Palixia announcement', link_url: null, is_active: false, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (removeError) setError('Could not remove the banner: ' + removeError.message);
    else {
      setForm(empty); setFile(null);
      setMessage('Banner removed. The homepage section is now hidden.');
    }
    setBusy(false);
  }

  return (
    <div className="stack narrow">
      <Link className="linkbtn" href="/admin">← Admin dashboard</Link>
      <h1 className="h1">Homepage banner</h1>
      <p className="fine">Upload an image for the homepage announcement space. When no banner is published, the entire section disappears and the homepage returns to its normal layout.</p>
      {error && <p className="msg-err" role="alert">{error}</p>}
      {message && <p className="msg-ok" role="status">{message}</p>}
      {loading ? <p className="muted">Loading banner settings…</p> : (
        <form className="panel stack" onSubmit={save} style={{ padding: '1rem', border: '1px solid var(--line)', borderRadius: '.8rem' }}>
          <div className="field">
            <label htmlFor="homepage-banner-file">Banner image (JPG, PNG or WebP · max 2 MB)</label>
            <input id="homepage-banner-file" className="in" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} />
            <span className="fine">Use the artwork exactly as you want it displayed. The image keeps its original proportions.</span>
          </div>
          {(file || form.image_url) && <div className="stack"><span className="fine">Preview</span><img src={file ? URL.createObjectURL(file) : form.image_url} alt="Banner preview" style={{ display: 'block', width: '100%', height: 'auto', border: '1px solid var(--line)', borderRadius: '.6rem' }} />{file && <span className="fine">Selected: {file.name}</span>}</div>}
          <div className="field">
            <label htmlFor="homepage-banner-alt">Image description (accessibility)</label>
            <input id="homepage-banner-alt" className="in" maxLength={180} value={form.alt_text} onChange={e => setForm(v => ({ ...v, alt_text: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="homepage-banner-link">Optional destination when clicked</label>
            <input id="homepage-banner-link" className="in" maxLength={1000} value={form.link_url} onChange={e => setForm(v => ({ ...v, link_url: e.target.value }))} placeholder="/short-story-challenge or https://…" />
          </div>
          <label className="row" style={{ gap: '.55rem' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} />
            <span>Show this banner on the homepage</span>
          </label>
          <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
            <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save banner'}</button>
            <button type="button" className="btn ghost" disabled={busy || (!form.image_url && !form.is_active)} onClick={removeBanner}>Remove banner</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function HomepageBannerPage() {
  return <Guard roles={['admin']}><HomepageBannerManager /></Guard>;
}
