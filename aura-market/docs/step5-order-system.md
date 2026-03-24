# Step 5 — Order System ✅

**Status:** Complete  
**Date Completed:** 2026-03-13

---

## Overview
This step implements the central transactional flow—the mapping of Customers purchasing items from Vendors. It guarantees exact inventory subtraction mapping, safe financial aggregation, and splits RESTful actions between the two core marketplace actors.

---

## Files Created / Modified

| File | Description |
|------|-------------|
| `backend/models/Order.model.js` | Connects the Customer `User` and `Vendor`. Natively nests `OrderItemSchema` to store static pricing at checkout, and outlines comprehensive enum options for Order Status (e.g. `placed`, `shipped`, `delivered`). |
| `backend/controllers/order.controller.js` | Houses cart-to-receipt processing. Deducts product stock dynamically, validates active properties over products, groups payloads smoothly, and returns tracking numbers. |
| `backend/routes/order.routes.js` | Strictly JWT protected endpoints. Segregates `getCustomerOrders` vs `getVendorOrders` based neatly on the User's Role. |
| `backend/server.js` | Endpoint mapping activated via `/api/orders`. |

---

## Technical Details

### 1. Atomic Order Processing & Subtotal Locks
If a user checks out, we loop their payload across the database via a **Mongoose Transaction (`session.startTransaction()`)**:
* **Availability Checks:** Prevents checkout if `product.status !== 'active'` or `product.stock < quantity`.
* **Stock Deductions:** Deducts `product.stock -= item.quantity;`. If there is a crash immediately thereafter, the changes are rolled back automatically. No lost inventory.
* **Pricing Freeze:** Saves the raw number value dynamically into `OrderItemSchema`. If the vendor changes the global product price next week, the receipt (order) still retains the historically accurate price.

### 2. Role-Based Routing Scopes
The `/api/orders/` endpoint utilizes advanced validation before answering requests:
* `GET /my-orders`: Exclusive to Customers.
* `GET /vendor-orders`: Exclusive to Vendors. Returns the arrays populated generously (e.g., retrieving the buyer's shipping payload or phone).
* `GET /:id`: A unified hook. Checks internally whether `req.user._id` aligns tightly to either `order.customer_id` OR if their Vendor profile matches `order.vendor_id` — else issues a 403 Forbidden.

### 3. Payment Status Links
The payment status logic natively expects properties like `wallet` and `escrow`. For now, they securely initialize into a `'pending'` status string while awaiting Step 6 (Wallet) and Step 7 (Escrow) processing tools.

---

## Next Step
👉 [Step 6 — Wallet System](./step6-wallet-system.md) (Expected next.)
