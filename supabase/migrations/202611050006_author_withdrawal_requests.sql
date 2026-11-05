-- Secure author-initiated withdrawal requests. No transfer is initiated here.
create or replace function public.author_request_withdrawal(p_amount_kobo bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_status text;
  v_available bigint;
  v_reserved bigint;
  v_request public.author_withdrawal_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Please sign in to request a withdrawal' using errcode = '42501';
  end if;

  select role, status into v_role, v_status
  from public.profiles where id = v_user_id for update;

  if not found or v_role not in ('author','admin') or v_status <> 'active' then
    raise exception 'Active author access is required' using errcode = '42501';
  end if;

  if p_amount_kobo is null or p_amount_kobo < 100000 then
    raise exception 'The minimum withdrawal request is ₦1,000';
  end if;

  if not exists (
    select 1 from public.author_payout_accounts
    where author_id = v_user_id and verified_at is not null
  ) then
    raise exception 'Verify and save a payout bank account before requesting a withdrawal';
  end if;

  select
    coalesce(sum(amount_kobo) filter (where entry_type = 'tip_credit' and status = 'available'),0)
    - coalesce(sum(amount_kobo) filter (where entry_type = 'payout' and status = 'paid'),0)
    into v_available
  from public.author_wallet_ledger
  where author_id = v_user_id;

  select coalesce(sum(amount_kobo),0) into v_reserved
  from public.author_withdrawal_requests
  where author_id = v_user_id and status in ('requested','under_review','approved');

  if p_amount_kobo > greatest(v_available - v_reserved, 0) then
    raise exception 'Your available earnings are not enough for this withdrawal';
  end if;

  insert into public.author_withdrawal_requests(author_id, amount_kobo, currency, status)
  values (v_user_id, p_amount_kobo, 'NGN', 'requested')
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

revoke all on function public.author_request_withdrawal(bigint) from public, anon;
grant execute on function public.author_request_withdrawal(bigint) to authenticated;
