-- Author-initiated withdrawal requests. No bank transfers are initiated here.
create unique index if not exists author_one_open_withdrawal_idx
  on public.author_withdrawal_requests(author_id)
  where status in ('requested','under_review','approved');

create or replace function public.request_author_withdrawal(p_amount_kobo bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_available bigint;
  v_request public.author_withdrawal_requests%rowtype;
begin
  if v_user is null then
    raise exception 'Please sign in to request a withdrawal' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = v_user for update;
  if not found or v_profile.status <> 'active' or v_profile.role not in ('author','admin') then
    raise exception 'Active author access is required' using errcode = '42501';
  end if;

  if p_amount_kobo is null or p_amount_kobo < 100000 then
    raise exception 'The minimum withdrawal amount is ₦1,000';
  end if;
  if p_amount_kobo > 100000000 then
    raise exception 'The requested amount is above the current limit';
  end if;

  if not exists (select 1 from public.author_payout_accounts where author_id = v_user and verified_at is not null) then
    raise exception 'Verify and save a bank account before requesting a withdrawal';
  end if;

  if exists (
    select 1 from public.author_withdrawal_requests
    where author_id = v_user and status in ('requested','under_review','approved')
  ) then
    raise exception 'You already have an open withdrawal request';
  end if;

  select
    coalesce(sum(amount_kobo) filter (where entry_type = 'tip_credit' and status = 'available'),0)
    - coalesce(sum(amount_kobo) filter (where entry_type = 'payout' and status = 'paid'),0)
    into v_available
  from public.author_wallet_ledger
  where author_id = v_user;

  if p_amount_kobo > greatest(v_available,0) then
    raise exception 'The requested amount exceeds your available earnings';
  end if;

  insert into public.author_withdrawal_requests(author_id, amount_kobo, currency, status)
  values (v_user, p_amount_kobo, 'NGN', 'requested')
  returning * into v_request;

  return jsonb_build_object(
    'id', v_request.id,
    'amount_kobo', v_request.amount_kobo,
    'currency', v_request.currency,
    'status', v_request.status,
    'requested_at', v_request.requested_at
  );
end;
$$;

revoke all on function public.request_author_withdrawal(bigint) from public, anon;
grant execute on function public.request_author_withdrawal(bigint) to authenticated;
