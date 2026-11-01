-- Recover a verified, missing Sparks purchase through a tightly scoped SECURITY DEFINER RPC.
-- The caller must already have verified Paystack and validated transaction metadata.
create or replace function public.restore_missing_spark_purchase(
  p_reader_id uuid,
  p_reference text,
  p_amount_kobo bigint,
  p_sparks_amount integer
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_purchase_id uuid;
begin
  if p_reader_id is null
     or p_reference !~ '^PLXSPK_[a-f0-9]{32}$'
     or not (
       (p_amount_kobo = 10000 and p_sparks_amount = 100) or
       (p_amount_kobo = 20000 and p_sparks_amount = 200) or
       (p_amount_kobo = 30000 and p_sparks_amount = 300) or
       (p_amount_kobo = 50000 and p_sparks_amount = 500) or
       (p_amount_kobo = 100000 and p_sparks_amount = 1000)
     ) then
    raise exception 'Invalid Sparks purchase recovery details' using errcode = '22023';
  end if;

  insert into public.spark_purchases (
    reader_id, paystack_reference, amount_kobo, sparks_amount, currency, status
  ) values (
    p_reader_id, p_reference, p_amount_kobo, p_sparks_amount, 'NGN', 'pending'
  )
  on conflict (paystack_reference) do nothing;

  select id into v_purchase_id
  from public.spark_purchases
  where paystack_reference = p_reference
    and reader_id = p_reader_id
    and amount_kobo = p_amount_kobo
    and sparks_amount = p_sparks_amount
    and currency = 'NGN';

  if v_purchase_id is null then
    raise exception 'Existing Sparks purchase does not match recovery details' using errcode = '23505';
  end if;

  return v_purchase_id;
end;
$$;

revoke all on function public.restore_missing_spark_purchase(uuid, text, bigint, integer) from public, anon, authenticated;
grant execute on function public.restore_missing_spark_purchase(uuid, text, bigint, integer) to service_role;
