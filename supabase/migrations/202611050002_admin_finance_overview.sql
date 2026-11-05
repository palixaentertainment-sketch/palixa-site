-- Read-only financial overview for active Palixia administrators.
-- Does not expose payout destinations or provide any mutation operations.

create or replace function public.admin_finance_overview()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
  ) then
    raise exception 'Active administrator access required'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'purchases', jsonb_build_object(
      'paid_count', (select count(*) from public.spark_purchases where status = 'paid'),
      'paid_amount_kobo', (select coalesce(sum(amount_kobo), 0) from public.spark_purchases where status = 'paid'),
      'sparks_sold', (select coalesce(sum(sparks_amount), 0) from public.spark_purchases where status = 'paid'),
      'pending_count', (select count(*) from public.spark_purchases where status = 'pending'),
      'failed_count', (select count(*) from public.spark_purchases where status = 'failed'),
      'refunded_count', (select count(*) from public.spark_purchases where status = 'refunded')
    ),
    'reader_wallets', jsonb_build_object(
      'total_outstanding_sparks', (select coalesce(sum(sparks_balance), 0) from public.reader_spark_balances),
      'wallet_count', (select count(*) from public.reader_spark_balances where sparks_balance > 0)
    ),
    'author_earnings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entry_type', grouped.entry_type,
        'status', grouped.status,
        'entry_count', grouped.entry_count,
        'amount_kobo', grouped.amount_kobo
      ) order by grouped.entry_type, grouped.status)
      from (
        select entry_type, status, count(*) as entry_count,
               coalesce(sum(amount_kobo), 0) as amount_kobo
        from public.author_wallet_ledger
        group by entry_type, status
      ) grouped
    ), '[]'::jsonb),
    'withdrawals', jsonb_build_object(
      'requested_count', (select count(*) from public.author_withdrawal_requests where status = 'requested'),
      'under_review_count', (select count(*) from public.author_withdrawal_requests where status = 'under_review'),
      'approved_count', (select count(*) from public.author_withdrawal_requests where status = 'approved'),
      'rejected_count', (select count(*) from public.author_withdrawal_requests where status = 'rejected'),
      'paid_count', (select count(*) from public.author_withdrawal_requests where status = 'paid'),
      'cancelled_count', (select count(*) from public.author_withdrawal_requests where status = 'cancelled'),
      'requested_amount_kobo', (select coalesce(sum(amount_kobo), 0) from public.author_withdrawal_requests where status in ('requested','under_review','approved'))
    ),
    'recent_purchases', coalesce((
      select jsonb_agg(to_jsonb(recent))
      from (
        select id, reader_id, sparks_amount, amount_kobo, currency, status, created_at, paid_at
        from public.spark_purchases
        order by created_at desc
        limit 10
      ) recent
    ), '[]'::jsonb),
    'recent_author_entries', coalesce((
      select jsonb_agg(to_jsonb(recent))
      from (
        select id, author_id, entry_type, status, amount_kobo, currency, reference, created_at
        from public.author_wallet_ledger
        order by created_at desc
        limit 10
      ) recent
    ), '[]'::jsonb),
    'recent_withdrawals', coalesce((
      select jsonb_agg(to_jsonb(recent))
      from (
        select id, author_id, amount_kobo, currency, status, requested_at, reviewed_at, paid_at
        from public.author_withdrawal_requests
        order by requested_at desc
        limit 10
      ) recent
    ), '[]'::jsonb),
    'generated_at', now()
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_finance_overview() from public, anon;
grant execute on function public.admin_finance_overview() to authenticated;
