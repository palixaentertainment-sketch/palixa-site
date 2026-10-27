-- Saved Community posts.
-- Apply once in the Supabase SQL Editor to enable the Save action in Community.

create table if not exists public.community_saved_posts (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists community_saved_posts_user_idx
  on public.community_saved_posts(user_id, created_at desc);

alter table public.community_saved_posts enable row level security;

drop policy if exists "users read own saved community posts" on public.community_saved_posts;
create policy "users read own saved community posts" on public.community_saved_posts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "users save their own community list" on public.community_saved_posts;
create policy "users save their own community list" on public.community_saved_posts
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.community_posts p
      where p.id = post_id and p.status = 'visible'
    )
  );

drop policy if exists "users remove their own saved community posts" on public.community_saved_posts;
create policy "users remove their own saved community posts" on public.community_saved_posts
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.community_saved_posts from anon, authenticated;
grant select, delete on public.community_saved_posts to authenticated;
grant insert (post_id, user_id) on public.community_saved_posts to authenticated;
