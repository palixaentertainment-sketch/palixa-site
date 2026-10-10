-- Palixia Poetry format support.
-- Run this once in Supabase SQL Editor before publishing the Poetry update.
-- This is additive: existing books and comics are preserved.

alter table public.books
  drop constraint if exists books_book_type_check;

alter table public.books
  add constraint books_book_type_check
  check (book_type in ('text', 'comic', 'poem'));

insert into public.genres (name, slug, sort)
values ('Poetry', 'poetry', 11)
on conflict (slug) do nothing;

-- The author form also writes story_status; allow that column for poem/book metadata.
grant insert (author_id, title, description, cover_url, genre_id, tags, book_type, story_status, status)
  on public.books to authenticated;
grant update (title, description, cover_url, genre_id, tags, book_type, story_status, status, updated_at)
  on public.books to authenticated;
