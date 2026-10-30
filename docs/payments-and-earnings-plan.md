# Palixia payments and author earnings

## Scope

Build payments in stages. The first release should support reader tips and paid book promotions. Do not launch paid chapters, subscriptions, a reader wallet, or author cash-outs until the payment model and payout route are approved by Paystack and reviewed for applicable Nigerian requirements.

## Author dashboard

Extend the existing authenticated author dashboard at `/dashboard`; do not create a separate account system. Add an Earnings area with:

- Gross tips received, Palixia fees, and net author earnings.
- A transaction history showing date, reference, amount, status, and related book/author.
- Pending, available, reversed/refunded, and paid-out totals, clearly distinguished.
- A payout profile/status area only after an approved payout method is available.
- A clear notice that earnings are not withdrawable until Palixia's payout process is approved and enabled.

Authors must only see their own earnings and transactions. Admins need a separate reconciliation view.

## Payment flow and security

- Use Paystack Checkout with server-side transaction initialization.
- Never expose the Paystack secret key in browser code or a `NEXT_PUBLIC_*` environment variable.
- Verify every successful transaction server-side and verify webhook signatures.
- Treat webhooks as repeatable: enforce unique Paystack references and idempotent ledger posting.
- Keep an append-only financial ledger; never calculate balances from client-submitted amounts.
- Store amounts in kobo as integers, currency as NGN, and record the gross amount, provider fee, Palixia fee, author share, and any refund/reversal as separate fields or ledger entries.
- Verify payment status from Paystack before granting a paid benefit.
- Do not allow a client to mark a transaction paid, edit earnings, or request a transfer directly.
- Add audit records for administrative adjustments and refunds.

## Commercial decisions that must be confirmed before live payments

1. Author-tip commission: 10% to Palixia and 90% to the author, before any separately agreed treatment of Paystack processing fees.
2. Whether Paystack processing fees are absorbed by Palixia or deducted before calculating the author share.
3. Minimum payout amount, payout schedule, and payout fees.
4. Whether Paystack approves this marketplace/platform model and what account type or transfer/split-payment arrangement is required.
5. Refund, chargeback, fraud, and disputed-payment handling.
6. Whether promotions are paid to Palixia only (recommended for the first release).

No author withdrawal button or promise of a payout date should be enabled until the payout route is approved and tested.

## Legal documents to update before enabling payment

Review and update the existing Terms of Service and Privacy Policy; do not discard them and start from zero. Add a separate Creator/Author Earnings Agreement and a clear Refund & Cancellation Policy. These must accurately describe the final fee split, payment timing, eligibility, taxes, refunds, chargebacks, account closure, content removal, and data shared with Paystack. Obtain legal review for Nigerian law and any other markets served.

## Implementation sequence

1. Inspect the production schema and current deployed app before writing migrations. The repository schema may not match the live Supabase project.
2. Agree the commercial rules and obtain Paystack's written confirmation of the intended flow.
3. Add additive Supabase migrations for payment records, webhook event deduplication, ledger entries, and admin audit history. Use RLS so authors can read only their own records; financial writes must be server-side only.
4. Add server-only Paystack initialization, verification, and webhook endpoints.
5. Add the Earnings area to the existing author dashboard and an admin reconciliation view.
6. Test success, failure, duplicate webhook, delayed webhook, refund, chargeback, unauthorized access, and amount-tampering cases using test credentials.
7. Enable live collection only after legal, Paystack, and production checks pass.

## Important deployment note

This plan is not permission to run a destructive schema reset or to replace the existing production database. All database changes must be additive, reviewed, and tested against a copy/staging project first.
