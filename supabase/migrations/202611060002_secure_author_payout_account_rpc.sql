-- Save a verified payout account through an authenticated, owner-scoped
-- SECURITY DEFINER function. This avoids depending on service_role table grants.
create or replace function public.save_author_payout_account(
  p_bank_code text,
  p_bank_name text,
  p_account_name text,
  p_account_number_ciphertext text,
  p_account_number_iv text,
  p_account_number_tag text,
  p_account_last4 text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Please sign in to save payout details' using errcode = '42501';
  end if;

  select role, status into v_role, v_status
  from public.profiles
  where id = v_user_id;

  if not found or v_role not in ('author', 'admin') or v_status <> 'active' then
    raise exception 'Active author access is required' using errcode = '42501';
  end if;

  if coalesce(p_bank_code, '') !~ '^\\d{2,10}$'
     or length(coalesce(p_bank_name, '')) not between 1 and 100
     or length(coalesce(p_account_name, '')) not between 1 and 160
     or length(coalesce(p_account_number_ciphertext, '')) = 0
     or length(coalesce(p_account_number_iv, '')) = 0
     or length(coalesce(p_account_number_tag, '')) = 0
     or coalesce(p_account_last4, '') !~ '^\\d{4}$' then
    raise exception 'Invalid verified payout account details';
  end if;

  insert into public.author_payout_accounts (
    author_id, bank_code, bank_name, account_name,
    account_number_ciphertext, account_number_iv, account_number_tag,
    account_last4, verified_at, updated_at
  ) values (
    v_user_id, p_bank_code, p_bank_name, p_account_name,
    p_account_number_ciphertext, p_account_number_iv, p_account_number_tag,
    p_account_last4, now(), now()
  )
  on conflict (author_id) do update set
    bank_code = excluded.bank_code,
    bank_name = excluded.bank_name,
    account_name = excluded.account_name,
    account_number_ciphertext = excluded.account_number_ciphertext,
    account_number_iv = excluded.account_number_iv,
    account_number_tag = excluded.account_number_tag,
    account_last4 = excluded.account_last4,
    verified_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.save_author_payout_account(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.save_author_payout_account(text, text, text, text, text, text, text) to authenticated;
