-- Notify book authors when readers comment on their chapters,
-- and notify the owner of a comment when someone replies to it.
-- Additive migration: preserves existing notifications and comments.

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'community_like',
    'community_comment',
    'follow',
    'new_book',
    'new_chapter',
    'chapter_comment',
    'chapter_comment_reply'
  ));

create or replace function public.notify_chapter_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_chapter_title text;
  v_book_title text;
  v_parent_owner_id uuid;
  v_link text;
begin
  select b.author_id, c.title, b.title
    into v_author_id, v_chapter_title, v_book_title
  from public.chapters c
  join public.books b on b.id = c.book_id
  where c.id = new.chapter_id
    and c.status = 'published'
    and b.status = 'published';

  -- Ignore comments attached to content that is no longer published.
  if v_author_id is null then
    return new;
  end if;

  v_link := '/read/' || new.chapter_id::text;

  -- Notify the book's author, unless the author wrote this comment.
  if v_author_id <> new.user_id then
    insert into public.notifications
      (recipient_id, actor_id, kind, message, link_url)
    values
      (
        v_author_id,
        new.user_id,
        'chapter_comment',
        'commented on a chapter of your book: ' || v_book_title,
        v_link
      );
  end if;

  -- For replies, notify the owner of the parent comment too.
  -- Avoid a duplicate if that person is also the book's author.
  if new.parent_id is not null then
    select parent.user_id
      into v_parent_owner_id
    from public.comments parent
    where parent.id = new.parent_id
      and parent.chapter_id = new.chapter_id;

    if v_parent_owner_id is not null
       and v_parent_owner_id <> new.user_id
       and v_parent_owner_id is distinct from v_author_id then
      insert into public.notifications
        (recipient_id, actor_id, kind, message, link_url)
      values
        (
          v_parent_owner_id,
          new.user_id,
          'chapter_comment_reply',
          'replied to your comment on ' || v_chapter_title,
          v_link
        );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists chapter_comment_notification on public.comments;

create trigger chapter_comment_notification
after insert on public.comments
for each row
execute function public.notify_chapter_comment();

