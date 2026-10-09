-- DANGER: this deletes every Palixia table and all data in them.
-- Only run it on a new project where you have nothing to keep.
-- Use it to clear a half-finished setup, then run schema.sql again.

drop view if exists public.book_cards;

drop table if exists
  public.chapter_reads,
  public.follows,
  public.bookmarks,
  public.reading_progress,
  public.chapter_pages,
  public.chapters,
  public.books,
  public.genres,
  public.profiles
cascade;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.become_author();
drop function if exists public.record_read(uuid);
drop function if exists public.author_stats(uuid);
drop function if exists public.book_saves();
drop function if exists public.popular_authors(int);
drop function if exists public.is_admin();
drop function if exists public.is_author();

drop policy if exists "anyone can view palixa images" on storage.objects;
drop policy if exists "upload to your own folder" on storage.objects;
drop policy if exists "delete your own files" on storage.objects;
