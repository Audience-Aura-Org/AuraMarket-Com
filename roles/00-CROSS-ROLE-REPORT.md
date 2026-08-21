# Cross-role walkthrough report

**Run date:** 2026-08-20

## Outcome

The walkthrough stopped under the supplied fix protocol after two critical money/state defects were found. No financial code was changed and no commits were made.

| Check | Result | Evidence |
|---|---|---|
| Existing backend test suite | Blocked | `npx vitest run` imports `server.js`, then exits because the local test environment lacks `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `PAYUNIT_WEBHOOK_SECRET`; no assertions execute. |
| Production frontend build | Passed | `npm.cmd run build` in `web/` completed successfully. |
| Backend money/state module syntax | Passed | `node --check` completed for order, payment, escrow, wallet, settlement, food-timeout, auto-release, and transaction-model modules. |
| J7: dispute vs. escrow auto-release | Critical defect | `createDispute` can create an active dispute and set `refund_pending` without checking/claiming the escrow after auto-release has paid the vendor. See `J7-CRITICAL-PENDING.md`. |
| J10: retry idempotency | Critical defect | `adjustBalance` uses a nonexistent, non-unique `Transaction.idempotency_key`; its protocol is neither durable nor atomic. See `CRITICAL-PENDING.md`. |

## State table — J7 (static walkthrough)

| Event ordering | Customer/order view | Escrow | Vendor balance | Result |
|---|---|---|---|---|
| Dispute commits before auto-release check | `refund_pending` / dispute pending | held | unchanged | Auto-release observes active dispute and stops. |
| Auto-release commits before dispute starts | completed | released | credited | A later dispute must be rejected, but current code permits it. |
| Auto-release passes its check while dispute begins | timing-dependent | timing-dependent | timing-dependent | No shared claim; invariant is not provable. |

## What prevents an end-to-end completion

The repository does not include a disposable integration environment with a MongoDB replica set, real-or-fake role fixtures, controllable worker triggers, webhook simulator, socket clients, or state-table assertions. The only committed test is a placeholder health-check test and it cannot import the application without booting production side effects. This is logged in `GAPS.md`.

Per the supplied protocol, the identified defects touch escrow and money. Their proposed changes are pending approval before implementation or further state-mutating role runs.
