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

-- Automatically remove a Coming Soon entry from public view when its linked book is published.
create or replace function public.sync_coming_soon_release()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.linked_book_id is not null and exists (
    select 1 from public.books b
    where b.id = new.linked_book_id and b.status = 'published'
  ) then
    new.status := 'released';
  end if;
  return new;
end;
$$;

drop trigger if exists coming_soon_check_linked_book on public.coming_soon_books;
create trigger coming_soon_check_linked_book
before insert or update of linked_book_id, status
on public.coming_soon_books
for each row execute function public.sync_coming_soon_release();

create or replace function public.mark_coming_soon_books_released()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    update public.coming_soon_books
      set status = 'released', updated_at = now()
      where linked_book_id = new.id and status = 'upcoming';
  end if;
  return new;
end;
$$;

drop trigger if exists published_book_releases_coming_soon on public.books;
create trigger published_book_releases_coming_soon
after insert or update of status
on public.books
for each row execute function public.mark_coming_soon_books_released();


-- Reader release reminders for Coming Soon books.
create table if not exists public.coming_soon_subscriptions (
  id uuid primary key default gen_random_uuid(),
  coming_soon_book_id uuid not null references public.coming_soon_books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (coming_soon_book_id, user_id)
);
create index if not exists coming_soon_subscriptions_book_idx
  on public.coming_soon_subscriptions(coming_soon_book_id);
alter table public.coming_soon_subscriptions enable row level security;
drop policy if exists "readers manage own coming soon reminders" on public.coming_soon_subscriptions;
create policy "readers manage own coming soon reminders"
  on public.coming_soon_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert on public.coming_soon_subscriptions to authenticated;

-- Add the release-reminder notification kind without changing existing kinds.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('community_like','community_comment','follow','new_book','new_chapter','palixia_news','coming_soon_release'));

create or replace function public.notify_coming_soon_subscribers()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'upcoming' and new.status = 'released' then
    insert into public.notifications(recipient_id, actor_id, kind, message, link_url)
    select s.user_id, null, 'coming_soon_release',
           'The book you were waiting for is now available: ' || new.title,
           case when new.linked_book_id is not null then '/book/' || new.linked_book_id::text else '/discover' end
    from public.coming_soon_subscriptions s
    where s.coming_soon_book_id = new.id and s.notified_at is null
    on conflict do nothing;
    update public.coming_soon_subscriptions
      set notified_at = now()
      where coming_soon_book_id = new.id and notified_at is null;
  end if;
  return new;
end;
$$;
drop trigger if exists coming_soon_release_notifications on public.coming_soon_books;
create trigger coming_soon_release_notifications
after update of status on public.coming_soon_books
for each row execute function public.notify_coming_soon_subscribers();
