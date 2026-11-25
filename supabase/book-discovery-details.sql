-- Optional discovery details for books. Existing books remain valid.
alter table public.books
  add column if not exists language text not null default 'English',
  add column if not exists target_audience text,
  add column if not exists book_length text;

alter table public.books
  drop constraint if exists books_target_audience_check;
alter table public.books
  add constraint books_target_audience_check
  check (target_audience is null or target_audience in ('all', 'male', 'female'));

alter table public.books
  drop constraint if exists books_book_length_check;
alter table public.books
  add constraint books_book_length_check
  check (book_length is null or book_length in ('short_story', 'novella', 'novel', 'long_novel'));
