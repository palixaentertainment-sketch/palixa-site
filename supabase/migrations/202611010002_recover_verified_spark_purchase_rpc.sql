-- Safely restore a missing Sparks purchase after the server has verified
-- the exact Paystack transaction. The function is admin-only and idempotent.
create or replace function public.recover_verified_spark_purchase(
  p_reference text,
  p_amount_kobo bigint,
  p_sparks_amount integer
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_reference !~ '^PLXSPK_[a-fA-F0-9]{32}$'
     or p_sparks_amount not in (100, 200, 300, 500, 1000)
     or p_amount_kobo <> (p_sparks_amount::bigint * 100) then
    raise exception 'Invalid Sparks purchase details' using errcode = '22023';
  end if;

  select role, status into v_role, v_status
    from public.profiles where id = v_user_id;

  if v_role is distinct from 'admin' or v_status is distinct from 'active' then
    raise exception 'Sparks recovery is restricted to active admins' using errcode = '42501';
  end if;

  insert into public.spark_purchases (
    reader_id, paystack_reference, amount_kobo, sparks_amount, currency, status
  ) values (
    v_user_id, p_reference, p_amount_kobo, p_sparks_amount, 'NGN', 'pending'
  )
  on conflict (paystack_reference) do nothing;
end;
$function$;

revoke all on function public.recover_verified_spark_purchase(text, bigint, integer) from public;
revoke all on function public.recover_verified_spark_purchase(text, bigint, integer) from anon;
grant execute on function public.recover_verified_spark_purchase(text, bigint, integer) to authenticated;
