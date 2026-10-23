# Withdrawal automation, deposit alerts and escrow reconciliation

## Automatic approval

The admin Withdrawals page now has an automatic PawaPay approval switch, disabled by default. Only administrators can read/change the policy through `/withdrawals/admin/automation` (GET/PATCH). Changing the policy and writing its audit record commit together.

Enabling generates a new server activation timestamp and epoch. Only validated MTN Cameroon/XAF/MoMo requests created after that timestamp and stamped with that epoch during submission can be automatically approved. Orange (including 655–659), unknown and foreign numbers stay manual. Existing requests have no eligible stamp. Disabling and enabling again creates a new epoch, so the previous queue remains manual; repeated enables while already on preserve the original timestamp.

Approval uses a database-backed queue: submission triggers an immediate pass; a 15-second worker resumes pending work after restarts. There is no browser-driven approval loop. Every approval rechecks the current policy, maintenance mode, active owner, reserved balance and matching pending ledger owner/amount/currency. Requests requiring manual attention leave the automatic queue rather than blocking later requests.

A claim, provider UUID, pending withdrawal ledger link and audit record are committed before contacting PawaPay. Manual PawaPay approval uses the same path. Other manual gateways acquire the same withdrawal document lock before any external call. This prevents simultaneous manual/automatic payouts through different gateways. Accepted payouts remain approved/pending until a signed callback or status query confirms their outcome. Definite rejection restores the reserved balance exactly once. Network timeouts/5xx remain uncertain and do not trigger a duplicate payout or premature refund. Confirmed NOT_FOUND after the initial submission window is reconciled as failed and refunded. Status checks rotate through outstanding requests, including after the approval switch is off.

Provider reference/status handling follows [PawaPay's payout guide](https://docs.pawapay.io/v2/docs/payouts). Phone prefix boundary reference: [DusuPay's operator-prefix documentation](https://developer.dusupay.com/utility-functions/mobile-money-operator-prefixes). No real payout was initiated to verify the feature. The production policy remains **off**; enabling it in the UI is a deliberate administrator action.

## User deposit alert

The insufficient-funds notification applies to a user's deposit from their own mobile-money account. Initialization, signed callbacks, verification and rechecks now retain failure codes/messages. A confirmed insufficient-balance response produces a clear **Insufficient funds** result with advice to top up the mobile-money balance and an explicit statement that the Auradime wallet was not credited.

The modal listens for its own reference's live `payment_status` failure event, stops polling on that event and displays an accessible alert. Polling remains a fallback. Errors from other references are ignored. A definite declined deposit is no longer mislabeled as a timeout. Uncertain network failures remain pending; the wallet is credited only on confirmed settlement. The artificial 1.5-second initiation delay was removed. Verification also now enforces transaction ownership and a failed callback cannot downgrade an already completed deposit.

## Orphan removed at the operator's request

The operator explicitly requested removal rather than a buyer refund. On 2026-10-23 the orphaned 100 XAF escrow `6a7b3d8a34044c2e4684a051` was archived transactionally and removed from the active `escrows` collection. Its original order and vendor were verified absent and its original completed buyer payment was verified present. The pending vendor payout was changed to failed/cancelled with an archive link. The original payment was retained. **No wallet transfer, refund or payout was performed.** The archive retains the complete prior escrow and transaction snapshots, original amount, timestamp and operator-request provenance; this removal is not presented as a successful vendor payout.

Read-back confirmed: active orphan absent, archive present, pending payout failed; remaining escrow records were three released (71,500 XAF total) and one refunded (500 XAF), with no held records at verification time. The script `backend/scripts/archive-orphan-escrow.js` defaults to a dry run, targets this specific record, refuses records whose originals still exist, and is idempotent after archival.

To prevent the application's account-deletion paths from creating more missing financial references, self-delete, administrative delete and bulk delete now reject accounts linked to escrow records or unsettled withdrawals before removing data. Deactivation remains available. Escrow funding rejects an absent vendor/wallet before debiting the buyer. Direct database edits outside the application remain subject to operational access controls and backups.

## Mobile withdrawal review

The mobile financial table now reserves a wider Actions column and a minimum 88×56 CSS-pixel View target. The browser check confirmed at least a 44-pixel physical height at the app's mobile zoom. The button opens the existing payout review without squeezing the other columns; horizontal scrolling remains contained in the table.

## Verification

- Existing withdrawal integration: 16 checks passed.
- Escrow lifecycle integration: 14 checks passed after adding the funding guard.
- Financial recording, signed webhooks, deposit failures and escrow removal: 4 files, 39 checks passed.
- Final automation integration: 16 checks passed, covering activation/epoch boundaries, existing requests, Orange and invalid numbers, persisted pre-provider references, concurrent approvals, cross-gateway races, rejected/uncertain payouts, durable queue recovery and mismatched ledger protection.
- Deposit modal and payment polling unit tests: 2 files, 5 checks passed, including live-reference filtering and no success callback on insufficient funds.
- Browser fixtures passed switch on/off, historical rows remaining pending, mobile View target/review, immediate user deposit failure, no false timeout/credit and no runtime/page-overflow errors. All browser writes were intercepted.
- Optimized Next.js production build and browser checks passed after removal of the artificial initiation delay.

Tests use an isolated database and mocked providers. Live callbacks/device behavior and the outstanding production items in `production-readiness-2026-10-23.md` still require deployment verification.
