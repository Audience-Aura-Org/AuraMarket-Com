# Step 3 — Vendor & Store System ✅

**Status:** Complete  
**Date Completed:** 2026-03-13

---

## Overview
This step constructs the Vendor module, allowing a registered User (with a `'vendor'` role) to manage their specialized store. We separate the logical metrics (`Vendor`) from the visual aspects (`Store`), maintaining strict MVC principles while utilizing Mongoose Multi-Document Transactions to ensure database atomicity upon onboarding.

---

## Files Created / Modified

| File | Description |
|------|-------------|
| `backend/models/Vendor.model.js` | Contains vendor metrics (`user_id`, `rating`, `verified`, `subscription_plan`, `total_sales`) linked intimately to their user account. Virtuals bind the Store automatically when queried. |
| `backend/models/Store.model.js` | The UI layer data (`vendor_id`, `banner`, `logo`, `categories`, `followers`). |
| `backend/controllers/vendor.controller.js` | Handlers `onboardVendor` (transaction-based init of vendor/store), `getVendorProfile` (using virtuals natively), `updateStore`, and `getPublicStores`. |
| `backend/routes/vendor.routes.js` | Secure endpoint management. Exposes one `GET` route for marketplace discovery, while securing the rest natively via `restrictTo('vendor')`. |
| `backend/server.js` | Endpoint mapping activated: `/api/vendors` routing configuration logic mounted. |

---

## Technical Details

### 1. Model Relationship & Virtuals
* **Uniqueness:** Guaranteed. A `User` -> `1 Vendor` -> `1 Store`.
* **Mongoose Virtuals:** The `Vendor.model` hosts a virtual property `'store'` that resolves the `Store` schema natively when utilizing `.populate('store')`. Both Objects convert directly into JSON format dynamically at API runtime.

### 2. Transaction Flow (Onboarding)
Creating a robust system means avoiding orphaned database items on sudden crashes.
When a vendor is "onboarded", the server performs both:
1. `Vendor.create(...)`
2. `Store.create(...)`

These execute under Mongoose's `session.startTransaction()`. If the Store defaults out gracefully, the Vendor entity creation is reversed instantly, leaving nothing corrupt on your Atlas instance. 

### 3. Middleware Role-Guarding
Rather than writing repetitive checks per Controller, the `auth.middleware.js` built in step 2 cascades automatically under `vendor.routes.js`:

```javascript
router.use(protect);
router.use(restrictTo('vendor')); // Any route hereafter requires the vendor role
router.post('/onboard', onboardVendor);
```

---

## Verification
- ✅ **Schema Creation:** Successfully decoupled logic (Vendor metrics) vs front-end visualization (Store). 
- ✅ **API Mount:** Vendor Routes mapped via Central API instance in Server.
- ✅ Mongoose transactions operational to scale gracefully under server load dynamically.

---

## Next Step
👉 [Step 4 — Product System](./step4-product-system.md) (Expected next.)
