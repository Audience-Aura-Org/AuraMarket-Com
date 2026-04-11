# Step 6 — Wallet System ✅

**Status:** Complete  
**Date Completed:** 2026-03-13

---

## Overview
This step constructs a rigid financial ledger system mapping deposits, withdrawals, and direct vendor payments. All operations are backed by standard ACID rules (Atomicity, Consistency, Isolation, Durability) to eliminate race conditions (like a "double-spend").

---

## Files Created / Modified

| File | Description |
|------|-------------|
| `backend/models/Transaction.model.js` | Core logging schema holding the `type` (`deposit`, `withdrawal`, `payment`, `escrow_release`). Links directly dynamically to a `User` (and an `Order` if applicable). |
| `backend/controllers/wallet.controller.js` | Handlers simulating deposits, locking withdrawal balances awaiting payout (`pending`), processing order checkouts from Wallet balances smoothly, and an exclusively mapped Admin route rejecting/approving transfers natively. |
| `backend/routes/wallet.routes.js` | Clean REST paths protected intrinsically by our `auth.middleware.js` framework bounds. |
| `backend/server.js` | Endpoint mapping activated: `/api/wallet` |

---

## Technical Details 

### 1. Zero-Trust Withdrawal Processing (Double-Spend Protection)
When a user requests a withdrawal via `/api/wallet/withdraw` (e.g., cashing out 10,000 XAF to Mobile Money), we do not leave that balance floating in their wallet while awaiting the admin's approval.
We **subtract** the amount instantly via Mongoose Transactions and mark the `Transaction.status` to `'pending'`. 
* If the `Admin` accesses `/admin/withdrawals/:id` + `{ "action": "approve" }`, it triggers the real-world Flutterwave payout.
* If the `Admin` issues `{ "action": "reject" }`, the database retrieves the 10,000 XAF natively from the transaction payload and **refunds** the user's wallet automatically intact.

### 2. Direct Order Linkage
The `payOrderWithWallet` endpoint completes Step 5's promise. It deducts the buyer's balance, converts the order `payment_status` to `'paid'`, seamlessly pushes the `order_status` to `'processing'`, and creates a fully transparent receipt via the `Transaction` schema.

---

## Next Step
👉 [Step 7 — Escrow System](./step7-escrow-system.md) (Expected next.)
