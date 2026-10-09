-- Palixia Community MVP.
-- Additive migration only: creates new tables and does not alter existing book/reader data.
-- Apply this file in Supabase SQL Editor before using the Community page.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'general'
    check (category in ('reading-room', 'writers-corner', 'share-your-work', 'comics-art', 'general')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  book_id uuid references public.books(id) on delete set null,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_posts_feed_idx
  on public.community_posts(status, created_at desc);
create index if not exists community_posts_user_idx
  on public.community_posts(user_id, created_at desc);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.community_comments(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx
  on public.community_comments(post_id, created_at);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_reports enable row level security;

-- Public visitors can read visible posts, their visible replies, and aggregate likes.
drop policy if exists "community read visible posts" on public.community_posts;
create policy "community read visible posts" on public.community_posts
  for select to anon, authenticated
  using (status = 'visible' or user_id = auth.uid() or public.is_admin());

drop policy if exists "community create own posts" on public.community_posts;
create policy "community create own posts" on public.community_posts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'visible'
    and (book_id is null or exists (
      select 1 from public.books b where b.id = book_id and b.status = 'published'
    ))
  );

drop policy if exists "community edit own posts" on public.community_posts;
create policy "community edit own posts" on public.community_posts
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "community delete own posts or admin" on public.community_posts;
create policy "community delete own posts or admin" on public.community_posts
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "community read comments" on public.community_comments;
create policy "community read comments" on public.community_comments
  for select to anon, authenticated
  using (
    user_id = auth.uid()
    or (status = 'visible' and exists (
      select 1 from public.community_posts p
      where p.id = post_id and (p.status = 'visible' or p.user_id = auth.uid() or public.is_admin())
    ))
    or public.is_admin()
  );

drop policy if exists "community create comments" on public.community_comments;
create policy "community create comments" on public.community_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'visible'
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id and p.status = 'visible'
    )
    and (
      parent_id is null or exists (
        select 1 from public.community_comments parent
        where parent.id = parent_id and parent.post_id = post_id and parent.parent_id is null
          and parent.status = 'visible'
      )
    )
  );

drop policy if exists "community edit own comments" on public.community_comments;
create policy "community edit own comments" on public.community_comments
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "community delete own comments or admin" on public.community_comments;
create policy "community delete own comments or admin" on public.community_comments
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.community_posts p where p.id = post_id and p.user_id = auth.uid()));

drop policy if exists "community read likes" on public.community_likes;
create policy "community read likes" on public.community_likes
  for select to anon, authenticated using (true);

drop policy if exists "community add own likes" on public.community_likes;
create policy "community add own likes" on public.community_likes
  for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.community_posts p where p.id = post_id and p.status = 'visible'
  ));

drop policy if exists "community remove own likes" on public.community_likes;
create policy "community remove own likes" on public.community_likes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "community report own" on public.community_reports;
create policy "community report own" on public.community_reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and exists (
    select 1 from public.community_posts p where p.id = post_id and p.status = 'visible'
  ));

drop policy if exists "community reporter or admin read reports" on public.community_reports;
create policy "community reporter or admin read reports" on public.community_reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());

-- Restrict writes to intended fields. Moderation status is reserved for admins.
revoke all on public.community_posts, public.community_comments, public.community_likes, public.community_reports from anon, authenticated;
grant select on public.community_posts, public.community_comments, public.community_likes to anon, authenticated;
grant insert (user_id, category, body, book_id) on public.community_posts to authenticated;
grant update (category, body, book_id, updated_at) on public.community_posts to authenticated;
grant delete on public.community_posts to authenticated;
grant insert (post_id, user_id, parent_id, body) on public.community_comments to authenticated;
grant update (body, updated_at) on public.community_comments to authenticated;
grant delete on public.community_comments to authenticated;
grant insert (post_id, user_id) on public.community_likes to authenticated;
grant delete on public.community_likes to authenticated;
grant select on public.community_reports to authenticated;
grant insert (post_id, reporter_id, reason) on public.community_reports to authenticated;
grant update (status) on public.community_posts, public.community_comments to authenticated;
grant update (status) on public.community_reports to authenticated;
