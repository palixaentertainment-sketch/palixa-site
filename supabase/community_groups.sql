-- Palixia Reader Groups MVP.
-- Additive only: this migration does not alter existing book, account, or community tables.
-- Apply in Supabase SQL Editor before enabling Reader Groups.

create table if not exists public.community_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 60),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  genre text not null default 'General' check (char_length(btrim(genre)) between 1 and 40),
  created_at timestamptz not null default now()
);

create index if not exists community_groups_created_idx
  on public.community_groups(created_at desc);
create index if not exists community_groups_genre_idx
  on public.community_groups(genre);

create table if not exists public.community_group_members (
  group_id uuid not null references public.community_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists community_group_members_user_idx
  on public.community_group_members(user_id, created_at desc);

create table if not exists public.community_group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists community_group_posts_feed_idx
  on public.community_group_posts(group_id, created_at desc);

alter table public.community_groups enable row level security;
alter table public.community_group_members enable row level security;
alter table public.community_group_posts enable row level security;

drop policy if exists "reader groups are visible" on public.community_groups;
create policy "reader groups are visible" on public.community_groups
  for select to anon, authenticated using (true);

drop policy if exists "signed-in readers create groups" on public.community_groups;
create policy "signed-in readers create groups" on public.community_groups
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "group owners update their groups" on public.community_groups;
create policy "group owners update their groups" on public.community_groups
  for update to authenticated using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "group owners delete their groups" on public.community_groups;
create policy "group owners delete their groups" on public.community_groups
  for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "reader group memberships are visible" on public.community_group_members;
create policy "reader group memberships are visible" on public.community_group_members
  for select to anon, authenticated using (true);

drop policy if exists "readers join groups as themselves" on public.community_group_members;
create policy "readers join groups as themselves" on public.community_group_members
  for insert to authenticated with check (
    user_id = auth.uid()
    and (
      role = 'member'
      or (role = 'owner' and exists (
        select 1 from public.community_groups g where g.id = group_id and g.owner_id = auth.uid()
      ))
    )
  );

drop policy if exists "readers leave groups or owners remove members" on public.community_group_members;
create policy "readers leave groups or owners remove members" on public.community_group_members
  for delete to authenticated using (
    (user_id = auth.uid() and role <> 'owner')
    or exists (
      select 1 from public.community_groups g
      where g.id = group_id and g.owner_id = auth.uid() and user_id <> g.owner_id
    )
    or (public.is_admin() and role <> 'owner')
  );

drop policy if exists "reader group posts are visible" on public.community_group_posts;
create policy "reader group posts are visible" on public.community_group_posts
  for select to anon, authenticated using (true);

drop policy if exists "group members can post" on public.community_group_posts;
create policy "group members can post" on public.community_group_posts
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_group_members m
      where m.group_id = community_group_posts.group_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "authors delete their group posts" on public.community_group_posts;
create policy "authors delete their group posts" on public.community_group_posts
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

revoke all on public.community_groups, public.community_group_members, public.community_group_posts from anon, authenticated;
grant select on public.community_groups, public.community_group_members, public.community_group_posts to anon, authenticated;
grant insert (owner_id, name, description, genre) on public.community_groups to authenticated;
grant update (name, description, genre) on public.community_groups to authenticated;
grant delete on public.community_groups to authenticated;
grant insert (group_id, user_id, role) on public.community_group_members to authenticated;
grant delete on public.community_group_members to authenticated;
grant insert (group_id, user_id, body) on public.community_group_posts to authenticated;
grant delete on public.community_group_posts to authenticated;
