'use client';

import { useEffect, useState } from 'react';
import { supabase, configured } from '@/lib/supabase';

export default function HomepageBannerImage() {
  const [banner, setBanner] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (!configured) return () => { cancelled = true; };
    supabase.from('homepage_banner').select('image_url,alt_text,is_active').eq('id', true).maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled && !error && data?.is_active && data?.image_url) setBanner(data);
      });
    return () => { cancelled = true; };
  }, []);
  if (!banner?.image_url) return null;
  return <div className="short-story-page-poster"><img src={banner.image_url} alt={banner.alt_text || 'Palixia announcement'} /></div>;
}
