-- Palixia Coming Soon catalogue
-- Run once in Supabase SQL Editor after deploying the website update.
create table if not exists public.coming_soon_books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  author_name text not null default 'Palixia',
  description text not null default '' check (char_length(description) <= 2000),
  cover_url text not null,
  release_date date,
  linked_book_id uuid references public.books(id) on delete set null,
  status text not null default 'upcoming' check (status in ('upcoming', 'released', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists coming_soon_books_public_idx
  on public.coming_soon_books(status, release_date nulls last, created_at desc);
alter table public.coming_soon_books enable row level security;
drop policy if exists "public can view upcoming books" on public.coming_soon_books;
create policy "public can view upcoming books"
  on public.coming_soon_books for select
  using (status = 'upcoming' or public.is_admin());
drop policy if exists "admins manage coming soon books" on public.coming_soon_books;
create policy "admins manage coming soon books"
  on public.coming_soon_books for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
grant select on public.coming_soon_books to anon, authenticated;
grant insert, update, delete on public.coming_soon_books to authenticated;
