'use client';
import { useState } from 'react';

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

export default function PromoKit({ book, authorName }) {
  const [message, setMessage] = useState('');
  const link = typeof window !== 'undefined' ? window.location.origin + '/book/' + book.id : 'https://palixia.com/book/' + book.id;
  const caption = 'Looking for your next read? 📚\n\nMy story, ' + book.title + ', is available to read for free on Palixia. I would love for you to check it out and tell me what you think!\n\nRead here: ' + link + '\n\n#Palixia #ReadOnPalixia';
  async function copy(value, label) {
    try { await navigator.clipboard.writeText(value); setMessage(label + ' copied.'); }
    catch { setMessage('Copy is unavailable in this browser. Please copy the text manually.'); }
  }
  function downloadGraphic() {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
    bg.addColorStop(0, '#1e0a4a'); bg.addColorStop(0.58, '#4c1d95'); bg.addColorStop(1, '#7c3aed');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(930, 230, 260, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8c8ff'; ctx.font = '700 38px Arial'; ctx.fillText('A STORY TO DISCOVER', 92, 150);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 88px Georgia';
    const lines = wrapText(ctx, book.title, 850);
    lines.slice(0, 4).forEach((line, i) => ctx.fillText(line, 92, 390 + i * 108));
    const titleBottom = 390 + Math.min(lines.length, 4) * 108;
    ctx.fillStyle = '#e9ddff'; ctx.font = '42px Arial';
    ctx.fillText('by ' + (authorName || 'A Palixia author'), 94, titleBottom + 70);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 44px Arial'; ctx.fillText('READ FOR FREE ON', 94, 1080);
    ctx.font = 'bold 76px Arial'; ctx.fillText('PALIXIA', 94, 1170);
    ctx.fillStyle = '#e9ddff'; ctx.font = '30px Arial'; ctx.fillText('palixia.com', 94, 1230);
    ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.font = '24px Arial'; ctx.fillText('Independent stories. Curious readers.', 94, 1290);
    const a = document.createElement('a');
    a.download = 'read-on-palixia-' + book.id + '.png'; a.href = canvas.toDataURL('image/png'); a.click();
    setMessage('Your promotional graphic is ready.');
  }
  return (
    <section className="card stack">
      <div className="stack" style={{ gap: '.35rem' }}>
        <span className="mono">AUTHOR PROMO KIT</span>
        <h3 className="h2" style={{ overflowWrap: 'anywhere' }}>{book.title}</h3>
        <p className="muted">Your ready-to-share link, caption and Palixia graphic.</p>
      </div>
      <div className="stack" style={{ gap: '.35rem' }}>
        <label className="fine" htmlFor={'promo-link-' + book.id}>Your book link</label>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <input id={'promo-link-' + book.id} className="input" readOnly value={link} onFocus={(e) => e.target.select()} style={{ flex: '1 1 13rem', minWidth: 0 }} />
          <button className="btn small" type="button" onClick={() => copy(link, 'Book link')}>Copy link</button>
        </div>
      </div>
      <div className="stack" style={{ gap: '.35rem' }}>
        <label className="fine" htmlFor={'promo-caption-' + book.id}>WhatsApp / Instagram caption</label>
        <textarea id={'promo-caption-' + book.id} className="input" rows={5} readOnly value={caption} onFocus={(e) => e.target.select()} />
        <div className="row">
          <button className="btn ghost small" type="button" onClick={() => copy(caption, 'Caption')}>Copy caption</button>
          <button className="btn small" type="button" onClick={downloadGraphic}>Download graphic</button>
        </div>
      </div>
      {message && <p className="fine" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
