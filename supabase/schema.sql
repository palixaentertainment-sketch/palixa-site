-- Palixa database, phases 1 to 3 (accounts, reading, author publishing).
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- It is safe to run on a fresh project. To start over, delete the project's tables first.
--
-- Payments, reviews, withdrawals and admin tools are not here yet. They arrive in later phases as
-- new tables (purchases, transactions, reviews, withdrawals) that point at the tables below.

create extension if not exists pgcrypto;

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  role text not null default 'reader' check (role in ('reader', 'author', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  country text,
  created_at timestamptz not null default now()
);

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort int not null default 0
);

-- One catalogue for everything. book_type decides which reader is used:
-- 'text' chapters hold written content, 'comic' chapters hold ordered page images.
create table public.books (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  cover_url text,
  genre_id uuid references public.genres(id) on delete set null,
  tags text[] not null default '{}',
  book_type text not null default 'text' check (book_type in ('text', 'comic')),
  price numeric(10, 2) not null default 0,          -- used from the payments phase
  is_free boolean not null default true,            -- used from the payments phase
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished')),
  featured boolean not null default false,
  reads int not null default 0,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index books_author_idx on public.books (author_id);
create index books_status_idx on public.books (status, created_at desc);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_number int not null check (chapter_number > 0),
  title text not null check (char_length(title) between 1 and 120),
  content text,                                     -- text books
  is_free boolean not null default true,            -- used from the payments phase
  status text not null default 'draft' check (status in ('draft', 'published')),
  reads int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, chapter_number)
);

-- Comic chapters: one row per page image, in order. A separate table so comics can grow
-- (panels, dimensions, alt text) without changing the rest of the platform.
create table public.chapter_pages (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  page_number int not null check (page_number > 0),
  image_url text not null,
  alt text,
  width int,
  height int,
  unique (chapter_id, page_number)
);

create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  progress int not null default 0 check (progress between 0 and 100),   -- percent of the whole book
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

-- chapter_id is null for a saved book, set for a bookmarked chapter.
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index bookmarks_unique_idx
  on public.bookmarks (user_id, book_id, coalesce(chapter_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, author_id),
  check (user_id <> author_id)
);

-- Remembers who has opened which chapter, so read counts are not inflated by refreshes.
create table public.chapter_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

insert into public.genres (name, slug, sort) values
  ('Romance', 'romance', 1),
  ('Thriller', 'thriller', 2),
  ('Crime', 'crime', 3),
  ('Mystery', 'mystery', 4),
  ('Fantasy', 'fantasy', 5),
  ('Horror', 'horror', 6),
  ('Drama', 'drama', 7),
  ('Sci-Fi', 'sci-fi', 8),
  ('Short Stories', 'short-stories', 9),
  ('Comics', 'comics', 10);

------------------------------------------------------------------------------
-- Helper functions
------------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function public.is_author()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('author', 'admin') and status = 'active');
$$;

-- Creates the profile row when someone signs up. Admin is never granted from here.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_user text;
  v_role text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1));
  v_user := lower(regexp_replace(
    coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1)),
    '[^a-zA-Z0-9_]', '', 'g'));
  if length(v_user) < 3 then
    v_user := 'reader' || substr(md5(new.id::text), 1, 4);
  end if;
  v_user := left(v_user, 24);
  if exists (select 1 from public.profiles where username = v_user) then
    v_user := left(v_user, 19) || '_' || substr(md5(random()::text), 1, 4);
  end if;
  v_role := case when new.raw_user_meta_data->>'account' = 'author' then 'author' else 'reader' end;
  insert into public.profiles (id, name, username, role, bio, country)
  values (
    new.id,
    left(v_name, 80),
    v_user,
    v_role,
    nullif(left(coalesce(new.raw_user_meta_data->>'bio', ''), 500), ''),
    nullif(left(coalesce(new.raw_user_meta_data->>'country', ''), 60), '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A reader turns their own account into an author account.
create or replace function public.become_author()
returns void language sql security definer set search_path = public as $$
  update public.profiles set role = 'author' where id = auth.uid() and role = 'reader' and status = 'active';
$$;

-- Counts a signed-in reader's first open of a chapter, once per chapter per person.
create or replace function public.record_read(p_chapter uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_book uuid;
  v_first boolean;
  v_rows int;
begin
  if auth.uid() is null then return; end if;
  select c.book_id into v_book
    from public.chapters c join public.books b on b.id = c.book_id
    where c.id = p_chapter and c.status = 'published' and b.status = 'published';
  if v_book is null then return; end if;
  select not exists (
    select 1 from public.chapter_reads r join public.chapters c on c.id = r.chapter_id
    where r.user_id = auth.uid() and c.book_id = v_book
  ) into v_first;
  insert into public.chapter_reads (user_id, chapter_id) values (auth.uid(), p_chapter)
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    update public.chapters set reads = reads + 1 where id = p_chapter;
    if v_first then
      update public.books set reads = reads + 1 where id = v_book;
    end if;
  end if;
end;
$$;

create or replace function public.author_stats(p_author uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'followers', (select count(*) from public.follows where author_id = p_author),
    'books', (select count(*) from public.books where author_id = p_author and status = 'published'),
    'reads', (select coalesce(sum(reads), 0) from public.books where author_id = p_author and status = 'published')
  );
$$;

create or replace function public.book_saves()
returns table (book_id uuid, saves bigint) language sql stable security definer set search_path = public as $$
  select b.id, count(bm.id)
  from public.books b
  left join public.bookmarks bm on bm.book_id = b.id and bm.chapter_id is null
  where b.author_id = auth.uid()
  group by b.id;
$$;

create or replace function public.popular_authors(lim int default 8)
returns table (id uuid, name text, username text, avatar_url text, bio text, total_reads bigint, book_count bigint)
language sql stable set search_path = public as $$
  select p.id, p.name, p.username, p.avatar_url, p.bio,
         coalesce(sum(b.reads), 0)::bigint, count(b.id)::bigint
  from public.profiles p
  join public.books b on b.author_id = p.id and b.status = 'published'
  where p.status = 'active'
  group by p.id
  order by 6 desc, 7 desc
  limit lim;
$$;

------------------------------------------------------------------------------
-- Catalogue view: published books joined with author and genre, used by every browse page.
-- security_invoker makes the underlying row level security apply to the person asking.
------------------------------------------------------------------------------

create or replace view public.book_cards with (security_invoker = true) as
select
  b.id, b.author_id, b.title, b.description, b.cover_url, b.book_type, b.tags,
  b.reads, b.featured, b.is_sample, b.created_at,
  b.genre_id, g.name as genre_name, g.slug as genre_slug,
  p.name as author_name, p.username as author_username, p.avatar_url as author_avatar,
  (select count(*) from public.chapters c where c.book_id = b.id and c.status = 'published')::int as chapter_count,
  lower(b.title || ' ' || p.name || ' ' || p.username || ' ' || coalesce(g.name, '') || ' ' ||
        coalesce(array_to_string(b.tags, ' '), '')) as search
from public.books b
join public.profiles p on p.id = b.author_id
left join public.genres g on g.id = b.genre_id
where b.status = 'published' and p.status = 'active';

------------------------------------------------------------------------------
-- Row level security. This is the server-side authorization: the database itself refuses
-- anything a person is not allowed to do, whatever the website code says.
------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.genres enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_pages enable row level security;
alter table public.reading_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.follows enable row level security;
alter table public.chapter_reads enable row level security;

-- profiles
create policy "profiles are public" on public.profiles for select using (true);
create policy "edit own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- genres
create policy "genres are public" on public.genres for select using (true);
create policy "admins manage genres" on public.genres for all using (public.is_admin()) with check (public.is_admin());

-- books
create policy "read published or own books" on public.books for select
  using (status = 'published' or author_id = auth.uid() or public.is_admin());
create policy "authors add books" on public.books for insert
  with check (author_id = auth.uid() and public.is_author());
create policy "authors edit own books" on public.books for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors delete own books" on public.books for delete
  using (author_id = auth.uid() or public.is_admin());

-- chapters
create policy "read chapters" on public.chapters for select using (
  exists (
    select 1 from public.books b
    where b.id = chapters.book_id
      and (b.author_id = auth.uid() or public.is_admin() or (b.status = 'published' and chapters.status = 'published'))
  )
);
create policy "authors add chapters" on public.chapters for insert with check (
  exists (select 1 from public.books b where b.id = book_id and b.author_id = auth.uid())
);
create policy "authors edit chapters" on public.chapters for update using (
  exists (select 1 from public.books b where b.id = chapters.book_id and b.author_id = auth.uid())
);
create policy "authors delete chapters" on public.chapters for delete using (
  exists (select 1 from public.books b where b.id = chapters.book_id and (b.author_id = auth.uid() or public.is_admin()))
);

-- chapter pages (comic images)
create policy "read pages" on public.chapter_pages for select using (
  exists (select 1 from public.chapters c where c.id = chapter_pages.chapter_id)
);
create policy "authors add pages" on public.chapter_pages for insert with check (
  exists (
    select 1 from public.chapters c join public.books b on b.id = c.book_id
    where c.id = chapter_id and b.author_id = auth.uid()
  )
);
create policy "authors edit pages" on public.chapter_pages for update using (
  exists (
    select 1 from public.chapters c join public.books b on b.id = c.book_id
    where c.id = chapter_pages.chapter_id and b.author_id = auth.uid()
  )
);
create policy "authors delete pages" on public.chapter_pages for delete using (
  exists (
    select 1 from public.chapters c join public.books b on b.id = c.book_id
    where c.id = chapter_pages.chapter_id and b.author_id = auth.uid()
  )
);

-- a reader's own data
create policy "own progress" on public.reading_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own bookmarks" on public.bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "see own follows" on public.follows for select using (auth.uid() = user_id);
create policy "add own follows" on public.follows for insert with check (auth.uid() = user_id);
create policy "remove own follows" on public.follows for delete using (auth.uid() = user_id);
-- chapter_reads has no policies on purpose: only record_read() may write to it.

-- Column level limits: nobody can promote themselves, feature their own book or edit read counts.
revoke insert, update on public.profiles from anon, authenticated;
grant update (name, username, avatar_url, bio, country) on public.profiles to authenticated;

revoke insert, update on public.books from anon, authenticated;
grant insert (author_id, title, description, cover_url, genre_id, tags, book_type, status) on public.books to authenticated;
grant update (title, description, cover_url, genre_id, tags, book_type, status, updated_at) on public.books to authenticated;

revoke insert, update on public.chapters from anon, authenticated;
grant insert (book_id, chapter_number, title, content, status) on public.chapters to authenticated;
grant update (chapter_number, title, content, status, updated_at) on public.chapters to authenticated;

grant select on public.book_cards to anon, authenticated;
grant execute on function public.become_author() to authenticated;
grant execute on function public.record_read(uuid) to authenticated;
grant execute on function public.book_saves() to authenticated;
grant execute on function public.author_stats(uuid) to anon, authenticated;
grant execute on function public.popular_authors(int) to anon, authenticated;

------------------------------------------------------------------------------
-- File storage: covers, avatars and comic pages. Public to read, and each person can only
-- upload into a folder named after their own user id. Size and type limits are enforced here.
------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('covers', 'covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('pages', 'pages', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "anyone can view palixa images" on storage.objects for select
  using (bucket_id in ('covers', 'avatars', 'pages'));
create policy "upload to your own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('covers', 'avatars', 'pages') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete your own files" on storage.objects for delete to authenticated
  using (bucket_id in ('covers', 'avatars', 'pages') and (storage.foldername(name))[1] = auth.uid()::text);
