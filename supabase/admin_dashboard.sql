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

-- Existing book rows keep their current story status; new books default to ongoing.
-- Allow authors to select/change the story status column without granting access to protected columns.
grant insert (story_status) on public.books to authenticated;
grant update (story_status) on public.books to authenticated;
