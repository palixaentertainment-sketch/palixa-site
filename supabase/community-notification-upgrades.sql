-- Extend Community notifications for reposts and replies to comments.
-- Apply after supabase/notifications.sql and supabase/community-social-actions.sql.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('community_like','community_comment','community_reply','community_repost','follow','new_book','new_chapter'));

create or replace function public.notify_community_repost()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  post_owner uuid;
  post_body text;
begin
  select user_id, body into post_owner, post_body
  from public.community_posts
  where id = new.post_id and status = 'visible';

  if post_owner is not null and post_owner <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, kind, message, link_url)
    values (
      post_owner,
      new.user_id,
      'community_repost',
      'reposted your Community post',
      '/community#post-' || new.post_id::text
    );
  end if;
  return new;
end;
$$;

drop trigger if exists community_repost_notification on public.community_reposts;
create trigger community_repost_notification
after insert on public.community_reposts
for each row execute function public.notify_community_repost();

create or replace function public.notify_community_comment_reply()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  parent_owner uuid;
  post_owner uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select user_id into parent_owner
  from public.community_comments
  where id = new.parent_id and status = 'visible';

  select user_id into post_owner
  from public.community_posts
  where id = new.post_id and status = 'visible';

  if parent_owner is not null and parent_owner <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, kind, message, link_url)
    values (
      parent_owner,
      new.user_id,
      'community_reply',
      'replied to your comment',
      '/community#post-' || new.post_id::text
    );
  end if;

  return new;
end;
$$;

drop trigger if exists community_comment_reply_notification on public.community_comments;
create trigger community_comment_reply_notification
after insert on public.community_comments
for each row execute function public.notify_community_comment_reply();
