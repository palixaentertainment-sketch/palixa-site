-- Palixia Sparks reader wallet and author withdrawal foundation.
-- Additive only. Apply to staging first; no live payment or payout is enabled here.

create table if not exists public.spark_purchases (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid not null references public.profiles(id) on delete restrict,
  paystack_reference text not null unique,
  amount_kobo bigint not null check (amount_kobo in (10000, 20000, 30000, 50000, 100000)),
  sparks_amount integer not null check (sparks_amount in (100, 200, 300, 500, 1000)),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint spark_purchase_package_matches check (
    (amount_kobo = 10000 and sparks_amount = 100) or
    (amount_kobo = 20000 and sparks_amount = 200) or
    (amount_kobo = 30000 and sparks_amount = 300) or
    (amount_kobo = 50000 and sparks_amount = 500) or
    (amount_kobo = 100000 and sparks_amount = 1000)
  )
);

create index if not exists spark_purchases_reader_created_idx
  on public.spark_purchases(reader_id, created_at desc);

create table if not exists public.reader_spark_ledger (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid not null references public.profiles(id) on delete restrict,
  entry_type text not null check (entry_type in ('purchase_credit','tip_debit','refund_credit','adjustment')),
  sparks_amount integer not null check (sparks_amount > 0),
  purchase_id uuid references public.spark_purchases(id) on delete restrict,
  reference text unique,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists reader_spark_ledger_reader_created_idx
  on public.reader_spark_ledger(reader_id, created_at desc);

-- One withdrawal request per request ID; amounts are stored in kobo.
-- ₦1,000 is the minimum. Requests remain subject to manual/admin review and an approved payout route.
create table if not exists public.author_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo >= 100000),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'requested' check (status in ('requested','under_review','approved','rejected','paid','cancelled')),
  payout_reference text,
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz
);

create index if not exists author_withdrawal_requests_author_created_idx
  on public.author_withdrawal_requests(author_id, requested_at desc);

alter table public.spark_purchases enable row level security;
alter table public.reader_spark_ledger enable row level security;
alter table public.author_withdrawal_requests enable row level security;

drop policy if exists "read own spark purchases" on public.spark_purchases;
create policy "read own spark purchases" on public.spark_purchases
  for select to authenticated using (reader_id = auth.uid());

drop policy if exists "read own spark ledger" on public.reader_spark_ledger;
create policy "read own spark ledger" on public.reader_spark_ledger
  for select to authenticated using (reader_id = auth.uid());

drop policy if exists "read own withdrawal requests" on public.author_withdrawal_requests;
create policy "read own withdrawal requests" on public.author_withdrawal_requests
  for select to authenticated using (author_id = auth.uid());

-- No client-side financial writes. Trusted server routes using the service role will post ledger entries.
revoke insert, update, delete on public.spark_purchases from anon, authenticated;
revoke insert, update, delete on public.reader_spark_ledger from anon, authenticated;
revoke insert, update, delete on public.author_withdrawal_requests from anon, authenticated;
grant select on public.spark_purchases, public.reader_spark_ledger, public.author_withdrawal_requests to authenticated;

-- Prevent duplicate purchase-credit postings for the same purchase.
create unique index if not exists reader_spark_ledger_one_purchase_credit_idx
  on public.reader_spark_ledger(purchase_id)
  where entry_type = 'purchase_credit' and purchase_id is not null;

-- Balances must be derived from ledger entries, not client-editable profile fields.
create or replace view public.reader_spark_balances
with (security_invoker = true) as
select
  p.id as reader_id,
  coalesce(sum(case
    when l.entry_type in ('purchase_credit','refund_credit','adjustment') then l.sparks_amount
    when l.entry_type = 'tip_debit' then -l.sparks_amount
    else 0
  end), 0)::bigint as sparks_balance
from public.profiles p
left join public.reader_spark_ledger l on l.reader_id = p.id
group by p.id;

grant select on public.reader_spark_balances to authenticated;
