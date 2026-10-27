-- Additive Community social actions: reposts and account blocks.
-- Apply once in the Supabase SQL Editor after the existing Community setup.

create table if not exists public.community_reposts (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists community_reposts_user_idx
  on public.community_reposts(user_id, created_at desc);

alter table public.community_reposts enable row level security;
drop policy if exists "community reposts are readable" on public.community_reposts;
create policy "community reposts are readable" on public.community_reposts
  for select to anon, authenticated using (true);
drop policy if exists "users create own community reposts" on public.community_reposts;
create policy "users create own community reposts" on public.community_reposts
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.community_posts p
      where p.id = post_id and p.status = 'visible' and p.user_id <> auth.uid()
    )
  );
drop policy if exists "users remove own community reposts" on public.community_reposts;
create policy "users remove own community reposts" on public.community_reposts
  for delete to authenticated using (user_id = auth.uid());
revoke all on public.community_reposts from anon, authenticated;
grant select on public.community_reposts to anon, authenticated;
grant insert (post_id, user_id) on public.community_reposts to authenticated;
grant delete on public.community_reposts to authenticated;

create table if not exists public.community_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists community_blocks_blocked_idx
  on public.community_blocks(blocked_id);

alter table public.community_blocks enable row level security;
drop policy if exists "users read their own community blocks" on public.community_blocks;
create policy "users read their own community blocks" on public.community_blocks
  for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "users create their own community blocks" on public.community_blocks;
create policy "users create their own community blocks" on public.community_blocks
  for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists "users remove their own community blocks" on public.community_blocks;
create policy "users remove their own community blocks" on public.community_blocks
  for delete to authenticated using (blocker_id = auth.uid());
revoke all on public.community_blocks from anon, authenticated;
grant select on public.community_blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.community_blocks to authenticated;
grant delete on public.community_blocks to authenticated;
