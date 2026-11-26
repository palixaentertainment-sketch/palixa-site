-- Palixia Community: quote-post support.
-- Apply after community.sql. Original posts remain intact and quoted posts retain attribution.

alter table public.community_posts
  add column if not exists quoted_post_id uuid
  references public.community_posts(id) on delete set null;

create index if not exists community_posts_quoted_post_idx
  on public.community_posts(quoted_post_id)
  where quoted_post_id is not null;

grant insert (user_id, category, body, image_url, book_id, quoted_post_id)
  on public.community_posts to authenticated;
