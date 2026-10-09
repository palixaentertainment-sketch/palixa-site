-- Palixia Story Worlds: additive migration.
-- Run this once in Supabase SQL Editor. It does not alter existing book/chapter data.

create table if not exists public.story_worlds (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists story_worlds_author_idx
  on public.story_worlds(author_id, updated_at desc);
create index if not exists story_worlds_public_idx
  on public.story_worlds(status, updated_at desc);

create table if not exists public.story_world_books (
  world_id uuid not null references public.story_worlds(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (world_id, book_id)
);

create index if not exists story_world_books_order_idx
  on public.story_world_books(world_id, position, created_at);

alter table public.story_worlds enable row level security;
alter table public.story_world_books enable row level security;

drop policy if exists "story worlds are visible when published or owned" on public.story_worlds;
create policy "story worlds are visible when published or owned"
  on public.story_worlds for select to anon, authenticated
  using (status = 'published' or author_id = auth.uid() or public.is_admin());

drop policy if exists "authors create their own story worlds" on public.story_worlds;
create policy "authors create their own story worlds"
  on public.story_worlds for insert to authenticated
  with check (author_id = auth.uid() and (public.is_author() or public.is_admin()));

drop policy if exists "authors update their own story worlds" on public.story_worlds;
create policy "authors update their own story worlds"
  on public.story_worlds for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists "authors delete their own story worlds" on public.story_worlds;
create policy "authors delete their own story worlds"
  on public.story_worlds for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

drop policy if exists "story world books are visible when public or owned" on public.story_world_books;
create policy "story world books are visible when public or owned"
  on public.story_world_books for select to anon, authenticated
  using (
    exists (
      select 1 from public.story_worlds w
      where w.id = world_id
        and (
          w.author_id = auth.uid()
          or public.is_admin()
          or (
            w.status = 'published'
            and exists (
              select 1 from public.books b
              where b.id = book_id and b.status = 'published'
            )
          )
        )
    )
  );

drop policy if exists "authors add their own books to their worlds" on public.story_world_books;
create policy "authors add their own books to their worlds"
  on public.story_world_books for insert to authenticated
  with check (
    exists (
      select 1 from public.story_worlds w
      where w.id = world_id and (w.author_id = auth.uid() or public.is_admin())
    )
    and exists (
      select 1 from public.books b
      where b.id = book_id and (b.author_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "authors remove books from their worlds" on public.story_world_books;
create policy "authors remove books from their worlds"
  on public.story_world_books for delete to authenticated
  using (
    exists (
      select 1 from public.story_worlds w
      where w.id = world_id and (w.author_id = auth.uid() or public.is_admin())
    )
  );
