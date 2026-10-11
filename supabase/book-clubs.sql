-- Palixia Book Clubs foundation (additive migration).
-- Creates club records, memberships, and a public bucket for club profile pictures.
-- Does not modify existing books, profiles, or Community posts.

create table if not exists public.book_clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  avatar_url text,
  club_type text not null check (club_type in ('book', 'genre', 'reading')),
  book_id uuid references public.books(id) on delete set null,
  genre text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  is_official_author_club boolean not null default false,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint book_clubs_type_target_check check (
    (club_type = 'book' and book_id is not null)
    or (club_type = 'genre' and nullif(btrim(genre), '') is not null)
    or (club_type = 'reading')
  ),
  constraint book_clubs_official_book_check check (
    is_official_author_club = false or (club_type = 'book' and book_id is not null)
  )
);

create index if not exists book_clubs_discover_idx
  on public.book_clubs (status, visibility, created_at desc);
create index if not exists book_clubs_owner_idx
  on public.book_clubs (owner_id, created_at desc);
create index if not exists book_clubs_book_idx
  on public.book_clubs (book_id) where book_id is not null;

create table if not exists public.book_club_members (
  club_id uuid not null references public.book_clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner', 'moderator', 'member')),
  membership_status text not null default 'joined' check (membership_status in ('joined', 'pending')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index if not exists book_club_members_user_idx
  on public.book_club_members (user_id, joined_at desc);

alter table public.book_clubs enable row level security;
alter table public.book_club_members enable row level security;

-- Public clubs can be discovered by anyone. Private clubs are visible only to members
-- and their owners. Hidden clubs are visible only to their owner and admins.
drop policy if exists "book clubs discover visible clubs" on public.book_clubs;
create policy "book clubs discover visible clubs" on public.book_clubs
  for select to anon, authenticated
  using (
    (status = 'active' and visibility = 'public')
    or owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.book_club_members m
      where m.club_id = id and m.user_id = auth.uid()
        and m.membership_status = 'joined'
    )
  );

drop policy if exists "book clubs signed in create" on public.book_clubs;
create policy "book clubs signed in create" on public.book_clubs
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and status = 'active'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'active'
    )
    and (
      is_official_author_club = false
      or exists (
        select 1 from public.books b
        where b.id = book_id and b.author_id = auth.uid()
          and b.status = 'published'
      )
    )
    and (
      book_id is null
      or exists (select 1 from public.books b where b.id = book_id and b.status = 'published')
    )
  );

drop policy if exists "book clubs owner update" on public.book_clubs;
create policy "book clubs owner update" on public.book_clubs
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (
    (owner_id = auth.uid() or public.is_admin())
    and (
      is_official_author_club = false
      or exists (
        select 1 from public.books b
        where b.id = book_id and b.author_id = owner_id
          and b.status = 'published'
      )
    )
  );

drop policy if exists "book clubs owner delete" on public.book_clubs;
create policy "book clubs owner delete" on public.book_clubs
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- Members can see the member list only if they belong to the club; the owner can see it too.
drop policy if exists "book club members read with access" on public.book_club_members;
create policy "book club members read with access" on public.book_club_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.book_clubs c
      where c.id = club_id and c.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.book_club_members mine
      where mine.club_id = club_id and mine.user_id = auth.uid()
        and mine.membership_status = 'joined'
    )
    or public.is_admin()
  );

drop policy if exists "book club members join themselves" on public.book_club_members;
create policy "book club members join themselves" on public.book_club_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and member_role = 'member'
    and exists (
      select 1 from public.book_clubs c
      where c.id = club_id and c.status = 'active'
        and c.visibility = 'public'
    )
    and membership_status = 'joined'
  );

drop policy if exists "book club members leave or owner manages" on public.book_club_members;
create policy "book club members leave or owner manages" on public.book_club_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.book_clubs c
      where c.id = club_id and c.owner_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists "book club members owner updates role" on public.book_club_members;
create policy "book club members owner updates role" on public.book_club_members
  for update to authenticated
  using (
    exists (
      select 1 from public.book_clubs c
      where c.id = club_id and c.owner_id = auth.uid()
    )
    or public.is_admin()
  )
  with check (
    exists (
      select 1 from public.book_clubs c
      where c.id = club_id and c.owner_id = auth.uid()
    )
    or public.is_admin()
  );

grant select on public.book_clubs to anon, authenticated;
grant insert, update, delete on public.book_clubs to authenticated;
grant select, insert, update, delete on public.book_club_members to authenticated;

-- Club profile images. Public read is intentional so club avatars can appear in listings.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-club-avatars', 'book-club-avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "club avatars public read" on storage.objects;
create policy "club avatars public read" on storage.objects
  for select to public
  using (bucket_id = 'book-club-avatars');

drop policy if exists "users upload own club avatars" on storage.objects;
create policy "users upload own club avatars" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'book-club-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users update own club avatars" on storage.objects;
create policy "users update own club avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'book-club-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'book-club-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own club avatars" on storage.objects;
create policy "users delete own club avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'book-club-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
