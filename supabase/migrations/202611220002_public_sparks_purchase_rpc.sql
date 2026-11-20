-- Public authenticated readers can create pending purchases for the fixed packages.
-- Paystack payment is still independently verified before wallet crediting.
-- Create pending Sparks purchases through a narrowly scoped, authenticated RPC.
-- Package validation is expressed without a nested boolean expression to keep
-- the migration straightforward to review and execute.
create or replace function public.create_pending_spark_purchase(
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
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_reference !~ '^PLXSPK_[a-fA-F0-9]{32}$' then
    raise exception 'Invalid Sparks reference' using errcode = '22023';
  end if;

  if p_sparks_amount not in (100, 200, 300, 500, 1000)
     or p_amount_kobo <> (p_sparks_amount::bigint * 100) then
    raise exception 'Invalid Sparks package' using errcode = '22023';
  end if;


  insert into public.spark_purchases (
    reader_id,
    paystack_reference,
    amount_kobo,
    sparks_amount,
    currency,
    status
  )
  values (
    v_user_id,
    p_reference,
    p_amount_kobo,
    p_sparks_amount,
    'NGN',
    'pending'
  );
end;
$function$;

revoke all on function public.create_pending_spark_purchase(text, bigint, integer) from public;
revoke all on function public.create_pending_spark_purchase(text, bigint, integer) from anon;
grant execute on function public.create_pending_spark_purchase(text, bigint, integer) to authenticated;
