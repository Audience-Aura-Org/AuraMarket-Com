# J7 defect

### [CRITICAL][C] Auto-release and dispute creation do not share a state claim
- Journey step: J7, customer disputes as delivery-based auto-release runs.
- Expected / Actual: Opening a dispute freezes escrow before any payout, or a released escrow rejects the dispute. `createDispute` creates a dispute then sets `order_status = 'refund_pending'` without checking/claiming escrow; auto-release separately checks for a dispute and pays later.
- Where: `backend/controllers/dispute.controller.js:28-67`; `backend/services/escrowAutoRelease.service.js:29-99`.
- Root cause: Escrow, dispute, and order transitions have no shared atomic state transition.
- User impact: A customer can be shown an active dispute although the vendor has been paid, creating an unresolvable support path and manual-refund pressure.
- Action: pending approval in `roles/J7-CRITICAL-PENDING.md`.
- Related: manual release and admin dispute resolution.
