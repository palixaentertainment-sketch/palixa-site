-- Palixia Reading Journey: private reading activity.
-- Run this migration once in Supabase SQL Editor before using the new Library tab.

create table if not exists public.reading_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  activity_date date not null default ((now() at time zone 'utc')::date),
  created_at timestamptz not null default now(),
  unique (user_id, chapter_id, activity_date)
);

create index if not exists reading_activity_user_date_idx
  on public.reading_activity (user_id, activity_date desc);

alter table public.reading_activity enable row level security;

drop policy if exists "read own reading activity" on public.reading_activity;
create policy "read own reading activity" on public.reading_activity
  for select to authenticated
  using (auth.uid() = user_id);

grant select on public.reading_activity to authenticated;
revoke insert, update, delete on public.reading_activity from anon, authenticated;

-- Record at most one activity per chapter per reader per UTC day.
-- Preserve the existing per-chapter read counts and per-book first-read count.
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

  insert into public.reading_activity (user_id, book_id, chapter_id, activity_date)
  values (auth.uid(), v_book, p_chapter, (now() at time zone 'utc')::date)
  on conflict (user_id, chapter_id, activity_date) do nothing;

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

grant execute on function public.record_read(uuid) to authenticated;
