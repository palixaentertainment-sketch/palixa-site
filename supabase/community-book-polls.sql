-- Palixia Community Book Polls. Additive migration; does not alter existing Community data.
-- Run once in the Supabase SQL Editor before using Book Polls.
create table if not exists public.community_polls (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.profiles(id) on delete cascade,
 question text not null check (char_length(btrim(question)) between 5 and 200),
 created_at timestamptz not null default now()
);
create index if not exists community_polls_created_idx on public.community_polls(created_at desc);
create table if not exists public.community_poll_options (
 id uuid primary key default gen_random_uuid(),
 poll_id uuid not null references public.community_polls(id) on delete cascade,
 option_text text not null check (char_length(btrim(option_text)) between 1 and 100),
 position integer not null default 0 check (position between 0 and 5),
 unique (poll_id, position)
);
create index if not exists community_poll_options_poll_idx on public.community_poll_options(poll_id, position);
create table if not exists public.community_poll_votes (
 poll_id uuid not null references public.community_polls(id) on delete cascade,
 option_id uuid not null references public.community_poll_options(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (poll_id, user_id)
);
create index if not exists community_poll_votes_option_idx on public.community_poll_votes(option_id);
alter table public.community_polls enable row level security;
alter table public.community_poll_options enable row level security;
alter table public.community_poll_votes enable row level security;
drop policy if exists "community polls are readable" on public.community_polls;
create policy "community polls are readable" on public.community_polls for select to anon, authenticated using (true);
drop policy if exists "users create their own community polls" on public.community_polls;
create policy "users create their own community polls" on public.community_polls for insert to authenticated with check (creator_id = auth.uid());
drop policy if exists "users delete their own community polls" on public.community_polls;
create policy "users delete their own community polls" on public.community_polls for delete to authenticated using (creator_id = auth.uid());
drop policy if exists "community poll options are readable" on public.community_poll_options;
create policy "community poll options are readable" on public.community_poll_options for select to anon, authenticated using (true);
drop policy if exists "poll creators add options" on public.community_poll_options;
create policy "poll creators add options" on public.community_poll_options for insert to authenticated with check (exists (select 1 from public.community_polls p where p.id = poll_id and p.creator_id = auth.uid()));
drop policy if exists "poll creators delete options" on public.community_poll_options;
create policy "poll creators delete options" on public.community_poll_options for delete to authenticated using (exists (select 1 from public.community_polls p where p.id = poll_id and p.creator_id = auth.uid()));
drop policy if exists "community poll votes are readable" on public.community_poll_votes;
create policy "community poll votes are readable" on public.community_poll_votes for select to anon, authenticated using (true);
drop policy if exists "users cast one vote per poll" on public.community_poll_votes;
create policy "users cast one vote per poll" on public.community_poll_votes for insert to authenticated with check (
 user_id = auth.uid() and exists (select 1 from public.community_poll_options o join public.community_polls p on p.id = o.poll_id where o.id = option_id and p.id = poll_id)
);
revoke all on public.community_polls from anon, authenticated;
revoke all on public.community_poll_options from anon, authenticated;
revoke all on public.community_poll_votes from anon, authenticated;
grant select on public.community_polls to anon, authenticated;
grant insert (creator_id, question) on public.community_polls to authenticated;
grant delete on public.community_polls to authenticated;
grant select on public.community_poll_options to anon, authenticated;
grant insert (poll_id, option_text, position) on public.community_poll_options to authenticated;
grant delete on public.community_poll_options to authenticated;
grant select on public.community_poll_votes to anon, authenticated;
grant insert (poll_id, option_id, user_id) on public.community_poll_votes to authenticated;
