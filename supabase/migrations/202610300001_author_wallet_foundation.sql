-- Palixia author wallet foundation. Additive migration; does not alter existing tables.
create table if not exists public.author_earnings_agreements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict,
  agreement_version text not null,
  accepted_at timestamptz not null default now(),
  unique (author_id, agreement_version)
);

create table if not exists public.author_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict,
  entry_type text not null check (entry_type in ('tip_credit','platform_fee','refund','chargeback','payout','adjustment')),
  status text not null default 'pending' check (status in ('pending','available','reversed','paid')),
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  reference text,
  description text,
  related_book_id uuid references public.books(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists author_wallet_ledger_author_created_idx
  on public.author_wallet_ledger(author_id, created_at desc);

alter table public.author_earnings_agreements enable row level security;
alter table public.author_wallet_ledger enable row level security;

drop policy if exists "authors read own earnings agreement" on public.author_earnings_agreements;
create policy "authors read own earnings agreement"
  on public.author_earnings_agreements for select to authenticated
  using (author_id = auth.uid());

drop policy if exists "authors accept own earnings agreement" on public.author_earnings_agreements;
create policy "authors accept own earnings agreement"
  on public.author_earnings_agreements for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('author','admin') and p.status = 'active')
  );

drop policy if exists "authors read own wallet ledger" on public.author_wallet_ledger;
create policy "authors read own wallet ledger"
  on public.author_wallet_ledger for select to authenticated
  using (author_id = auth.uid());

-- Financial ledger writes are server-side only (service role); clients cannot create or alter earnings.
revoke insert, update, delete on public.author_wallet_ledger from anon, authenticated;
grant select on public.author_wallet_ledger to authenticated;
grant select, insert on public.author_earnings_agreements to authenticated;
revoke update, delete on public.author_earnings_agreements from anon, authenticated;
