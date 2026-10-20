-- Palixia scheduled chapter publishing.
-- Run this migration in Supabase SQL Editor before enabling the feature.

alter table public.chapters
  drop constraint if exists chapters_status_check;

alter table public.chapters
  add constraint chapters_status_check
  check (status in ('draft', 'scheduled', 'published'));

alter table public.chapters
  add column if not exists scheduled_at timestamptz;

-- Scheduled content must have a future release time; other states must not retain one.
alter table public.chapters
  drop constraint if exists chapters_scheduled_at_check;
alter table public.chapters
  add constraint chapters_scheduled_at_check
  check (
    (status = 'scheduled' and scheduled_at is not null)
    or (status <> 'scheduled' and scheduled_at is null)
  ) not valid;

-- Let authors store a schedule timestamp through the existing chapter editor.
grant insert (book_id, chapter_number, title, content, status, scheduled_at) on public.chapters to authenticated;
grant update (chapter_number, title, content, status, scheduled_at, updated_at) on public.chapters to authenticated;

-- Comic pages belonging to scheduled chapters must not be readable before release.
drop policy if exists "read pages" on public.chapter_pages;
create policy "read pages" on public.chapter_pages for select using (
  exists (
    select 1
    from public.chapters c
    join public.books b on b.id = c.book_id
    where c.id = chapter_pages.chapter_id
      and (
        b.author_id = auth.uid()
        or public.is_admin()
        or (b.status = 'published' and c.status = 'published')
      )
  )
);

-- Automatic publishing runs in PostgreSQL, not a Vercel Hobby cron job.
-- pg_cron is available on Supabase; this job publishes due chapters every minute.
create extension if not exists pg_cron with schema extensions;

create or replace function public.publish_due_chapters()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  published_count integer;
begin
  update public.chapters c
  set status = 'published',
      scheduled_at = null,
      updated_at = now()
  from public.books b
  where c.book_id = b.id
    and c.status = 'scheduled'
    and c.scheduled_at <= now()
    and b.status = 'published';
  get diagnostics published_count = row_count;
  return published_count;
end;
$$;

revoke all on function public.publish_due_chapters() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'palixia-publish-due-chapters') then
    perform cron.schedule(
      'palixia-publish-due-chapters',
      '* * * * *',
      $$select public.publish_due_chapters();$$
    );
  end if;
end;
$$;
