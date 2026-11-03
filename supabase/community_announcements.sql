-- Palixia community announcements.
-- Run this additive migration in Supabase SQL Editor before publishing an announcement.

create table if not exists public.community_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  button_label text not null default 'I''ve read this' check (char_length(btrim(button_label)) between 1 and 40),
  image_url text,
  link_label text,
  link_url text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add optional media and destination fields for existing installations too.
alter table public.community_announcements add column if not exists image_url text;
alter table public.community_announcements add column if not exists link_label text;
alter table public.community_announcements add column if not exists link_url text;

-- The public pop-up presents one current message at a time.
create unique index if not exists community_announcements_one_active_idx
  on public.community_announcements (is_active)
  where is_active = true;

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.community_announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.community_announcements enable row level security;
alter table public.announcement_reads enable row level security;

drop policy if exists "public can read active announcements" on public.community_announcements;
create policy "public can read active announcements"
  on public.community_announcements for select to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists "admins manage announcements" on public.community_announcements;
create policy "admins manage announcements"
  on public.community_announcements for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "readers see own announcement acknowledgements" on public.announcement_reads;
create policy "readers see own announcement acknowledgements"
  on public.announcement_reads for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "readers acknowledge announcements" on public.announcement_reads;
create policy "readers acknowledge announcements"
  on public.announcement_reads for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_announcements a
      where a.id = announcement_id and a.is_active = true
    )
  );

grant select on public.community_announcements to anon, authenticated;
grant insert, update, delete on public.community_announcements to authenticated;
grant select, insert on public.announcement_reads to authenticated;


-- Start with the Palixia Friday welcome message. Admins can edit or deactivate it.
insert into public.community_announcements (title, body, button_label, is_active)
select
  'PALIXIA FRIDAY IS COMING!',
  E'Fridays on Palixia are about more than just reading. They\'re a chance to explore stories, take part in fun activities and connect with other readers.\n\nWhat should you prepare?\n\n📖 Explore books on Palixia.\n🔍 Pay attention to story details. You never know what might become a clue!\n👀 Watch out for announcements about each Friday\'s activity.\n\nGet your reading started, and be ready to join the fun!',
  'I''ve read this',
  true
where not exists (
  select 1 from public.community_announcements where is_active = true
);
