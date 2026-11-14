-- Harden Sparks tip idempotency after the original terms migration.
-- This is a new migration so environments that already applied the earlier
-- migration receive the fix. Public tipping remains admin-only during testing.
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

  if found then
    select * into v_existing_author
    from public.author_wallet_ledger
    where reference = p_reference and entry_type = 'tip_credit';

    select * into v_existing_fee
    from public.author_wallet_ledger
    where reference = p_reference || '_PLATFORM_FEE' and entry_type = 'platform_fee';

    v_total_kobo := p_sparks::bigint * 100;
    v_author_kobo := (v_total_kobo * 90) / 100;
    v_platform_kobo := v_total_kobo - v_author_kobo;

    if v_existing_reader.reader_id <> v_reader_id
       or v_existing_reader.entry_type <> 'tip_debit'
       or v_existing_reader.sparks_amount <> p_sparks
       or v_existing_author.id is null
       or v_existing_author.author_id <> p_author_id
       or v_existing_author.amount_kobo <> v_author_kobo
       or v_existing_author.currency <> 'NGN'
       or v_existing_author.related_book_id is distinct from p_book_id
       or v_existing_author.status <> 'pending'
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
    when entry_type = 'tip_debit' then -sparks_amount
    else 0 end), 0)
    into v_balance
    from public.reader_spark_ledger
    where reader_id = v_reader_id;

  if v_balance < p_sparks then
    raise exception 'Insufficient Sparks balance' using errcode = '22023';
  end if;

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

notify pgrst, 'reload schema';
