# Subscription audit - 2026-10-24

## Corrected behavior

- Plan discovery preserves the administrator's role requirements instead of forcing logistics subscriptions back on. Concurrent default seeding shares one in-flight task and existing defaults avoid repeated upserts. Partial requirement updates preserve omitted roles; grace-day metadata returns saved values. Existing explicit grace records remain supported; new accounts do not receive automatically fabricated grace records.
- Active entitlement checks enforce both start and expiry dates and require a real plan reference. Expired records are normalized in status/overview reads. Calendar-month and leap-year expiries clamp to the last valid day and explicit durations start from the supplied activation date. Invalid/inverted dates cannot silently become unlimited access.
- Wallet checkout serializes purchases on the account and rechecks active access within a retryable transaction, preventing double debit. External checkout atomically reserves one recent pending intent per account/plan across gateways. Resume responses retain the original provider and reference; return URLs are restricted to the configured site's verification page.
- Unknown initialization outcomes and rate limits retain pending payment records; definite failures retain failed records. PawaPay insufficient funds produce an explicit decline. Subscription failure notifications use subscription wording and links rather than claiming a wallet deposit failed.
- Purchased duration/currency/cycle are captured in payment metadata. Activation is transactional and idempotent by payment ID; a distinct confirmed same-plan payment extends existing dated access rather than discarding the payment. Manual grants record zero paid. Free plans activate without fabricating a positive ledger transaction. Fractional XAF prices are rejected so rounded wallet debits cannot differ from ledger amounts.
- Production subscription checkout rejects simulated provider configuration, and simulated transactions cannot activate production subscriptions.
- Refund actions now return a matched completed XAF subscription payment to Aura Wallet exactly once, write a refund ledger/audit record, update the balance notification, and subtract the refund from subscription/platform revenue. Provider collection fees are excluded. The UI explicitly says **Refund to wallet** and asks for confirmation. Missing payment evidence and unsupported currency cannot silently mint a refund. Refunded/expired subscriptions cannot be restored through the simple Activate action.
- Plans referenced by subscriptions or pending payments cannot be deleted; paid subscription history is retained. Missing owner/plan/payment evidence is exposed for review. Unreferenced plans and unpaid records retain their existing deletion behavior.
- Checkout waits for auth hydration, prevents repeated submission, ignores stale status responses, allows repurchase of inactive packages, and handles already-active/resumed responses with the correct gateway.

Renewal remains an explicit purchase: monthly/yearly billing cycles calculate access duration, not automatic recurring debits. Existing manager/admin access exemptions were preserved. This audit does not certify live mobile-money provider/device delivery; provider calls in automated tests were mocked.

## Database reconciliation

A read-only audit found 23 subscription records. Thirteen expired records were still labelled active. `backend/scripts/reconcile-subscription-expiry.js` corrected those labels transactionally, preserving full original snapshots in `subscriptionauditrecords` and adding history. No payment or wallet balance changed.

The operator confirmed that six historical admin activations showing 137,500 XAF paid were complimentary grants. `backend/scripts/reconcile-complimentary-subscriptions.js` targets only those six IDs and corrected `amount_paid` to zero, preserving each original record in the audit collection. No refund, wallet transfer or payment deletion occurred.

Read-back: 23 records; 6 cancelled, 14 expired, 3 active; zero expired records marked active; zero positive paid amounts without a linked transaction; 19 reconciliation audit records. One cancelled complimentary record references a deleted account and is retained as historical evidence. No missing plan references or duplicate current account/role subscriptions were found in the initial audit.

Both maintenance scripts default to dry run and were verified idempotent after application.

## Verification

- Existing subscription, financial-recording and deposit-failure integration suites plus the audit regressions passed together: four files, 59 checks.
- The expanded audit suite passed 21 checks, including fractional-price protection. Final focused checks also passed payment-ownership isolation and fractional-price rejection.
- Four date/return-URL unit checks and four subscription checkout frontend checks passed.
- Optimized Next.js production build and whitespace checks passed.
- Tests used an isolated replica set and mocked external providers. No live provider charge or refund was initiated by this audit.
