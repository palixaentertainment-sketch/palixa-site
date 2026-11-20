-- Re-open author withdrawal requests after Palixia's manual payout process is ready.
-- The withdrawal RPC still validates author status, minimum amount, verified bank details,
-- available balance and outstanding reservations. This enables request submission only;
-- no bank transfer is initiated by this function.
grant execute on function public.author_request_withdrawal(bigint) to authenticated;
