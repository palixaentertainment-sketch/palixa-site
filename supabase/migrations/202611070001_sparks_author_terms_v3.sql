-- Apply the 90/10 Sparks split to new tips only.
-- Existing ledger entries are intentionally left unchanged.
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
  v_existing uuid;
  v_total_kobo bigint;
  v_author_kobo bigint;
  v_platform_kobo bigint;
begin
  -- Keep the existing admin-only test gate. Public tipping is not enabled.
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

  -- Serialize concurrent spends from the same reader.
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

  -- Require acceptance of the revised 90/10 earnings terms.
  if not exists (
    select 1 from public.author_earnings_agreements
    where author_id = p_author_id and agreement_version = 'sparks-v3-monthly-payouts'
  ) then
    raise exception 'The author has not accepted the updated 90/10 Sparks earnings agreement';
  end if;

  select id into v_existing from public.reader_spark_ledger where reference = p_reference;
  if v_existing is not null then
    return jsonb_build_object('success', true, 'already_processed', true);
  end if;

  select coalesce(sum(case
    when entry_type in ('purchase_credit','refund_credit','adjustment') then sparks_amount
    when entry_type = 'tip_debit' then -sparks_amount
    else 0 end), 0)
    into v_balance
    from public.reader_spark_ledger
    where reader_id = v_reader_id;

  if v_balance < p_sparks then
    raise exception 'Insufficient Sparks balance' using errcode = '22023';
  end if;

  -- One Spark is valued at ₦1. The split is calculated in kobo to avoid
  -- floating-point arithmetic; any rounding remainder goes to Palixia.
  v_total_kobo := p_sparks::bigint * 100;
  v_author_kobo := (v_total_kobo * 90) / 100;
  v_platform_kobo := v_total_kobo - v_author_kobo;

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
