-- Palixia in-site notifications (additive; does not alter existing tables).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('community_like','community_comment','follow','new_book','new_chapter')),
  message text not null,
  link_url text not null default '/community',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
-- Allow new notification kinds when upgrading an existing notifications table.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('community_like','community_comment','follow','new_book','new_chapter'));

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

-- Notify followers when a book changes from draft/unpublished to published.
create or replace function public.notify_published_book()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    insert into public.notifications(recipient_id, actor_id, kind, message, link_url)
    select f.user_id, new.author_id, 'new_book', 'published a new book: ' || new.title, '/book/' || new.id::text
    from public.follows f
    where f.author_id = new.author_id and f.user_id <> new.author_id;
  end if;
  return new;
end;
$$;
drop trigger if exists published_book_notification on public.books;
create trigger published_book_notification after insert or update of status on public.books
for each row execute function public.notify_published_book();

-- Notify followers and readers who saved the book when a chapter is first published.
create or replace function public.notify_published_chapter()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_author uuid;
  v_book_title text;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select b.author_id, b.title into v_author, v_book_title
    from public.books b where b.id = new.book_id and b.status = 'published';
    if v_author is not null then
      insert into public.notifications(recipient_id, actor_id, kind, message, link_url)
      select distinct recipients.user_id, v_author, 'new_chapter',
             'published a new chapter in ' || v_book_title || ': ' || new.title,
             '/read/' || new.id::text
      from (
        select f.user_id
        from public.follows f
        where f.author_id = v_author and f.user_id <> v_author
        union
        select bm.user_id
        from public.bookmarks bm
        where bm.book_id = new.book_id and bm.chapter_id is null and bm.user_id <> v_author
      ) recipients;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists published_chapter_notification on public.chapters;
create trigger published_chapter_notification after insert or update of status on public.chapters
for each row execute function public.notify_published_chapter();
