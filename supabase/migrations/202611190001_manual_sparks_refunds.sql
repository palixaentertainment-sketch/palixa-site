-- Phase 2A: auditable, manual Paystack refunds for unused Sparks purchases.
-- This migration does not call Paystack or issue refunds. Admins must first
-- complete the refund in Paystack, then record the confirmed refund reference here.

alter table public.reader_spark_ledger
  drop constraint if exists reader_spark_ledger_entry_type_check;

alter table public.reader_spark_ledger
  add constraint reader_spark_ledger_entry_type_check
  check (entry_type in ('purchase_credit','tip_debit','refund_credit','refund_debit','adjustment'));

create unique index if not exists reader_spark_ledger_one_purchase_refund_idx
  on public.reader_spark_ledger(purchase_id)
  where entry_type = 'refund_debit' and purchase_id is not null;

create table if not exists public.spark_refund_records (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.spark_purchases(id) on delete restrict,
  reader_id uuid not null references public.profiles(id) on delete restrict,
  paystack_reference text not null unique,
  paystack_refund_reference text not null unique,
  amount_kobo bigint not null check (amount_kobo > 0),
  sparks_amount integer not null check (sparks_amount > 0),
  admin_note text,
  processed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists spark_refund_records_created_idx
  on public.spark_refund_records(created_at desc);

alter table public.spark_refund_records enable row level security;
revoke all on public.spark_refund_records from public, anon, authenticated;

-- Keep the wallet balance view consistent with the refund debit ledger entry.
create or replace view public.reader_spark_balances
with (security_invoker = true) as
select
  p.id as reader_id,
  coalesce(sum(case
    when l.entry_type in ('purchase_credit','refund_credit','adjustment') then l.sparks_amount
    when l.entry_type in ('tip_debit','refund_debit') then -l.sparks_amount
    else 0
  end), 0)::bigint as sparks_balance
from public.profiles p
left join public.reader_spark_ledger l on l.reader_id = p.id
group by p.id;

grant select on public.reader_spark_balances to authenticated;

-- Admin-only list of completed manual refunds. No payout or payment credentials are exposed.
create or replace function public.admin_list_spark_refunds()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  ) then
    raise exception 'Active administrator access required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.created_at desc)
    from (
      select id, purchase_id, reader_id, paystack_reference,
             paystack_refund_reference, amount_kobo, sparks_amount,
             admin_note, processed_by, created_at
      from public.spark_refund_records
      order by created_at desc
      limit 100
    ) r
  ), '[]'::jsonb);
end;
$$;

-- Record a refund only after it has been completed and confirmed in Paystack.
-- Full-purchase refunds are allowed only while all purchased Sparks remain in the wallet.
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

  select coalesce(sum(case
    when entry_type in ('purchase_credit','refund_credit','adjustment') then sparks_amount
    when entry_type in ('tip_debit','refund_debit') then -sparks_amount
    else 0
  end), 0)
  into v_balance
  from public.reader_spark_ledger
  where reader_id = v_purchase.reader_id;

  if v_balance < v_purchase.sparks_amount then
    raise exception 'This reader has already spent some Sparks. Do not record a full refund automatically; investigate the related tips and earnings first.';
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

revoke all on function public.admin_list_spark_refunds() from public, anon;
grant execute on function public.admin_list_spark_refunds() to authenticated;

revoke all on function public.admin_record_spark_refund(text, text, text) from public, anon;
grant execute on function public.admin_record_spark_refund(text, text, text) to authenticated;

notify pgrst, 'reload schema';
