-- Sparks corrective patch: serialize refunds with wallet spending and reject full refunds
-- once the reader has ever tipped (tip debits lack purchase-level attribution).
-- Paystack refund must already be completed and confirmed before this RPC is called.

create or replace function public.admin_record_spark_refund(
  p_paystack_reference text,
  p_paystack_refund_reference text,
  p_admin_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_purchase public.spark_purchases%rowtype;
  v_balance bigint;
  v_refund_id uuid;
begin
  if v_admin_id is null or not exists (
    select 1 from public.profiles
    where id = v_admin_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'Active administrator access required' using errcode = '42501';
  end if;

  if nullif(trim(p_paystack_reference), '') is null
     or nullif(trim(p_paystack_refund_reference), '') is null then
    raise exception 'Both the original Paystack transaction reference and confirmed refund reference are required'
      using errcode = '22023';
  end if;

  select * into v_purchase
  from public.spark_purchases
  where paystack_reference = trim(p_paystack_reference)
  for update;

  if not found then raise exception 'Sparks purchase not found'; end if;
  if v_purchase.status <> 'paid' then
    raise exception 'Only a paid Sparks purchase can be refunded';
  end if;

  -- Match the reader lock used by send_author_sparks, so a refund and tip
  -- cannot race each other while calculating/spending the same wallet balance.
  perform 1 from public.profiles where id = v_purchase.reader_id for update;
  if not found then raise exception 'Reader account not found'; end if;

  -- Tips are fungible and the ledger does not attribute spent Sparks to a
  -- specific purchase. A balance-only check is insufficient: the reader could
  -- have spent this purchase while retaining Sparks from another purchase.
  if exists (
    select 1 from public.reader_spark_ledger
    where reader_id = v_purchase.reader_id
      and entry_type = 'tip_debit'
  ) then
    raise exception 'This reader has tipped before. Purchase-level refund eligibility cannot be verified automatically; investigate manually.';
  end if;

  select coalesce(sum(case
    when entry_type in ('purchase_credit','refund_credit','adjustment') then sparks_amount
    when entry_type in ('tip_debit','refund_debit') then -sparks_amount
    else 0
  end), 0)
  into v_balance
  from public.reader_spark_ledger
  where reader_id = v_purchase.reader_id;

  if v_balance < v_purchase.sparks_amount then
    raise exception 'The reader wallet does not contain enough unused Sparks for a full refund';
  end if;

  insert into public.spark_refund_records (
    purchase_id, reader_id, paystack_reference, paystack_refund_reference,
    amount_kobo, sparks_amount, admin_note, processed_by
  ) values (
    v_purchase.id, v_purchase.reader_id, v_purchase.paystack_reference,
    trim(p_paystack_refund_reference), v_purchase.amount_kobo,
    v_purchase.sparks_amount, nullif(trim(p_admin_note), ''), v_admin_id
  ) returning id into v_refund_id;

  insert into public.reader_spark_ledger (
    reader_id, entry_type, sparks_amount, purchase_id, reference, description
  ) values (
    v_purchase.reader_id, 'refund_debit', v_purchase.sparks_amount,
    v_purchase.id, 'refund:' || v_purchase.paystack_reference,
    'Sparks removed after confirmed Paystack refund'
  );

  update public.spark_purchases
  set status = 'refunded'
  where id = v_purchase.id;

  return jsonb_build_object(
    'success', true,
    'refund_id', v_refund_id,
    'purchase_reference', v_purchase.paystack_reference,
    'refund_reference', trim(p_paystack_refund_reference),
    'amount_kobo', v_purchase.amount_kobo,
    'sparks_reversed', v_purchase.sparks_amount
  );
end;
$$;

revoke all on function public.admin_record_spark_refund(text, text, text) from public, anon;
grant execute on function public.admin_record_spark_refund(text, text, text) to authenticated;

notify pgrst, 'reload schema';
