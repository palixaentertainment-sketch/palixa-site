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


-- Keep future tip spending calculations aligned with the refund-adjusted wallet balance.
-- Keep exact-reference tip retries idempotent after the monthly release job
-- changes the author tip_credit from pending to available.
create or replace function public.send_author_sparks(
  p_author_id uuid,
  p_book_id uuid,
  p_sparks integer,
  p_reference text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reader_id uuid := auth.uid();
  v_balance bigint;
  v_author_role text;
  v_author_status text;
  v_book_author uuid;
  v_existing_reader public.reader_spark_ledger%rowtype;
  v_existing_author public.author_wallet_ledger%rowtype;
  v_existing_fee public.author_wallet_ledger%rowtype;
  v_total_kobo bigint;
  v_author_kobo bigint;
  v_platform_kobo bigint;
begin
  if not public.is_admin() then
    raise exception 'Sparks is currently restricted to Palixia admins during testing' using errcode = '42501';
  end if;
  if v_reader_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_author_id is null or p_author_id = v_reader_id then
    raise exception 'You cannot send Sparks to this account' using errcode = '22023';
  end if;
  if p_sparks is null or p_sparks < 1 or p_sparks > 10000 then
    raise exception 'Invalid Spark amount' using errcode = '22023';
  end if;
  if p_reference is null or p_reference !~ '^PLXTIP_[a-f0-9]{32}$' then
    raise exception 'Invalid tip reference' using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = v_reader_id for update;
  if not found then raise exception 'Reader account not found'; end if;

  select role, status into v_author_role, v_author_status
    from public.profiles where id = p_author_id;
  if not found or v_author_role not in ('author','admin') or v_author_status <> 'active' then
    raise exception 'This author account is not eligible to receive Sparks';
  end if;

  if p_book_id is not null then
    select author_id into v_book_author from public.books where id = p_book_id;
    if not found or v_book_author <> p_author_id then
      raise exception 'The selected book does not belong to this author';
    end if;
  end if;

  if not exists (
    select 1 from public.author_earnings_agreements
    where author_id = p_author_id and agreement_version = 'sparks-v3-monthly-payouts'
  ) then
    raise exception 'The author has not accepted the updated 90/10 Sparks earnings agreement';
  end if;

  select * into v_existing_reader
  from public.reader_spark_ledger
  where reference = p_reference
  for update;

  v_total_kobo := p_sparks::bigint * 100;
  v_author_kobo := (v_total_kobo * 90) / 100;
  v_platform_kobo := v_total_kobo - v_author_kobo;

  if found then
    select * into v_existing_author
    from public.author_wallet_ledger
    where reference = p_reference and entry_type = 'tip_credit';

    select * into v_existing_fee
    from public.author_wallet_ledger
    where reference = p_reference || '_PLATFORM_FEE' and entry_type = 'platform_fee';

    if v_existing_reader.reader_id <> v_reader_id
       or v_existing_reader.entry_type <> 'tip_debit'
       or v_existing_reader.sparks_amount <> p_sparks
       or v_existing_author.id is null
       or v_existing_author.author_id <> p_author_id
       or v_existing_author.amount_kobo <> v_author_kobo
       or v_existing_author.currency <> 'NGN'
       or v_existing_author.related_book_id is distinct from p_book_id
       or v_existing_author.status not in ('pending','available')
       or v_existing_fee.id is null
       or v_existing_fee.author_id <> p_author_id
       or v_existing_fee.amount_kobo <> v_platform_kobo
       or v_existing_fee.currency <> 'NGN'
       or v_existing_fee.related_book_id is distinct from p_book_id
       or v_existing_fee.status <> 'pending' then
      raise exception 'Tip reference has already been used for a different transaction'
        using errcode = '23505';
    end if;

    return jsonb_build_object('success', true, 'already_processed', true);
  end if;

  select coalesce(sum(case
    when entry_type in ('purchase_credit','refund_credit','adjustment') then sparks_amount
    when entry_type in ('tip_debit','refund_debit') then -sparks_amount
    else 0 end), 0)
    into v_balance
    from public.reader_spark_ledger
    where reader_id = v_reader_id;

  if v_balance < p_sparks then
    raise exception 'Insufficient Sparks balance' using errcode = '22023';
  end if;

  insert into public.reader_spark_ledger
    (reader_id, entry_type, sparks_amount, reference, description)
  values
    (v_reader_id, 'tip_debit', p_sparks, p_reference, 'Sparks sent to author');

  insert into public.author_wallet_ledger
    (author_id, entry_type, status, amount_kobo, currency, reference, description, related_book_id)
  values
    (p_author_id, 'tip_credit', 'pending', v_author_kobo, 'NGN', p_reference,
     'Author share (90%) of ' || p_sparks::text || ' Sparks support', p_book_id);

  insert into public.author_wallet_ledger
    (author_id, entry_type, status, amount_kobo, currency, reference, description, related_book_id)
  values
    (p_author_id, 'platform_fee', 'pending', v_platform_kobo, 'NGN', p_reference || '_PLATFORM_FEE',
     'Palixia platform share (10%) of ' || p_sparks::text || ' Sparks support', p_book_id);

  return jsonb_build_object(
    'success', true,
    'already_processed', false,
    'author_amount_kobo', v_author_kobo,
    'platform_amount_kobo', v_platform_kobo
  );
end;
$$;

revoke all on function public.send_author_sparks(uuid, uuid, integer, text) from public, anon;
grant execute on function public.send_author_sparks(uuid, uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';
