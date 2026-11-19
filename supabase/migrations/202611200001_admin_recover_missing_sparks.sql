-- Phase 2D: admin recovery of a missing Sparks purchase after independent Paystack verification.
-- The route must verify the transaction with Paystack before invoking this admin-only RPC.

create table if not exists public.spark_recovery_audit (
  id uuid primary key default gen_random_uuid(),
  paystack_reference text not null,
  reader_id uuid not null references public.profiles(id) on delete restrict,
  amount_kobo bigint not null,
  sparks_amount integer not null,
  recovered_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists spark_recovery_audit_reference_idx
  on public.spark_recovery_audit(paystack_reference);

alter table public.spark_recovery_audit enable row level security;
revoke all on public.spark_recovery_audit from public, anon, authenticated;

create or replace function public.admin_recover_verified_spark_purchase(
  p_reference text,
  p_reader_id uuid,
  p_amount_kobo bigint,
  p_sparks_amount integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_purchase public.spark_purchases%rowtype;
  v_profile_status text;
  v_expected_amount bigint;
  v_credited boolean := false;
begin
  if v_admin_id is null or not exists (
    select 1 from public.profiles
    where id = v_admin_id and role = 'admin' and status = 'active'
  ) then
    raise exception 'Active administrator access required' using errcode = '42501';
  end if;

  if p_reference is null or p_reference !~ '^PLXSPK_[a-fA-F0-9]{32}$'
     or p_reader_id is null or p_sparks_amount not in (100,200,300,500,1000) then
    raise exception 'Invalid verified purchase details' using errcode = '22023';
  end if;
  v_expected_amount := p_sparks_amount::bigint * 100;
  if p_amount_kobo <> v_expected_amount then
    raise exception 'Package amount mismatch' using errcode = '22023';
  end if;

  select status into v_profile_status from public.profiles where id = p_reader_id;
  if v_profile_status is null then
    raise exception 'Verified buyer profile does not exist' using errcode = '23503';
  end if;

  insert into public.spark_purchases (
    reader_id, paystack_reference, amount_kobo, sparks_amount, currency, status
  ) values (
    p_reader_id, p_reference, p_amount_kobo, p_sparks_amount, 'NGN', 'pending'
  ) on conflict (paystack_reference) do nothing;

  select * into v_purchase
  from public.spark_purchases
  where paystack_reference = p_reference
  for update;

  if not found or v_purchase.reader_id <> p_reader_id
     or v_purchase.amount_kobo <> p_amount_kobo
     or v_purchase.sparks_amount <> p_sparks_amount
     or v_purchase.currency <> 'NGN'
     or v_purchase.status not in ('pending','paid') then
    raise exception 'Purchase record conflicts with verified Paystack transaction'
      using errcode = '23514';
  end if;

  if v_purchase.status = 'pending' then
    update public.spark_purchases set status = 'paid', paid_at = now()
    where id = v_purchase.id;
    insert into public.reader_spark_ledger (
      reader_id, entry_type, sparks_amount, purchase_id, reference, description
    ) values (
      p_reader_id, 'purchase_credit', p_sparks_amount, v_purchase.id,
      'purchase:' || p_reference, 'Recovered verified Sparks payment'
    );
    v_credited := true;
  end if;

  insert into public.spark_recovery_audit (
    paystack_reference, reader_id, amount_kobo, sparks_amount, recovered_by
  ) values (p_reference, p_reader_id, p_amount_kobo, p_sparks_amount, v_admin_id)
  on conflict (paystack_reference) do nothing;

  return jsonb_build_object(
    'success', true, 'credited', v_credited, 'reader_id', p_reader_id,
    'reference', p_reference, 'amount_kobo', p_amount_kobo,
    'sparks_amount', p_sparks_amount
  );
end;
$$;

revoke all on function public.admin_recover_verified_spark_purchase(text, uuid, bigint, integer) from public, anon;
grant execute on function public.admin_recover_verified_spark_purchase(text, uuid, bigint, integer) to authenticated;

notify pgrst, 'reload schema';
