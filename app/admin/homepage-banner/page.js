'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import Guard from '@/components/Guard';

const blank = { alt_text: 'Palixia promotion', link_url: '', is_active: true };

function HomepageBannerManager() {
  const { user } = useAuth();
  const [banners, setBanners] = useState([]);
  const [settings, setSettings] = useState({ display_seconds: 5 });
  const [file, setFile] = useState(null);
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const [bannerResult, settingsResult] = await Promise.all([
      supabase.from('homepage_banners').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('homepage_banner_settings').select('display_seconds').eq('id', true).maybeSingle(),
    ]);
    if (bannerResult.error || settingsResult.error) {
      setError('Promotional banners need the database update. Run supabase/homepage_banners.sql in Supabase SQL Editor, then refresh. ' + (bannerResult.error?.message || settingsResult.error?.message || ''));
    } else {
      setBanners(bannerResult.data || []);
      setSettings({ display_seconds: settingsResult.data?.display_seconds || 5 });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function validateLink(value) {
    const link = value.trim();
    if (link && !(/^https:\/\//i.test(link) || (link.startsWith('/') && !link.startsWith('//')))) {
      throw new Error('Use a full https:// link or a Palixia path beginning with a single /.');
    }
    return link || null;
  }

  async function uploadImage(selectedFile) {
    if (!selectedFile) return null;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) throw new Error('Choose a JPG, PNG or WebP image.');
    if (selectedFile.size > 2 * 1024 * 1024) throw new Error('Each banner image must be 2 MB or smaller.');
    if (!user) throw new Error('Please sign in again before uploading.');
    const extension = selectedFile.name.split('.').pop().toLowerCase();
    const path = user.id + '/homepage-banners/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + extension;
    const result = await supabase.storage.from('covers').upload(path, selectedFile, { upsert: false, contentType: selectedFile.type });
    if (result.error) throw new Error('Image upload failed: ' + result.error.message);
    return supabase.storage.from('covers').getPublicUrl(result.data.path).data.publicUrl;
  }

  async function addBanner(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (!file) throw new Error('Choose a banner image first.');
      const image_url = await uploadImage(file);
      const { error: insertError } = await supabase.from('homepage_banners').insert({
        image_url, alt_text: form.alt_text.trim() || 'Palixia promotion',
        link_url: validateLink(form.link_url), is_active: form.is_active,
        sort_order: banners.length,
      });
      if (insertError) throw new Error('Could not add banner: ' + insertError.message);
      setFile(null); setForm(blank); setMessage('Promotional banner added.');
      await load();
    } catch (e) { setError(e.message || 'Could not add banner.'); }
    setBusy(false);
  }

  async function updateBanner(banner, changes) {
    setBusy(true); setError(''); setMessage('');
    const { error: updateError } = await supabase.from('homepage_banners').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', banner.id);
    if (updateError) setError('Could not update banner: ' + updateError.message);
    else { setMessage('Banner updated.'); await load(); }
    setBusy(false);
  }

  async function deleteBanner(banner) {
    if (!window.confirm('Delete this promotional banner?')) return;
    setBusy(true); setError(''); setMessage('');
    const { error: deleteError } = await supabase.from('homepage_banners').delete().eq('id', banner.id);
    if (deleteError) setError('Could not delete banner: ' + deleteError.message);
    else { setMessage('Banner deleted.'); await load(); }
    setBusy(false);
  }

  async function saveSettings(e) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    const { error: settingsError } = await supabase.from('homepage_banner_settings').upsert({
      id: true, display_seconds: Math.min(10, Math.max(3, Number(settings.display_seconds) || 5)), updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (settingsError) setError('Could not save rotation speed: ' + settingsError.message);
    else { setMessage('Banner rotation speed saved.'); await load(); }
    setBusy(false);
  }

  return (
    <div className="stack">
      <Link className="linkbtn" href="/admin">← Admin dashboard</Link>
      <div className="stack">
        <h1 className="h1">Promotional banners</h1>
        <p className="fine">Upload as many banners as you need. Active banners rotate automatically on the homepage. Each banner can link to a book, event, competition or any Palixia page.</p>
      </div>
      {error && <p className="msg-err" role="alert">{error}</p>}
      {message && <p className="msg-ok" role="status">{message}</p>}
      {loading ? <p className="muted">Loading banners…</p> : (
        <>
          <form className="panel stack" onSubmit={saveSettings} style={{ padding: '1rem', border: '1px solid var(--line)', borderRadius: '.8rem' }}>
            <h2 className="h2">Rotation speed</h2>
            <div className="field">
              <label htmlFor="banner-seconds">Seconds per banner</label>
              <select id="banner-seconds" className="in" value={settings.display_seconds} onChange={e => setSettings({ display_seconds: Number(e.target.value) })}>
                {[3, 5, 7, 10].map(seconds => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
              </select>
              <span className="fine">Default is 5 seconds. The carousel pauses while a visitor hovers over it.</span>
            </div>
            <button className="btn" disabled={busy}>Save rotation speed</button>
          </form>

          <form className="panel stack" onSubmit={addBanner} style={{ padding: '1rem', border: '1px solid var(--line)', borderRadius: '.8rem' }}>
            <h2 className="h2">Add a promotional banner</h2>
            <div className="field">
              <label htmlFor="banner-image">Banner image (JPG, PNG or WebP · max 2 MB)</label>
              <input id="banner-image" className="in" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} />
              <span className="fine">Upload the artwork as you want it displayed. Original image proportions are preserved.</span>
            </div>
            {file && <div className="stack"><img src={URL.createObjectURL(file)} alt="New banner preview" style={{ width: '100%', height: 'auto', borderRadius: '.6rem' }} /><span className="fine">{file.name}</span></div>}
            <div className="field">
              <label htmlFor="banner-alt">Image description</label>
              <input id="banner-alt" className="in" maxLength={180} value={form.alt_text} onChange={e => setForm(v => ({ ...v, alt_text: e.target.value }))} />
            </div>
            <div className="field">
              <label htmlFor="banner-link">Destination when clicked (optional)</label>
              <input id="banner-link" className="in" maxLength={1000} value={form.link_url} onChange={e => setForm(v => ({ ...v, link_url: e.target.value }))} placeholder="/discover or https://…" />
            </div>
            <label className="row" style={{ gap: '.55rem' }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} />
              <span>Publish this banner immediately</span>
            </label>
            <button className="btn" disabled={busy || !file}>{busy ? 'Saving…' : 'Add banner'}</button>
          </form>

          <section className="stack">
            <div className="row between"><h2 className="h2">Your banners ({banners.length})</h2><span className="fine">{banners.filter(b => b.is_active).length} active</span></div>
            {banners.length === 0 ? <p className="muted">No promotional banners yet. Add your first one above.</p> : banners.map((banner, index) => (
              <article key={banner.id} className="panel stack" style={{ padding: '1rem', border: '1px solid var(--line)', borderRadius: '.8rem' }}>
                <img src={banner.image_url} alt={banner.alt_text || 'Promotional banner preview'} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '.5rem' }} />
                <div className="row between">
                  <b>Banner {index + 1}</b>
                  <span className="fine">{banner.is_active ? 'Active on homepage' : 'Hidden'}</span>
                </div>
                <div className="field">
                  <label htmlFor={'banner-alt-' + banner.id}>Image description</label>
                  <input id={'banner-alt-' + banner.id} className="in" maxLength={180} defaultValue={banner.alt_text || ''} onBlur={e => e.target.value !== (banner.alt_text || '') && updateBanner(banner, { alt_text: e.target.value.trim() || 'Palixia promotion' })} />
                </div>
                <div className="field">
                  <label htmlFor={'banner-link-' + banner.id}>Destination link</label>
                  <input id={'banner-link-' + banner.id} className="in" maxLength={1000} defaultValue={banner.link_url || ''} placeholder="/discover or https://…" onBlur={e => {
                    try { const link = validateLink(e.target.value); if (link !== (banner.link_url || null)) updateBanner(banner, { link_url: link }); }
                    catch (err) { setError(err.message); e.target.value = banner.link_url || ''; }
                  }} />
                </div>
                <div className="row" style={{ gap: '.6rem', flexWrap: 'wrap' }}>
                  <button type="button" className={banner.is_active ? 'btn ghost' : 'btn'} disabled={busy} onClick={() => updateBanner(banner, { is_active: !banner.is_active })}>{banner.is_active ? 'Hide banner' : 'Publish banner'}</button>
                  <button type="button" className="btn ghost" disabled={busy} onClick={() => deleteBanner(banner)}>Delete</button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

export default function HomepageBannerPage() {
  return <Guard roles={['admin']}><HomepageBannerManager /></Guard>;
}
