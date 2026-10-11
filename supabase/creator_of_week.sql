-- Palixia: manually selected Creator of the Week.
-- Run once in Supabase > SQL Editor > New query, then press Run.
-- The homepage will not auto-select a creator; only an active admin can change this selection.

create table if not exists public.creator_of_week (
  id boolean primary key default true check (id = true),
  book_id uuid references public.books(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- Upgrade an existing table created before updated_by was added.
alter table public.creator_of_week
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.creator_of_week enable row level security;

drop policy if exists "creator of the week is public" on public.creator_of_week;
create policy "creator of the week is public"
  on public.creator_of_week for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.creator_of_week from anon, authenticated;
grant select on public.creator_of_week to anon, authenticated;

create or replace function public.admin_set_creator_of_week(p_book_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  if p_book_id is not null and not exists (
    select 1
    from public.books b
    join public.profiles p on p.id = b.author_id
    where b.id = p_book_id
      and b.status = 'published'
      and p.status = 'active'
  ) then
    raise exception 'published_book_required';
  end if;

  insert into public.creator_of_week (id, book_id, updated_at, updated_by)
  values (true, p_book_id, now(), auth.uid())
  on conflict (id) do update
    set book_id = excluded.book_id,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.admin_set_creator_of_week(uuid) from public, anon;
grant execute on function public.admin_set_creator_of_week(uuid) to authenticated;
