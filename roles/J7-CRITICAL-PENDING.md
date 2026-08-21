# Critical fix awaiting approval — J7 dispute vs. auto-release race

## [CRITICAL][C] A dispute can be opened after escrow has been released

- Journey: J7 — rider marks delivered while the auto-release timer races with the customer opening a dispute.
- Expected / actual: Once escrow is released, a new dispute must be rejected; while a dispute is being opened, auto-release must not settle the escrow. `createDispute()` only checks ownership and the absence of a prior dispute. It does not check the escrow status or protect the dispute/order transition with a transaction. The auto-release worker checks for a dispute first, then later finalizes payment. If auto-release commits first, `createDispute()` can create an active dispute and overwrite the completed order state with `refund_pending` after the vendor has been paid.
- Where: `backend/controllers/dispute.controller.js:28-67`; `backend/services/escrowAutoRelease.service.js:29-99`.
- Root cause: Two competing state machines mutate the same order without a shared, atomic escrow claim/state transition.
- User impact: A customer on poor connectivity can see a live dispute after funds have irreversibly been paid to the vendor; support receives an impossible case and may manually refund, creating a genuine double-payout risk.
- Action: pending approval; no money-path code changed.
- Related: manual customer escrow release and admin dispute resolution.

### Proposed diff

1. Make dispute creation transactional. Read the order and escrow in the transaction, require escrow status `held`/`pending_release`, and atomically claim the escrow as `disputed` before creating the `Dispute` and changing the order state.
2. In auto-release, atomically transition the escrow from `held`/`pending_release` to `releasing` before any payout and only complete it from that claimed state.
3. Reject a dispute for an already released/refunded escrow with a clear response; add a unique partial index preventing more than one active dispute per order.
4. Add a concurrent J7 integration test proving the sole terminal outcome is either `disputed` (no payout) or `released` (dispute request rejected), never both.

### Risk

This coordinates escrow, order, and dispute transactions and changes customer-visible error behaviour. Not applying it leaves a support-triggered double-settlement path at the delivery/dispute seam.
