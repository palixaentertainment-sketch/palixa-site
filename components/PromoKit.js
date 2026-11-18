'use client';
import { useState } from 'react';

export default function PromoKit({ book, authorName }) {
  const [copied, setCopied] = useState('');
  const bookUrl = typeof window !== 'undefined' ? window.location.origin + '/book/' + book.id : 'https://palixia.com/book/' + book.id;
  const title = book.title || 'My story';
  const author = authorName || 'An independent author';
  const caption = `I've published my story, “${title}”, on Palixia! 📚\n\nIf you enjoy discovering new stories, I'd love for you to give it a read. Reading is free.\n\nRead here: ${bookUrl}\n\n#ReadOnPalixia #Palixia`;
  const shortCaption = `Discover “${title}” by ${author} on Palixia. Read for free: ${bookUrl} #ReadOnPalixia`;

  async function copy(value, key) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('error');
    }
  }

  async function downloadGraphic() {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, '#2e1065');
    gradient.addColorStop(1, '#6d28d9');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(970, 120, 330, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9c8ff';
    ctx.font = '700 34px Arial';
    ctx.fillText('A STORY WORTH DISCOVERING', 82, 112);
    let coverDrawn = false;
    if (book.cover_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = book.cover_url;
        await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
        const maxW = 340, maxH = 510, scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, 82, 205, w, h);
        coverDrawn = true;
      } catch {}
    }
    const textX = coverDrawn ? 475 : 82;
    const textW = coverDrawn ? 520 : 900;
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 66px Georgia';
    const words = title.split(/\\s+/);
    let line = '', y = 340;
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > textW && line) {
        ctx.fillText(line, textX, y, textW); line = word; y += 82;
      } else line = next;
    }
    if (line) ctx.fillText(line, textX, y, textW);
    ctx.fillStyle = '#e9ddff';
    ctx.font = '42px Arial';
    ctx.fillText('by ' + author, textX, y + 100, textW);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 38px Arial';
    ctx.fillText('Read for free on Palixia', 82, 1120);
    ctx.fillStyle = '#e9ddff';
    ctx.font = '32px Arial';
    ctx.fillText('palixia.com', 82, 1190);
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.font = '24px Arial';
    ctx.fillText('Independent stories. Curious readers.', 82, 1270);
    const link = document.createElement('a');
    link.download = 'read-on-palixia-' + String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <section className="card" style={{ display: 'grid', gap: '.85rem' }}>
      <div className="sechead" style={{ marginBottom: 0 }}>
        <h3 className="h2" style={{ fontSize: '1.15rem' }}>Read on Palixia promo kit</h3>
        <span className="badge">Share your book</span>
      </div>
      <p className="fine">Ready-made materials to help more people discover “{title}”.</p>
      <div style={{ display: 'flex', gap: '.8rem', alignItems: 'center', minWidth: 0 }}>
        {book.cover_url ? <img src={book.cover_url} alt="" style={{ width: '3.5rem', height: '5rem', objectFit: 'cover', borderRadius: 4, flex: 'none' }} /> : null}
        <div style={{ minWidth: 0 }}>
          <b style={{ display: 'block', overflowWrap: 'anywhere' }}>{title}</b>
          <span className="fine">{author}</span>
          <a className="linkbtn" href={bookUrl} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '.85rem', overflowWrap: 'anywhere' }}>palixia.com/book/{book.id}</a>
        </div>
      </div>
      <div className="row">
        <button type="button" className="btn small" onClick={() => copy(bookUrl, 'link')}>{copied === 'link' ? 'Link copied' : 'Copy book link'}</button>
        <button type="button" className="btn ghost small" onClick={() => downloadGraphic()}>Download promo graphic</button>
      </div>
      <div style={{ display: 'grid', gap: '.4rem' }}>
        <b style={{ fontSize: '.9rem' }}>WhatsApp / Instagram caption</b>
        <p className="fine" style={{ whiteSpace: 'pre-wrap', padding: '.75rem', background: 'var(--surface)', borderRadius: 6 }}>{caption}</p>
        <div className="row">
          <button type="button" className="btn ghost small" onClick={() => copy(caption, 'caption')}>{copied === 'caption' ? 'Caption copied' : 'Copy caption'}</button>
          <a className="btn small" href={'https://wa.me/?text=' + encodeURIComponent(caption)} target="_blank" rel="noreferrer">Share on WhatsApp</a>
        </div>
      </div>
      <div style={{ display: 'grid', gap: '.4rem' }}>
        <b style={{ fontSize: '.9rem' }}>Short social caption</b>
        <p className="fine" style={{ padding: '.75rem', background: 'var(--surface)', borderRadius: 6 }}>{shortCaption}</p>
        <button type="button" className="btn ghost small" style={{ justifySelf: 'start' }} onClick={() => copy(shortCaption, 'short')}>{copied === 'short' ? 'Caption copied' : 'Copy short caption'}</button>
      </div>
      {copied === 'error' && <p className="fine" role="status">Copy wasn't available in this browser. You can select the caption and copy it manually.</p>}
    </section>
  );
}
