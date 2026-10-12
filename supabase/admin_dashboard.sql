-- Palixia admin dashboard and verification badges.
-- Run once in Supabase SQL Editor after deploying this update.

create table if not exists public.profile_badges (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  badge_type text not null check (badge_type in ('official', 'verified_author')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null
);

alter table public.profile_badges enable row level security;

drop policy if exists "profile badges are public" on public.profile_badges;
create policy "profile badges are public"
  on public.profile_badges for select using (true);

drop policy if exists "admins manage profile badges" on public.profile_badges;
create policy "admins manage profile badges"
  on public.profile_badges for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.profile_badges to anon, authenticated;
grant insert, update, delete on public.profile_badges to authenticated;

-- Add the story status column for databases created before this feature was added.
-- Existing books become 'ongoing'; new books also default to 'ongoing'.
alter table public.books
  add column if not exists story_status text not null default 'ongoing'
  check (story_status in ('ongoing', 'completed', 'hiatus'));

-- Allow authors to select/change the story status column without granting access to protected columns.
grant insert (story_status) on public.books to authenticated;
grant update (story_status) on public.books to authenticated;

-- IMPORTANT: expose story_status through the public catalogue view too.
-- Without this, book cards/discovery pages fall back to "Ongoing" even when
-- the value is saved correctly in public.books.
create or replace view public.book_cards with (security_invoker = true) as
select
  b.id, b.author_id, b.title, b.description, b.cover_url, b.book_type, b.tags,
  b.reads, b.featured, b.is_sample, b.created_at,
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
