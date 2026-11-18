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

    // Editorial-style 4:5 poster with the book cover as the main visual.
    const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
    bg.addColorStop(0, '#160b32');
    bg.addColorStop(.52, '#32106b');
    bg.addColorStop(1, '#6d28d9');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1350);

    // Decorative orbital shapes and fine framing.
    ctx.strokeStyle = 'rgba(226,210,255,.18)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(980, 170, 300, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(980, 170, 250, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.055)';
    ctx.beginPath(); ctx.arc(85, 1110, 260, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.strokeRect(52, 52, 976, 1246);

    // Brand header.
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 34px Arial';
    ctx.fillText('PALIXIA', 82, 112);
    ctx.fillStyle = '#d9c8ff';
    ctx.font = '500 22px Arial';
    ctx.fillText('INDEPENDENT STORIES. CURIOUS READERS.', 82, 151);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e9ddff';
    ctx.font = '700 21px Arial';
    ctx.fillText('BOOK SPOTLIGHT', 998, 112);
    ctx.textAlign = 'left';

    // Cover panel with shadow. If the remote image cannot be loaded, create a designed cover placeholder.
    const coverX = 340, coverY = 205, coverW = 400, coverH = 590;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.42)';
    ctx.shadowBlur = 38;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = '#241044';
    ctx.fillRect(coverX, coverY, coverW, coverH);
    ctx.restore();

    let coverDrawn = false;
    if (book.cover_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = book.cover_url;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          window.setTimeout(() => reject(new Error('Cover image timed out')), 8000);
        });
        const scale = Math.max(coverW / img.width, coverH / img.height);
        const sw = coverW / scale, sh = coverH / scale;
        const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, coverX, coverY, coverW, coverH);
        coverDrawn = true;
      } catch {
        // Keep a designed fallback cover rather than exporting an empty block.
      }
    }
    if (!coverDrawn) {
      const coverBg = ctx.createLinearGradient(coverX, coverY, coverX + coverW, coverY + coverH);
      coverBg.addColorStop(0, '#4c1d95');
      coverBg.addColorStop(1, '#160b32');
      ctx.fillStyle = coverBg;
      ctx.fillRect(coverX, coverY, coverW, coverH);
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(coverX + 22, coverY + 22, coverW - 44, coverH - 44);
      ctx.fillStyle = '#d9c8ff';
      ctx.font = '700 18px Arial';
      ctx.fillText('A PALIXIA STORY', coverX + 48, coverY + 82);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px Georgia';
      const words = title.split(/\\s+/);
      let line = '', y = coverY + 245;
      for (const word of words) {
        const next = line ? line + ' ' + word : word;
        if (ctx.measureText(next).width > coverW - 96 && line) {
          ctx.fillText(line, coverX + 48, y); line = word; y += 52;
        } else line = next;
      }
      if (line) ctx.fillText(line, coverX + 48, y);
      ctx.fillStyle = '#e9ddff';
      ctx.font = '22px Arial';
      ctx.fillText('by ' + author, coverX + 48, coverY + coverH - 70, coverW - 96);
    }

    // Title and author below the artwork.
    ctx.fillStyle = '#d9c8ff';
    ctx.font = '700 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('A STORY TO GET LOST IN', 540, 865);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Georgia';
    const words = title.split(/\\s+/);
    const maxWidth = 900;
    let line = '', lines = [];
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line); line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    const shownLines = lines.slice(0, 2);
    shownLines.forEach((value, index) => ctx.fillText(value, 540, 930 + index * 58));
    ctx.fillStyle = '#e9ddff';
    ctx.font = '26px Arial';
    ctx.fillText('by ' + author, 540, 1060);
    ctx.textAlign = 'left';

    // Clear call-to-action footer.
    ctx.fillStyle = 'rgba(255,255,255,.13)';
    ctx.beginPath();
    ctx.fillRect(82, 1120, 916, 112);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px Arial';
    ctx.fillText('READ FOR FREE ON PALIXIA', 118, 1168);
    ctx.fillStyle = '#e9ddff';
    ctx.font = '24px Arial';
    ctx.fillText('Discover your next favourite story', 118, 1208);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 26px Arial';
    ctx.fillText('palixia.com', 960, 1188);
    ctx.textAlign = 'left';

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
