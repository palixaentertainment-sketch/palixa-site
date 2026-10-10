-- Palixia: manually selected Creator of the Week.
-- Run once in Supabase SQL Editor before deploying the matching website update.

create table if not exists public.creator_of_week (
  id boolean primary key default true check (id = true),
  book_id uuid references public.books(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.creator_of_week enable row level security;

drop policy if exists "creator of week is publicly readable" on public.creator_of_week;
create policy "creator of week is publicly readable"
  on public.creator_of_week for select using (true);

grant select on public.creator_of_week to anon, authenticated;
revoke insert, update, delete on public.creator_of_week from anon, authenticated;

create or replace function public.admin_set_creator_of_week(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an active Palixia admin can select Creator of the Week.';
  end if;

  if p_book_id is null then
    delete from public.creator_of_week where id = true;
    return;
  end if;

  if not exists (
    select 1 from public.books
    where id = p_book_id and status = 'published'
  ) then
    raise exception 'Choose a published book or poem.';
  end if;

  insert into public.creator_of_week (id, book_id, updated_at)
  values (true, p_book_id, now())
  on conflict (id) do update
    set book_id = excluded.book_id,
        updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.admin_set_creator_of_week(uuid) to authenticated;
