-- Campus Gist Investigation submission storage.
-- Run this file in Supabase SQL Editor before publishing the page.

create table if not exists public.palixia_friday_investigation_entries (
  id uuid primary key default gen_random_uuid(),
  case_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null default '',
  username text not null default '',
  contact_email text not null,
  theory text not null,
  suspicious_person text not null default '',
  supporting_clues text not null,
  recordings_theory text not null default '',
  created_at timestamptz not null default now(),
  unique(case_id, user_id)
);

alter table public.palixia_friday_investigation_entries enable row level security;

drop policy if exists "Users can submit one Campus Gist investigation" on public.palixia_friday_investigation_entries;
create policy "Users can submit one Campus Gist investigation"
on public.palixia_friday_investigation_entries
for insert to authenticated
with check (
  auth.uid() = user_id
  and case_id = 'campus-gist-investigation-2026-11'
  and length(trim(theory)) >= 100
  and length(trim(supporting_clues)) >= 30
);

drop policy if exists "Admins can review Campus Gist investigations" on public.palixia_friday_investigation_entries;
create policy "Admins can review Campus Gist investigations"
on public.palixia_friday_investigation_entries
for select to authenticated
using (public.is_admin());

create index if not exists palixia_friday_investigation_case_created_idx
on public.palixia_friday_investigation_entries(case_id, created_at);
