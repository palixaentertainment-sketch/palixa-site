-- Secure storage for verified author payout accounts.
create table if not exists public.author_payout_accounts (
  author_id uuid primary key references public.profiles(id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_name text not null,
  account_number_ciphertext text not null,
  account_number_iv text not null,
  account_number_tag text not null,
  account_last4 text not null check (account_last4 ~ '^[0-9]{4}$'),
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.author_payout_accounts enable row level security;
revoke all on public.author_payout_accounts from anon, authenticated;
