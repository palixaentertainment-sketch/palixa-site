-- Keep author-initiated withdrawals closed until Palixia explicitly launches payouts.
-- This revokes direct RPC access as well as preventing use through the website UI.
-- Admin review and manual payout functions remain separately permissioned and unchanged.

revoke all on function public.author_request_withdrawal(bigint)
  from public, anon, authenticated;
