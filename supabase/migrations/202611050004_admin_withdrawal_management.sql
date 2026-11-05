-- Admin-only withdrawal review and manual payout recording.
-- No bank details or automatic transfers are handled by these functions.

create or replace function public.admin_list_withdrawal_requests()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ) then
    raise exception 'Active administrator access required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.requested_at desc), '[]'::jsonb)
    into v_result
  from (
    select w.id, w.author_id, w.amount_kobo, w.currency, w.status,
           w.admin_note, w.payout_reference, w.requested_at, w.reviewed_at, w.paid_at
    from public.author_withdrawal_requests w
    order by w.requested_at desc
    limit 200
  ) r;
  return v_result;
end;
$$;

create or replace function public.admin_manage_withdrawal(
  p_request_id uuid,
  p_action text,
  p_admin_note text default null,
  p_payout_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.author_withdrawal_requests%rowtype;
  v_available bigint;
  v_reserved bigint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  ) then
    raise exception 'Active administrator access required' using errcode = '42501';
  end if;

  if p_action not in ('start_review','approve','reject','mark_paid') then
    raise exception 'Invalid withdrawal action';
  end if;

  select * into v_request
  from public.author_withdrawal_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Withdrawal request not found'; end if;

  -- Serialize all reservations and payouts for this author.
  perform 1 from public.profiles where id = v_request.author_id for update;

  if p_action = 'start_review' then
    if v_request.status <> 'requested' then raise exception 'Only requested withdrawals can enter review'; end if;
    update public.author_withdrawal_requests
      set status = 'under_review', reviewed_at = now(),
          admin_note = nullif(trim(coalesce(p_admin_note,'')), '')
      where id = p_request_id returning * into v_request;

  elsif p_action = 'approve' then
    if v_request.status not in ('requested','under_review') then raise exception 'Only requested or under-review withdrawals can be approved'; end if;

    select coalesce(sum(amount_kobo),0) into v_available
    from public.author_wallet_ledger
    where author_id = v_request.author_id and entry_type = 'tip_credit' and status = 'available';

    select coalesce(sum(amount_kobo),0) into v_reserved
    from public.author_withdrawal_requests
    where author_id = v_request.author_id and status = 'approved' and id <> p_request_id;

    if v_available - v_reserved < v_request.amount_kobo then
      raise exception 'Insufficient available author earnings for this withdrawal';
    end if;

    update public.author_withdrawal_requests
      set status = 'approved', reviewed_at = now(),
          admin_note = nullif(trim(coalesce(p_admin_note,'')), '')
      where id = p_request_id returning * into v_request;

  elsif p_action = 'reject' then
    if v_request.status not in ('requested','under_review','approved') then raise exception 'This withdrawal cannot be rejected'; end if;
    if nullif(trim(coalesce(p_admin_note,'')), '') is null then
      raise exception 'Add a reason when rejecting a withdrawal';
    end if;
    update public.author_withdrawal_requests
      set status = 'rejected', reviewed_at = now(), admin_note = trim(p_admin_note)
      where id = p_request_id returning * into v_request;

  elsif p_action = 'mark_paid' then
    if v_request.status <> 'approved' then raise exception 'Only approved withdrawals can be marked paid'; end if;
    if nullif(trim(coalesce(p_payout_reference,'')), '') is null then
      raise exception 'Enter the manual transfer reference before marking paid';
    end if;

    select coalesce(sum(amount_kobo),0) into v_available
    from public.author_wallet_ledger
    where author_id = v_request.author_id and entry_type = 'tip_credit' and status = 'available';

    select coalesce(sum(amount_kobo),0) into v_reserved
    from public.author_withdrawal_requests
    where author_id = v_request.author_id and status = 'approved';

    if v_available < v_reserved then
      raise exception 'Available earnings no longer cover approved withdrawals';
    end if;

    insert into public.author_wallet_ledger
      (author_id, entry_type, status, amount_kobo, currency, reference, description)
    values
      (v_request.author_id, 'payout', 'paid', v_request.amount_kobo, 'NGN',
       'PLXPAYOUT_' || replace(p_request_id::text,'-',''),
       'Manual withdrawal payout recorded by Palixia admin');


    update public.author_withdrawal_requests
      set status = 'paid', paid_at = now(), reviewed_at = coalesce(reviewed_at, now()),
          payout_reference = trim(p_payout_reference),
          admin_note = coalesce(nullif(trim(coalesce(p_admin_note,'')), ''), admin_note)
      where id = p_request_id returning * into v_request;
  end if;

  return to_jsonb(v_request);
end;
$$;

revoke all on function public.admin_list_withdrawal_requests() from public, anon;
revoke all on function public.admin_manage_withdrawal(uuid,text,text,text) from public, anon;
grant execute on function public.admin_list_withdrawal_requests() to authenticated;
grant execute on function public.admin_manage_withdrawal(uuid,text,text,text) to authenticated;
