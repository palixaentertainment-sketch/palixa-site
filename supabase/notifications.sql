-- Palixia in-site notifications (additive; does not alter existing tables).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('community_like','community_comment','follow')),
  message text not null,
  link_url text not null default '/community',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify_community_like()
returns trigger language plpgsql security definer set search_path = public
as $$
declare post_owner uuid;
begin
  select user_id into post_owner from public.community_posts where id = new.post_id and status = 'visible';
  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, kind, message, link_url)
    values (post_owner, new.user_id, 'community_like', 'liked your Community post', '/community');
  end if;
  return new;
end;
$$;
drop trigger if exists community_like_notification on public.community_likes;
create trigger community_like_notification after insert on public.community_likes
for each row execute function public.notify_community_like();

create or replace function public.notify_community_comment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare post_owner uuid;
begin
  select user_id into post_owner from public.community_posts where id = new.post_id and status = 'visible';
  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, kind, message, link_url)
    values (post_owner, new.user_id, 'community_comment', 'commented on your Community post', '/community');
  end if;
  return new;
end;
$$;
drop trigger if exists community_comment_notification on public.community_comments;
create trigger community_comment_notification after insert on public.community_comments
for each row execute function public.notify_community_comment();

create or replace function public.notify_new_follow()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications(recipient_id, actor_id, kind, message, link_url)
  values (new.author_id, new.user_id, 'follow', 'started following you', '/profile');
  return new;
end;
$$;
drop trigger if exists follow_notification on public.follows;
create trigger follow_notification after insert on public.follows
for each row execute function public.notify_new_follow();
