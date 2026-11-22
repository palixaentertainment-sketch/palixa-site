import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import HomeClient from '@/components/HomeClient';

const BOOK_CARD_FIELDS = 'id,author_id,title,description,cover_url,book_type,tags,reads,featured,is_sample,created_at,genre_id,genre_name,genre_slug,author_name,author_username,author_avatar,story_status';

const getInitialTrending = unstable_cache(
  async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    try {
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error } = await client.from('book_cards')
        .select(BOOK_CARD_FIELDS).order('reads', { ascending: false }).limit(8);
      if (error) {
        console.error('[Palixia home] Server-rendered stories could not load:', error);
        return null;
      }
      return data || [];
    } catch (error) {
      console.error('[Palixia home] Server-rendered stories failed:', error);
      return null;
    }
  },
  ['palixia-home-trending-v2'],
  { revalidate: 120, tags: ['palixia-home'] }
);

export default async function HomePage() {
  const initialTrending = await getInitialTrending();
  return <HomeClient initialTrending={initialTrending || []} initialTrendingLoaded={initialTrending !== null} />;
}
