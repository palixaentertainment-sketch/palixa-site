-- Global read-count management for Palixia.
-- Run once in Supabase SQL Editor after the website code is deployed.
-- Actual reads remain in books.reads and continue increasing through record_read().
-- read_adjustment is a persistent offset, so displayed reads move with real reads.

alter table public.books
  add column if not exists read_adjustment integer not null default 0;

-- Preserve the currently displayed totals from the legacy custom_views override.
-- The old custom_views value was an absolute number; convert it to an offset.
update public.books
set read_adjustment = custom_views - reads
where custom_views is not null;

-- Stop using the legacy absolute override after migration.
update public.books
set custom_views = null
where custom_views is not null;

create or replace function public.admin_set_book_read_count(
  p_book_id uuid,
  p_display_reads integer
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

  if p_display_reads is null or p_display_reads < 0 then
    raise exception 'display_reads_must_be_nonnegative';
  end if;

  -- Store only the difference from genuine reads. Future genuine reads
  -- automatically increase the displayed total without losing the adjustment.
  update public.books
  set read_adjustment = p_display_reads - reads,
      custom_views = null,
      updated_at = now()
  where id = p_book_id;

  if not found then
    raise exception 'book_not_found';
  end if;
end;
$$;

revoke all on function public.admin_set_book_read_count(uuid, integer) from public, anon;
grant execute on function public.admin_set_book_read_count(uuid, integer) to authenticated;

-- Keep the existing book_cards column order and expose adjusted totals everywhere
-- that uses this shared catalogue view.
create or replace view public.book_cards with (security_invoker = true) as
select
  b.id, b.author_id, b.title, b.description, b.cover_url, b.book_type, b.tags,
  greatest(0, b.reads + b.read_adjustment) as reads,
  b.featured, b.is_sample, b.created_at,
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

grant select on public.book_cards to anon, authenticated;

-- Author profile totals must use the same displayed total as book cards.
create or replace function public.author_stats(p_author uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'followers', (select count(*) from public.follows where author_id = p_author),
    'books', (select count(*) from public.books where author_id = p_author and status = 'published'),
    'reads', (
      select coalesce(sum(greatest(0, reads + read_adjustment)), 0)
      from public.books
      where author_id = p_author and status = 'published'
    )
  );
$$;

grant execute on function public.author_stats(uuid) to anon, authenticated;

-- Popular-author totals should also reflect adjusted displayed reads.
create or replace function public.popular_authors(lim int default 8)
returns table (
  id uuid,
  name text,
  username text,
  avatar_url text,
  bio text,
  total_reads bigint,
  book_count bigint
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.username,
    p.avatar_url,
    p.bio,
    coalesce(sum(greatest(0, b.reads + b.read_adjustment)), 0)::bigint,
    count(b.id)::bigint
  from public.profiles p
  join public.books b on b.author_id = p.id and b.status = 'published'
  where p.status = 'active'
  group by p.id
  order by 6 desc, 7 desc
  limit lim;
$$;

grant execute on function public.popular_authors(int) to anon, authenticated;
