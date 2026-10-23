# Payment audit - 23 October 2026

## Scope

Reviewed checkout, wallet top-ups and verification, vendor/logistics wallets, subscriptions, admin financial pages, gateway initialization and callbacks, settlement, wallet accounting, and audit storage. Gateway tests use isolated MongoDB replica sets and mocked provider requests. The existing database and eleven historical provider statuses were checked with read-only queries.

## Fixes

- Corrected the audit writer to use the database's `user_id`, `changes.old/new`, and `metadata` fields. Added financial reference details and wallet/subscription settlement audit records.
- Wallet credits/debits now record their actual before/after balances within the caller's database transaction.
- Payment intents are stored before outbound PayUnit, Eversend, direct PawaPay, and hosted PawaPay requests. PawaPay stores the net credit and collection fee before a callback can arrive.
- Ambiguous PawaPay timeouts retain a pending reference. Subscription payment records survive timeouts and provider rejection rather than being deleted.
- Replayed wallet adjustments return the original result even when MongoDB reports the reference index before the idempotency-key index; matching owner, amount, and type are checked.
- Payment return pages require gateway confirmation. Stopped polling ignores late responses; checkout polling is stopped on dismissal/unmount.
- Payment currency must match a subscription plan. XAF wallet collections cannot credit unrelated currency units without conversion.
- Eversend pending intents can be resumed, including subscription requests.
- Realtime connections follow an explicitly configured API origin and can fall back from WebSocket to polling. Repeated connection errors are summarized, and Next.js controls its own static-bundle caching.

## Existing records

The database scan covered the last 30 days for completed-payment consistency, and all collections pending longer than 24 hours:

| Check | Result |
| --- | ---: |
| Completed net amounts different from stored net metadata | 0 |
| Completed checkout payments with unpaid, non-refunded linked orders | 0 |
| Completed subscriptions without a linked activation | 0 |
| Non-XAF completed external wallet deposits | 0 |
| Negative wallet balances | 0 |
| Recent pending collections missing a provider identifier | 0 |
| Existing recent wallet audit records before these fixes | 0 |
| Collections pending longer than 24 hours | 11 |

All eleven older pending records are live-mode PawaPay records. Read-only GET lookups returned `NOT_FOUND` for all eleven under the currently configured provider account. This does not establish a confirmed payment or authorize a credit/refund; these records remain for reconciliation against provider history. Historical wallet audit entries were not fabricated or backfilled without reliable before/after evidence.

A completed payment on a refunded food order was reviewed and excluded from unpaid-order findings: its order and refund records agree.

## Verification

- Existing webhook, payment recheck, wallet-balance, withdrawal/retry, and subscription integration suites: 57 passing checks.
- Financial-recording regressions: 10 passing checks, including audit rollback, idempotent replay, pre-provider ledger writes, timeout retention, and currency manipulation rejection.
- Frontend payment polling, gateway recheck, socket configuration, and safe API retry tests: 14 passing checks.

These checks do not initiate real charges, payouts, or refunds. The reusable read-only scan is `backend/scripts/audit-payment-records.js`; `--provider-status` additionally performs provider GET lookups.

## Financial frontend follow-up

Payout History, Requests, Adjustment History, Ledger entries and Subscribers now use aligned tables with 20 records per page. Requests use server pagination and search; date ties use an ID tie-breaker to prevent repeated records between pages. Sidebar typography shares the manager rail's font family and scaled size.

Verification: production build passed; browser checks with mocked API fixtures passed for all five tables, 20/5 record pagination, record detail/management controls and desktop/mobile overflow containment. The withdrawal integration suite passed all 16 checks, including pagination across tied timestamps and searching an account before pagination. No financial mutations were made during the browser checks.

Browser typography checks also confirmed matching font family, size and letter spacing for manager, admin, vendor, logistics and customer sidebars.
