'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';

export default function ComingSoonPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!configured) { setLoading(false); setFailed(true); return; }
      const { data, error } = await supabase.from('coming_soon_books').select('id,title,author_name,description,cover_url,release_date').eq('status', 'upcoming').order('release_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) setFailed(true);
      else setItems(data || []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="stack">
      <section className="homehero" style={{ marginBottom: '1.5rem' }}>
        <div className="homehero-copy">
          <span className="home-eyebrow">A FIRST LOOK AT WHAT'S NEXT</span>
          <h1>Coming soon to Palixia.</h1>
          <p>New stories are on the way. Take a first look at the covers, meet the stories before release, and find your next read.</p>
          <div className="row homehero-actions"><Link className="btn" href="/discover">Explore available stories</Link></div>
        </div>
        <div className="homehero-art" aria-hidden="true"><div className="hero-book hero-book-back"><span>COMING SOON</span><b>New stories<br />on the horizon.</b></div><div className="hero-book hero-book-front"><span>PALIXIA</span><b>Your next<br />favourite.</b><small>COMING SOON</small></div><div className="hero-spark">✦</div></div>
      </section>
      {loading && <p className="muted">Loading upcoming books…</p>}
      {failed && <p className="notice">Upcoming books could not load right now. Please try again later.</p>}
      {!loading && !failed && items.length === 0 && <div className="empty"><div><b>Something new is on the way.</b><p>We're preparing upcoming stories. Check back soon.</p></div></div>}
      {items.length > 0 && <section className="stack">
        <div className="sechead"><div><h2 className="h2">On the horizon</h2><p className="fine">A preview of stories coming to Palixia.</p></div><span className="fine">{items.length} upcoming {items.length === 1 ? 'book' : 'books'}</span></div>
        <div className="coming-soon-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1rem' }}>
          {items.map(item => <article key={item.id} className="panel stack" style={{ overflow: 'hidden', border: '1px solid var(--line)', borderRadius: '.8rem' }}>
            <div style={{ background: 'var(--soft)', aspectRatio: '3 / 4', position: 'relative' }}>
              <img src={item.cover_url} alt={item.title + ' cover'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              <span style={{ position: 'absolute', top: '.7rem', left: '.7rem', background: 'var(--accent)', color: 'white', borderRadius: '999px', padding: '.3rem .65rem', fontSize: '.75rem', fontWeight: 700 }}>COMING SOON</span>
            </div>
            <div className="stack" style={{ padding: '0 1rem 1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', lineHeight: 1.25 }}>{item.title}</h3>
              <p className="fine" style={{ margin: 0 }}>by {item.author_name}</p>
              {item.description && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.description}</p>}
              {item.release_date && <p className="fine" style={{ margin: 0 }}>Expected release: {new Date(item.release_date + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>}
            </div>
          </article>)}
        </div>
      </section>}
    </div>
  );
}
