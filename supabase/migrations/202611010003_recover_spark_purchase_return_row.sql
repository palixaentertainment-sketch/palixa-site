-- Return the recovered purchase row from the same database function call.
-- This avoids a separate PostgREST read immediately after a successful insert.
drop function if exists public.recover_verified_spark_purchase(text, bigint, integer);

create function public.recover_verified_spark_purchase(
  p_reference text,
  p_amount_kobo bigint,
  p_sparks_amount integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_status text;
  v_purchase public.spark_purchases%rowtype;
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

  select * into v_purchase
    from public.spark_purchases
    where paystack_reference = p_reference;

  if not found
     or v_purchase.reader_id <> v_user_id
     or v_purchase.amount_kobo <> p_amount_kobo
     or v_purchase.sparks_amount <> p_sparks_amount
     or v_purchase.currency <> 'NGN' then
    raise exception 'Recovered purchase does not match the verified buyer or package'
      using errcode = '23514';
  end if;

  return jsonb_build_object(
    'id', v_purchase.id,
    'reader_id', v_purchase.reader_id,
    'amount_kobo', v_purchase.amount_kobo,
    'sparks_amount', v_purchase.sparks_amount,
    'currency', v_purchase.currency,
    'status', v_purchase.status
  );
end;
$function$;

revoke all on function public.recover_verified_spark_purchase(text, bigint, integer) from public;
revoke all on function public.recover_verified_spark_purchase(text, bigint, integer) from anon;
grant execute on function public.recover_verified_spark_purchase(text, bigint, integer) to authenticated;
