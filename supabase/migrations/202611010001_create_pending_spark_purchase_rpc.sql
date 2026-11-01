-- Create pending Sparks purchases through a narrowly scoped, authenticated RPC.
-- This avoids relying on direct PostgREST table INSERT grants for checkout initialization.
create or replace function public.create_pending_spark_purchase(
  p_reference text,
  p_amount_kobo bigint,
  p_sparks_amount integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_reference !~ '^PLXSPK_[a-fA-F0-9]{32}$' then
    raise exception 'Invalid Sparks reference' using errcode = '22023';
  end if;

  if not (
    (p_amount_kobo = 10000 and p_sparks_amount = 100) or
    (p_amount_kobo = 20000 and p_sparks_amount = 200) or
    (p_amount_kobo = 30000 and p_sparks_amount = 300) or
    (p_amount_kobo = 50000 and p_sparks_amount = 500) or
    (p_amount_kobo = 100000 and p_sparks_amount = 1000)
  ) then
    raise exception 'Invalid Sparks package' using errcode = '22023';
  end if;

  select role, status into v_profile
  from public.profiles
  where id = v_user_id;

  if v_profile.role is distinct from 'admin'
     or v_profile.status is distinct from 'active' then
    raise exception 'Sparks testing is restricted to active admins' using errcode = '42501';
  end if;

  insert into public.spark_purchases (
    reader_id, paystack_reference, amount_kobo, sparks_amount, currency, status
  ) values (
    v_user_id, p_reference, p_amount_kobo, p_sparks_amount, 'NGN', 'pending'
  );
end;
$$;

revoke all on function public.create_pending_spark_purchase(text, bigint, integer) from public, anon;
grant execute on function public.create_pending_spark_purchase(text, bigint, integer) to authenticated;
