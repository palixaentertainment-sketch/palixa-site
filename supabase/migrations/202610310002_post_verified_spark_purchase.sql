-- Atomic, idempotent posting after the server has independently verified Paystack.
-- Only the server service role may execute this function.
create or replace function public.post_verified_spark_purchase(
  p_reference text,
  p_amount_kobo bigint,
  p_currency text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.spark_purchases%rowtype;
begin
  select * into v_purchase
  from public.spark_purchases
  where paystack_reference = p_reference
  for update;

  if not found then
    raise exception 'Sparks purchase not found';
  end if;

  if v_purchase.amount_kobo <> p_amount_kobo or v_purchase.currency <> p_currency then
    raise exception 'Verified payment does not match purchase';
  end if;

  if v_purchase.status = 'paid' then
    return false;
  end if;

  if v_purchase.status <> 'pending' then
    raise exception 'Purchase is not pending';
  end if;

  update public.spark_purchases
  set status = 'paid', paid_at = now()
  where id = v_purchase.id;

  insert into public.reader_spark_ledger (
    reader_id, entry_type, sparks_amount, purchase_id, reference, description
  ) values (
    v_purchase.reader_id,
    'purchase_credit',
    v_purchase.sparks_amount,
    v_purchase.id,
    'purchase:' || v_purchase.paystack_reference,
    'Sparks purchase'
  );

  return true;
end;
$$;

revoke all on function public.post_verified_spark_purchase(text, bigint, text) from public, anon, authenticated;
grant execute on function public.post_verified_spark_purchase(text, bigint, text) to service_role;
