-- Palixia Originals admin controls.
-- Run once in Supabase SQL Editor after the is_palixia_original column exists.

create or replace function public.admin_set_palixia_original(
  p_book_id uuid,
  p_is_original boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only';
  end if;

  update public.books
  set is_palixia_original = p_is_original,
      updated_at = now()
  where id = p_book_id;

  if not found then
    raise exception 'book_not_found';
  end if;
end;
$$;

revoke all on function public.admin_set_palixia_original(uuid, boolean) from public, anon;
grant execute on function public.admin_set_palixia_original(uuid, boolean) to authenticated;
