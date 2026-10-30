# Palixia payments and author earnings

## First release scope
The first monetisation release is reader tips only. Paid chapters, subscriptions, reader wallets and paid promotions are out of scope for this release.

## Author agreement and wallet
- Authors must accept the current Author Earnings Agreement before opening their wallet.
- Record author ID, agreement version and server-generated acceptance timestamp in an append-only acceptance table.
- Require renewed acceptance after material agreement changes.
- Show pending earnings, available accounting balance, total paid out and a transaction history.
- Clearly state that wallet balances are not withdrawable until an approved payout route is available.
- Authors may read only their own wallet entries. Financial ledger writes must be server-side only.
- The planned tip split is 90% to the author and 10% to Palixia. Final processing-fee treatment must be disclosed before tips launch.

## Payment flow and security
- Use Paystack Checkout with server-side transaction initialization.
- Never expose the Paystack secret key in browser code or a NEXT_PUBLIC_* environment variable.
- Verify every successful transaction server-side and verify webhook signatures.
- Treat webhooks as repeatable: enforce unique Paystack references and idempotent ledger posting.
- Keep an append-only financial ledger; never calculate balances from client-submitted amounts.
- Store amounts in kobo as integers and currency as NGN.
- Do not allow a client to mark a transaction paid, edit earnings, or request a transfer directly.

## Before live payments
1. Inspect the production Supabase schema; repository schema may be stale.
2. Obtain Paystack's written confirmation of the platform model and approved author payout route.
3. Finalise processing-fee treatment, minimum withdrawal, payout schedule and payout fees.
4. Review the Author Earnings Agreement, Terms, Privacy Policy and Refund Policy with qualified counsel.
5. Build and test payment initialization, verification, signed webhooks, idempotency, refunds and admin reconciliation.
6. Enable live collection only after legal, Paystack and production checks pass.

## Database safety
The migration in this branch is additive. Do not run a destructive schema reset. Apply and test it in staging before production.
