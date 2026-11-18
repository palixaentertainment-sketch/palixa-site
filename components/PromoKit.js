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

    const img = new Image();
    let coverLoaded = false;
    if (book.cover_url) {
      try {
        img.src = '/api/promo-cover?url=' + encodeURIComponent(book.cover_url);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          window.setTimeout(() => reject(new Error('Cover image timed out')), 10000);
        });
        coverLoaded = img.naturalWidth > 0;
      } catch {
        coverLoaded = false;
      }
    }

    // Build the atmosphere from the actual cover so the poster and artwork feel like one design.
    if (coverLoaded) {
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const sw = canvas.width / scale, sh = canvas.height / scale;
      ctx.save();
      ctx.filter = 'blur(38px) brightness(.42) saturate(1.35)';
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, 1080, 1350);
      ctx.restore();
    } else {
      const fallback = ctx.createLinearGradient(0, 0, 1080, 1350);
      fallback.addColorStop(0, '#160b32');
      fallback.addColorStop(1, '#6d28d9');
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, 1080, 1350);
    }

    // Cinematic dark wash, edge lighting and soft vignette.
    const wash = ctx.createLinearGradient(0, 0, 1080, 1350);
    wash.addColorStop(0, 'rgba(12,7,25,.76)');
    wash.addColorStop(.5, 'rgba(20,8,39,.42)');
    wash.addColorStop(1, 'rgba(12,7,25,.88)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, 1080, 1350);
    const glow = ctx.createRadialGradient(540, 620, 100, 540, 620, 720);
    glow.addColorStop(0, 'rgba(205,164,255,.20)');
    glow.addColorStop(1, 'rgba(205,164,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1350);

    // Minimal brand header.
    ctx.fillStyle = '#fff';
    ctx.font = '800 34px Arial';
    ctx.fillText('PALIXIA', 72, 92);
    ctx.fillStyle = 'rgba(255,255,255,.76)';
    ctx.font = '500 19px Arial';
    ctx.fillText('INDEPENDENT STORIES. CURIOUS READERS.', 72, 126);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#eadcff';
    ctx.font = '700 19px Arial';
    ctx.fillText('A BOOK TO DISCOVER', 1008, 92);
    ctx.textAlign = 'left';

    if (coverLoaded) {
      // Keep the entire original cover visible, framed as a premium physical book.
      const maxW = 650, maxH = 890;
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      const coverW = img.naturalWidth * ratio;
      const coverH = img.naturalHeight * ratio;
      const x = (1080 - coverW) / 2;
      const y = 178 + (890 - coverH) / 2;

      // Soft cast shadow.
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.72)';
      ctx.shadowBlur = 64;
      ctx.shadowOffsetX = 18;
      ctx.shadowOffsetY = 32;
      ctx.fillStyle = '#160d24';
      ctx.fillRect(x, y, coverW, coverH);
      ctx.restore();

      // Subtle visible spine to make the cover feel like a real book, not a flat tile.
      ctx.save();
      ctx.fillStyle = 'rgba(10,5,18,.76)';
      ctx.beginPath();
      ctx.moveTo(x - 13, y + 8);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + coverH);
      ctx.lineTo(x - 13, y + coverH - 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.drawImage(img, x, y, coverW, coverH);

      // Fine highlight around the physical cover edge.
      ctx.strokeStyle = 'rgba(255,255,255,.34)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, coverW, coverH);
    } else {
      // Honest fallback when no public cover image is available.
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(210, 250, 660, 760);
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.strokeRect(210, 250, 660, 760);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 54px Georgia';
      ctx.fillText(title, 540, 600, 560);
      ctx.font = '28px Arial';
      ctx.fillText('by ' + author, 540, 690);
      ctx.textAlign = 'left';
    }

    // Author and call-to-action sit in a clean footer, never fighting the cover artwork.
    ctx.fillStyle = 'rgba(12,7,25,.64)';
    ctx.fillRect(0, 1130, 1080, 220);
    ctx.fillStyle = '#eadcff';
    ctx.font = '700 20px Arial';
    ctx.fillText('DISCOVER YOUR NEXT FAVOURITE STORY', 72, 1180);
    ctx.fillStyle = '#fff';
    ctx.font = '700 36px Georgia';
    ctx.fillText('“' + title + '”', 72, 1230, 700);
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.font = '24px Arial';
    ctx.fillText('by ' + author, 72, 1272);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = '800 26px Arial';
    ctx.fillText('READ FOR FREE', 1008, 1210);
    ctx.fillStyle = '#eadcff';
    ctx.font = '700 24px Arial';
    ctx.fillText('palixia.com', 1008, 1252);
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
