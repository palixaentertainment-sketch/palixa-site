'use client';

import { useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

function NewsletterEditor() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [buttonLabel, setButtonLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function uploadImage() {
    if (!imageFile) return imageUrl || null;
    if (!user) throw new Error('Please sign in again before uploading an image.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type)) throw new Error('Use a JPG, PNG or WebP image.');
    if (imageFile.size > 3 * 1024 * 1024) throw new Error('Newsletter images must be 3 MB or smaller.');
    const extension = imageFile.name.split('.').pop().toLowerCase();
    const path = user.id + '/newsletters/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + extension;
    const result = await supabase.storage.from('covers').upload(path, imageFile, { upsert: false, contentType: imageFile.type });
    if (result.error) throw new Error('Image upload failed: ' + result.error.message);
    return supabase.storage.from('covers').getPublicUrl(result.data.path).data.publicUrl;
  }

  async function send(e) {
    e.preventDefault();
    setBusy(true); setError(''); setSuccess('');
    try {
      const uploadedImage = await uploadImage();
      const { data, error: sendError } = await supabase.rpc('admin_send_palixia_newsletter', {
        p_title: title.trim(),
        p_body: body.trim(),
        p_image_url: uploadedImage,
        p_button_label: buttonLabel.trim() || null,
        p_link_url: linkUrl.trim() || null,
      });
      if (sendError) throw new Error(sendError.message);
      setSuccess('Newsletter published to ' + (data?.recipients ?? 'all') + ' active Palixia accounts.');
      setTitle(''); setBody(''); setImageFile(null); setImageUrl(''); setButtonLabel(''); setLinkUrl(''); setPreview(false);
    } catch (err) {
      setError(err.message || 'The newsletter could not be sent.');
    }
    setBusy(false);
  }

  return (
    <div className="stack narrow">
      <Link className="linkbtn" href="/admin">← Admin dashboard</Link>
      <div className="stack" style={{ gap: '.35rem' }}>
        <span className="eyebrow">OFFICIAL PALIXIA</span>
        <h1 className="h1">Newsletter</h1>
        <p className="muted">Create an update for everyone with an active Palixia account. It will appear in their Activity feed.</p>
      </div>
      {error && <p className="msg-err" role="alert">{error}</p>}
      {success && <p className="msg-ok" role="status">{success}</p>}
      <form className="card" onSubmit={send}>
        <div className="field">
          <label htmlFor="newsletter-title">Newsletter heading</label>
          <input id="newsletter-title" className="in" maxLength={140} required value={title} onChange={e => setTitle(e.target.value)} placeholder="What's happening on Palixia?" />
        </div>
        <div className="field">
          <label htmlFor="newsletter-body">Message</label>
          <textarea id="newsletter-body" className="in" rows={10} maxLength={10000} required value={body} onChange={e => setBody(e.target.value)} placeholder="Write your news, author spotlight or platform update…" />
          <span className="fine">{body.length.toLocaleString()} / 10,000 characters. Line breaks are preserved.</span>
        </div>
        <div className="field">
          <label htmlFor="newsletter-image">Optional image or book cover (JPG, PNG or WebP · max 3 MB)</label>
          <input id="newsletter-image" className="in" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImageFile(e.target.files?.[0] || null)} />
          {imageFile && <span className="fine">Selected: {imageFile.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="newsletter-button">Optional button text</label>
          <input id="newsletter-button" className="in" maxLength={50} value={buttonLabel} onChange={e => setButtonLabel(e.target.value)} placeholder="Read the story" />
        </div>
        <div className="field">
          <label htmlFor="newsletter-link">Optional link</label>
          <input id="newsletter-link" className="in" maxLength={500} value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://… or /book/…" />
          <span className="fine">Leave empty if the newsletter does not need a button.</span>
        </div>
        <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn ghost" onClick={() => setPreview(v => !v)}>{preview ? 'Hide preview' : 'Preview newsletter'}</button>
          <button className="btn" disabled={busy || !title.trim() || !body.trim()}>{busy ? 'Publishing…' : 'Publish to everyone'}</button>
        </div>
        {preview && (
          <section className="panel stack" style={{ padding: '1rem', borderRadius: '12px', border: '1px solid var(--line)' }}>
            <div className="row" style={{ alignItems: 'center', gap: '.7rem' }}><Avatar src="/brand/icon-512.png" name="Palixia" size="2.5rem" /><div><b>Palixia</b><div className="fine">OFFICIAL PALIXIA NEWS</div></div></div>
            <h2 className="h2">{title || 'Your newsletter heading'}</h2>
            {imageFile && <img src={URL.createObjectURL(imageFile)} alt="Newsletter preview" style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', borderRadius: '9px' }} />}
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{body || 'Your newsletter message will appear here.'}</p>
            {buttonLabel.trim() && linkUrl.trim() && <span className="btn" style={{ width: 'max-content' }}>{buttonLabel}</span>}
          </section>
        )}
        <p className="fine">Publishing sends an in-app Activity notification to all active accounts. Email delivery is not enabled yet; it will be connected after the email provider's broadcast API is verified.</p>
      </form>
    </div>
  );
}

export default function AdminNewsletterPage() {
  return <Guard roles={['admin']}><NewsletterEditor /></Guard>;
}
