-- Secure server-side Paystack webhook crediting and monthly author earnings release.
-- Keeps interactive/browser crediting admin-only while allowing the verified server webhook.
create or replace function public.post_verified_spark_purchase(
  p_reference text,
  p_amount_kobo bigint,
  p_currency text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.spark_purchases%rowtype;
  v_role text := coalesce(auth.role(), '');
  v_user_id uuid := auth.uid();
begin
  -- Service-role calls are reserved for the signed Paystack webhook server.
  -- Browser-authenticated calls must still belong to an active Palixia admin.
  if v_role = 'service_role' then
    null;
  elsif v_user_id is not null and exists (
    select 1 from public.profiles
    where id = v_user_id and role = 'admin' and status = 'active'
  ) then
    null;
  else
    raise exception 'Active Palixia admin or trusted server access required'
      using errcode = '42501';
  end if;

  select * into v_purchase
  from public.spark_purchases
  where paystack_reference = p_reference
  for update;

  if not found then raise exception 'Sparks purchase not found'; end if;
  if v_purchase.amount_kobo <> p_amount_kobo or v_purchase.currency <> p_currency then
    raise exception 'Verified payment does not match purchase';
  end if;
  if v_purchase.status = 'paid' then return false; end if;
  if v_purchase.status <> 'pending' then raise exception 'Purchase is not pending'; end if;

  update public.spark_purchases
  set status = 'paid', paid_at = now()
  where id = v_purchase.id;

  insert into public.reader_spark_ledger (
    reader_id, entry_type, sparks_amount, purchase_id, reference, description
  ) values (
    v_purchase.reader_id,
    'purchase_credit',
    v_purchase.sparks_amount,
    v_purchase.id,
    'purchase:' || v_purchase.paystack_reference,
    'Sparks purchase'
  );

  return true;
end;
$$;

revoke all on function public.post_verified_spark_purchase(text, bigint, text)
  from public, anon;
grant execute on function public.post_verified_spark_purchase(text, bigint, text)
  to authenticated, service_role;
alter function public.post_verified_spark_purchase(text, bigint, text) owner to postgres;

-- Admin-triggered monthly release: only pending author tip credits are released.
-- Platform fees and other ledger entries are never made withdrawable by this function.
create or replace function public.admin_release_pending_author_earnings(
  p_through timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count bigint := 0;
  v_amount_kobo bigint := 0;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  ) then
    raise exception 'Active administrator access required' using errcode = '42501';
  end if;

  if p_through is null or p_through > now() then
    raise exception 'Release cutoff must be a valid time not in the future';
  end if;

  with released as (
    update public.author_wallet_ledger
    set status = 'available'
    where entry_type = 'tip_credit'
      and status = 'pending'
      and created_at <= p_through
    returning amount_kobo
  )
  select count(*), coalesce(sum(amount_kobo), 0)
    into v_count, v_amount_kobo
  from released;

  return jsonb_build_object(
    'released_entries', v_count,
    'released_amount_kobo', v_amount_kobo,
    'released_through', p_through
  );
end;
$$;

revoke all on function public.admin_release_pending_author_earnings(timestamptz)
  from public, anon;
grant execute on function public.admin_release_pending_author_earnings(timestamptz)
  to authenticated;

notify pgrst, 'reload schema';
