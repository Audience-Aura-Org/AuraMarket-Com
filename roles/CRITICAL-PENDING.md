# Critical fixes awaiting approval

## [CRITICAL][C] Wallet idempotency key is neither persisted nor claimed atomically

- Journey: J10 (connectivity collapse) / a customer retries a wallet credit after a timeout.
- Expected / actual: The retry key must identify one and only one balance mutation. `adjustBalance()` queries `Transaction` for `idempotency_key` and attempts to write that field, but `TransactionSchema` declares no such field or unique index. Under Mongoose strict mode the field is discarded, so every later lookup returns no match. Even after adding the field, the current read-then-increment-then-create sequence would still allow two concurrent retries to both increment the wallet before one transaction-record insert loses a unique-key race.
- Where: `backend/services/wallet.service.js:62-67, 95-105`; `backend/models/Transaction.model.js`.
- Root cause: An idempotency protocol was added in the service without a persistent, unique, atomically claimed database representation.
- User impact: A dropped mobile-data connection can turn one retried wallet operation into multiple credits/debits, corrupting the customer balance and ledger.
- Action: pending approval; no money-path code changed.
- Related: Any caller that begins to supply `meta.idempotency_key`; this is currently a latent critical defect because no production caller passes that key yet.

### Proposed diff

1. Add `idempotency_key` to `TransactionSchema` and a partial unique index for non-null keys.
2. Change `adjustBalance()` to require an existing MongoDB transaction when an idempotency key is supplied. Create a pending transaction record with the key **before** the guarded `$inc`; a duplicate-key error returns the first completed transaction without applying the `$inc` again. Mark it completed only after the balance update succeeds.
3. Ensure callers that use a retry key execute `adjustBalance()` inside `session.withTransaction()`, so any failed balance update or audit write rolls the initial claim back.
4. Add concurrent retry tests: two calls with the same key must produce one balance change and one ledger entry; a failed transaction must leave neither.

### Risk

Applying this is a financial-state and response-behaviour change requiring careful rollout and index creation. Not applying it leaves any future retry-enabled wallet operation unsafe.
