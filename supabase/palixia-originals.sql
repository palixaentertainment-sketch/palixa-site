-- Palixia Originals: run this in Supabase SQL Editor.
-- This creates a separate view and does not modify the existing book_cards view.
ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS is_palixia_original BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE VIEW public.palixia_original_cards
WITH (security_invoker = true) AS
SELECT
  b.id,
  b.author_id,
  b.title,
  b.description,
  b.cover_url,
  b.book_type,
  b.tags,
  b.reads,
  b.featured,
  b.is_sample,
  b.created_at,
  b.genre_id,
  g.name AS genre_name,
  g.slug AS genre_slug,
  p.name AS author_name,
  p.username AS author_username,
  p.avatar_url AS author_avatar,
  (SELECT count(*) FROM public.chapters ch
   WHERE ch.book_id = b.id AND ch.status = 'published')::int AS chapter_count,
  lower(b.title || ' ' || p.name || ' ' || p.username || ' ' ||
        coalesce(g.name, '') || ' ' ||
        coalesce(array_to_string(b.tags, ' '), '')) AS search,
  b.story_status
FROM public.books b
JOIN public.profiles p ON p.id = b.author_id
LEFT JOIN public.genres g ON g.id = b.genre_id
WHERE b.status = 'published'
  AND p.status = 'active'
  AND b.is_palixia_original = TRUE;
