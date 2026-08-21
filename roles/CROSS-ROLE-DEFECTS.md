# Cross-role walkthrough defects

### [CRITICAL][C] Wallet retry idempotency is not durable
- Journey step: J10, retrying a wallet mutation after a network timeout.
- Expected / Actual: One retry key should result in one wallet mutation and one ledger entry. `Transaction` has no `idempotency_key` schema field, so `adjustBalance` cannot find or persist its claimed key.
- Where: `backend/services/wallet.service.js:62`; `backend/models/Transaction.model.js`.
- Root cause: The service's idempotency contract is not represented in the ledger schema and its claim sequence is non-atomic.
- User impact: A customer or vendor retrying on unstable 3G can receive or lose money more than once once callers adopt retry keys.
- Action: pending approval in `roles/CRITICAL-PENDING.md`.
- Related: all future retry-capable wallet mutations.
