-- Palixia custom book view counts for controlled testing.
-- Run this file once in Supabase > SQL Editor. Real reads remain unchanged.

alter table public.books
  add column if not exists custom_views integer
  check (custom_views is null or custom_views >= 0);

create or replace function public.admin_set_book_custom_views(
  p_book_id uuid,
  p_custom_views integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only';
  end if;

  if p_custom_views is not null and p_custom_views < 0 then
    raise exception 'custom_views_must_be_nonnegative';
  end if;

  update public.books
  set custom_views = p_custom_views,
      updated_at = now()
  where id = p_book_id;

  if not found then
    raise exception 'book_not_found';
  end if;
end;
$$;

revoke all on function public.admin_set_book_custom_views(uuid, integer) from public, anon;
grant execute on function public.admin_set_book_custom_views(uuid, integer) to authenticated;

-- Keep the public catalogue's existing columns/order, but show the custom
-- value when one is set. Otherwise readers see the genuine read count.
create or replace view public.book_cards with (security_invoker = true) as
select
  b.id, b.author_id, b.title, b.description, b.cover_url, b.book_type, b.tags,
  coalesce(b.custom_views, b.reads) as reads, b.featured, b.is_sample, b.created_at,
  b.genre_id, g.name as genre_name, g.slug as genre_slug,
  p.name as author_name, p.username as author_username, p.avatar_url as author_avatar,
  (select count(*) from public.chapters c where c.book_id = b.id and c.status = 'published')::int as chapter_count,
  lower(b.title || ' ' || p.name || ' ' || p.username || ' ' || coalesce(g.name, '') || ' ' ||
        coalesce(array_to_string(b.tags, ' '), '')) as search,
  b.story_status
from public.books b
join public.profiles p on p.id = b.author_id
left join public.genres g on g.id = b.genre_id
where b.status = 'published' and p.status = 'active';
