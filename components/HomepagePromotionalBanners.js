'use client';

import { useEffect, useState } from 'react';
import { supabase, configured } from '@/lib/supabase';

export default function HomepagePromotionalBanners() {
  const [banners, setBanners] = useState([]);
  const [seconds, setSeconds] = useState(5);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchStart, setTouchStart] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!configured) return () => { cancelled = true; };
    Promise.all([
      supabase.from('homepage_banners').select('id,image_url,alt_text,link_url').eq('is_active', true).not('image_url', 'is', null).order('sort_order', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('homepage_banner_settings').select('display_seconds').eq('id', true).maybeSingle(),
    ]).then(([bannerResult, settingsResult]) => {
      if (cancelled) return;
      if (!bannerResult.error) setBanners(bannerResult.data || []);
      if (!settingsResult.error && settingsResult.data?.display_seconds) setSeconds(settingsResult.data.display_seconds);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (banners.length < 2 || paused) return undefined;
    const timer = window.setInterval(() => setActiveIndex(index => (index + 1) % banners.length), seconds * 1000);
    return () => window.clearInterval(timer);
  }, [banners.length, seconds, paused]);

  if (!banners.length) return null;
  const banner = banners[activeIndex] || banners[0];
  const move = (direction) => setActiveIndex(index => (index + direction + banners.length) % banners.length);
  const content = <img key={banner.id} src={banner.image_url} alt={banner.alt_text || 'Palixia promotion'} loading={activeIndex === 0 ? 'eager' : 'lazy'} decoding="async" />;

  return (
    <section className="promo-banner-carousel" aria-label="Palixia promotions" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={event => setTouchStart(event.touches[0].clientX)} onTouchEnd={event => {
        if (touchStart === null) return;
        const distance = event.changedTouches[0].clientX - touchStart;
        if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
        setTouchStart(null);
      }}>
      <div className="promo-banner-stage" aria-live="off">
        {banner.link_url ? <a className="promo-banner-image-link" href={banner.link_url} aria-label={banner.alt_text || 'Open Palixia promotion'}>{content}</a> : content}
      </div>
      {banners.length > 1 && <>
        <button type="button" className="promo-banner-arrow prev" aria-label="Previous promotion" onClick={() => move(-1)}>‹</button>
        <button type="button" className="promo-banner-arrow next" aria-label="Next promotion" onClick={() => move(1)}>›</button>
        <div className="promo-banner-dots" aria-label="Choose promotion">
          {banners.map((item, index) => <button key={item.id} type="button" className={index === activeIndex ? 'active' : ''} aria-label={'Show promotion ' + (index + 1)} aria-pressed={index === activeIndex} onClick={() => setActiveIndex(index)} />)}
        </div>
      </>}
    </section>
  );
}
