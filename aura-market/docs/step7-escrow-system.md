# Step 7 — Escrow System ✅

**Status:** Complete  
**Date Completed:** 2026-03-13

---

## Overview
This step implements the crucial middleman layer protecting both the buyer and the seller. The Escrow module acts as a vault where funds sit neutrally until conditions are met (e.g. delivery is confirmed) or the deal is cancelled.

---

## Files Created / Modified

| File | Description |
|------|-------------|
| `backend/models/Escrow.model.js` | Associates an Order to a vault entry mapping clearly to `{ status: 'held', 'released', 'refunded' }`. |
| `backend/controllers/escrow.controller.js` | Handlers simulating the complex atomicity required. Specifically covers `holdFunds`, `releaseFunds`, and `refundFunds`. |
| `backend/routes/escrow.routes.js` | Protects vaults accurately binding endpoint scopes distinctly via `restrictTo('customer', 'admin', 'vendor')`. |
| `backend/server.js` | Exposed module on `/api/escrow`. |

---

## Technical Details 

### 1. Zero Trust State Flow
The Escrow acts as a 3-way handshake utilizing strict Mongoose Atomicity protocols (`session.startTransaction()`). Any error thrown instantly reverts the wallet states back seamlessly to neutral.
*   `holdFunds`: Submits the customer's wallet balance directly into `Aura Market` holding bounds. Order Payment sets to `paid` and Status upgrades automatically to `processing` indicating the vendor is clear to dispatch goods safely.
*   `releaseFunds`: Reverses the hold by depositing the escrow amount natively into the **Vendor's** wallet. Triggerable *only* by the customer explicitly acknowledging successful shipping delivery explicitly (or forcibly resolved via Admin scope). 
*   `refundFunds`: Discards the vault mappings backwards directly restoring the **Customer's** initial wallet expenditure comprehensively. Can be deployed natively by Vendors resolving disputes.

### 2. Deep Transaction Integrations
Every operation actively binds robust entries into the Step 6 `Transactions` log explicitly noting the `order_id`:
1. Customer initiates: Log reads `type: 'payment'` explicitly logging `Funds secured in Escrow...`
2. Vault Releases: Yields direct entry towards the receiving Vendor denoting `type: 'escrow_release'`.

---

## Next Step
👉 [Step 8 — Real-time Chat System](./step8-chat-system.md) (Expected next.)
