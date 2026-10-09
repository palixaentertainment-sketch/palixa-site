-- Palixia likes and chapter comments. Additive migration: does not delete existing data.
alter table public.books add column if not exists like_count integer not null default 0;
alter table public.chapters add column if not exists like_count integer not null default 0;

create table if not exists public.book_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create table if not exists public.chapter_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_chapter_idx on public.comments(chapter_id, created_at);
alter table public.book_likes enable row level security;
alter table public.chapter_likes enable row level security;
alter table public.comments enable row level security;

drop policy if exists "palixia read own book likes" on public.book_likes;
create policy "palixia read own book likes" on public.book_likes for select to authenticated using (auth.uid() = user_id);
drop policy if exists "palixia like published books" on public.book_likes;
create policy "palixia like published books" on public.book_likes for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.books b where b.id = book_id and b.status = 'published' and b.author_id <> auth.uid())
);
drop policy if exists "palixia unlike own books" on public.book_likes;
create policy "palixia unlike own books" on public.book_likes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "palixia read own chapter likes" on public.chapter_likes;
create policy "palixia read own chapter likes" on public.chapter_likes for select to authenticated using (auth.uid() = user_id);
drop policy if exists "palixia like published chapters" on public.chapter_likes;
create policy "palixia like published chapters" on public.chapter_likes for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.chapters c join public.books b on b.id = c.book_id where c.id = chapter_id and c.status = 'published' and b.status = 'published' and b.author_id <> auth.uid())
);
drop policy if exists "palixia unlike own chapters" on public.chapter_likes;
create policy "palixia unlike own chapters" on public.chapter_likes for delete to authenticated using (auth.uid() = user_id);
grant select, insert, delete on public.book_likes, public.chapter_likes to authenticated;

drop policy if exists "palixia read comments" on public.comments;
create policy "palixia read comments" on public.comments for select to anon, authenticated using (
  user_id = auth.uid() or exists (select 1 from public.chapters c join public.books b on b.id = c.book_id where c.id = chapter_id and (b.author_id = auth.uid() or (comments.status = 'visible' and c.status = 'published' and b.status = 'published')))
);
drop policy if exists "palixia post comments" on public.comments;
create policy "palixia post comments" on public.comments for insert to authenticated with check (
  auth.uid() = user_id and exists (select 1 from public.chapters c join public.books b on b.id = c.book_id where c.id = chapter_id and c.status = 'published' and b.status = 'published')
  and (parent_id is null or exists (select 1 from public.comments parent where parent.id = parent_id and parent.chapter_id = chapter_id and parent.parent_id is null))
);
drop policy if exists "palixia edit own comments" on public.comments;
create policy "palixia edit own comments" on public.comments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "palixia delete comments" on public.comments;
create policy "palixia delete comments" on public.comments for delete to authenticated using (
  auth.uid() = user_id or exists (select 1 from public.chapters c join public.books b on b.id = c.book_id where c.id = chapter_id and b.author_id = auth.uid())
);
grant select on public.comments to anon, authenticated;
grant insert (chapter_id, user_id, parent_id, body) on public.comments to authenticated;
grant update (body, updated_at) on public.comments to authenticated;
grant delete on public.comments to authenticated;

create or replace function public.palixia_count_book_like()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.books set like_count = like_count + 1 where id = new.book_id;
  else update public.books set like_count = greatest(0, like_count - 1) where id = old.book_id; end if;
  return null;
end; $$;
create or replace function public.palixia_count_chapter_like()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.chapters set like_count = like_count + 1 where id = new.chapter_id;
  else update public.chapters set like_count = greatest(0, like_count - 1) where id = old.chapter_id; end if;
  return null;
end; $$;
drop trigger if exists palixia_book_like_count on public.book_likes;
create trigger palixia_book_like_count after insert or delete on public.book_likes for each row execute function public.palixia_count_book_like();
drop trigger if exists palixia_chapter_like_count on public.chapter_likes;
create trigger palixia_chapter_like_count after insert or delete on public.chapter_likes for each row execute function public.palixia_count_chapter_like();

create or replace function public.palixia_check_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is not null and not exists (select 1 from public.comments p where p.id = new.parent_id and p.chapter_id = new.chapter_id and p.parent_id is null) then
    raise exception 'invalid_reply';
  end if;
  if (select count(*) from public.comments where user_id = new.user_id and created_at > now() - interval '1 minute') >= 8 then raise exception 'too_many_comments'; end if;
  new.body := btrim(new.body);
  return new;
end; $$;
drop trigger if exists palixia_comment_check on public.comments;
create trigger palixia_comment_check before insert on public.comments for each row execute function public.palixia_check_comment();
