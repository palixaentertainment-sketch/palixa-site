-- Return only non-sensitive payout account display fields to the authenticated owner.
create or replace function public.get_my_author_payout_account()
returns table (
  bank_name text,
  account_name text,
  account_last4 text,
  verified_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id
      and role in ('author', 'admin')
      and status = 'active'
  ) then
    raise exception 'Active author access is required';
  end if;

  return query
    select a.bank_name, a.account_name, a.account_last4, a.verified_at
    from public.author_payout_accounts a
    where a.author_id = v_user_id
      and a.verified_at is not null
    limit 1;
end;
$$;

revoke all on function public.get_my_author_payout_account() from public, anon;
grant execute on function public.get_my_author_payout_account() to authenticated;
