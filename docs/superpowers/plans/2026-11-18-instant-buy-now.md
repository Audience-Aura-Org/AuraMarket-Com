# Instant Buy Now Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buy Now opens a Mobile Money popup. Guests and signed-in users pay first, then
give or confirm delivery details, reusing the existing order, payment, escrow and
dispatch code.

**Architecture:** Guests get a hidden `is_guest` customer account and a separate 90-day
token that only the popup sends. Orders created by the popup carry
`delivery_details_status: 'pending'`. Settlement holds rider dispatch through the
existing delayed-dispatch worker until details arrive, or for 30 minutes. The web
popup is a lazy-loaded sheet behind the `instant_buy` feature flag.

**Tech Stack:** Express + Mongoose, Vitest + supertest (backend, `npx vitest run`);
Next.js 16 + React, Vitest + Testing Library (web, `npx vitest run`).

**Spec:** `docs/superpowers/specs/2026-11-18-instant-buy-now-design.md`

## Global Constraints

- Feature flag `instant_buy` (boolean, default off). With it off, every Buy Now button behaves exactly as today.
- Guest token lifetime: `90d`. Guest web storage key: `aura-guest-session`. Never written to the normal auth store.
- Guest email: `guest-<16 hex>@guest.auradime.invalid`, name `Guest`, role `customer`, `is_guest: true`.
- Orders are never linked to a guest by phone number.
- Dispatch hold: `rider_dispatch_at = paid_at + 30 min`; details submitted → `rider_dispatch_at = now`.
- Popup delivery: default `logistics_company_id: 'vendor_managed'`. The "Change" list excludes `pricing_mode: 'distance'` firms. Intercity routes go to `/checkout`.
- Guest refund sweep: every 5 min, guest `wallet_balance >= 500` → `WithdrawalRequest` to the guest's MoMo number.
- Guest cleanup: daily, delete guests older than 7 days with no orders.
- The existing `/checkout` page and its tests must stay green and unchanged in behaviour.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit `.env`, `scratch/`, `manager/`, `backend/uploads/`.

## Review Focus

- **Guest token on a normal-auth route** (e.g. `/wallet`, `/auth/me`): a guest must not reach account settings, wallet withdrawals or reviews. Expect 403 `Guest accounts cannot do this.`; tested in Task 1.
- **Details sent twice, or after pickup:** the second submit before pickup updates the order; after the shipment is `picked_up`, expect 409. Tested in Task 3.
- **Payment never confirmed (cancelled or timed out):** the order is failed via `/payments/checkout/failed` with the guest token, and no shipment or hold remains. Tested in Task 6.
- **Area changed in the details step:** expect 400 `The delivery area was paid for and cannot change.`; tested in Task 3.
- **Claiming a guest session that belongs to another device's guest, or claiming twice:** only the token's own guest is moved, and the second claim is a no-op 200. Tested in Task 4.

---

### Task 1: Guest accounts and guest sessions (backend)

**Files:**
- Modify: `backend/models/User.model.js` (add `is_guest: { type: Boolean, default: false, index: true }`)
- Modify: `backend/services/authOtp.service.js` (add `createGuestToken`)
- Modify: `backend/controllers/auth.controller.js`, `backend/routes/auth.routes.js`
- Modify: `backend/middleware/auth.middleware.js` (add `blockGuests`)
- Modify: `backend/utils/notifier.js` (skip email when `user.is_guest`)
- Modify: `backend/controllers/admin.controller.js:252,272-273,1614,1662`, `backend/controllers/manager.controller.js:257` (add `is_guest: { $ne: true }` to user counts)
- Modify: `backend/utils/featureFlags.js` (add `instant_buy: 'boolean'`)
- Test: `backend/tests/integration/guest-session.test.js`

**Interfaces:**
- Produces: `POST /api/v1/auth/guest` (public, `strictLimiter`) → `201 { success, token, data: { user } }`.
- Produces: `createGuestToken(user) -> string` (same payload as `createAuthToken`, `expiresIn: '90d'`).
- Produces: `blockGuests` middleware → `403 { success:false, message:'Guest accounts cannot do this.' }` when `req.user.is_guest`. It is mounted on wallet, withdrawal, profile-update, delete-account, review and subscription routes.

- [ ] **Step 1: Write failing tests** in `guest-session.test.js`:
  - `creates a new guest each call` — two POSTs return different `data.user._id`, both `is_guest: true`, role `customer`, email ending `@guest.auradime.invalid`.
  - `guest token works on /orders but not on /wallet` — `GET /api/v1/orders/my` (or the existing my-orders route) → 200; `GET /api/v1/wallet` → 403 `Guest accounts cannot do this.`
  - `guests are left out of admin user totals` — admin dashboard `total_users` is unchanged after creating a guest.
  - `rate limited` — repeated calls eventually return 429 (follow how existing limiter tests set the limit).
- [ ] **Step 2: Run** `cd backend && npx vitest run tests/integration/guest-session.test.js`. Expected: FAIL (404 on `/auth/guest`).
- [ ] **Step 3: Implement** the field, `createGuestToken`, `createGuestSession` controller, route, `blockGuests`, notifier skip, count filters and flag.
- [ ] **Step 4: Run** the new test file plus `tests/integration/auth*.test.js` and `tests/integration/admin*.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `Guest sessions for instant Buy Now`.

### Task 2: Orders with pending delivery details and dispatch hold

**Files:**
- Modify: `backend/models/Order.model.js` (add `delivery_details_status: { type: String, enum: ['pending','complete'], default: null }`)
- Modify: `backend/controllers/order.controller.js` `createOrder` (accept body `delivery_details_pending: true` → set `'pending'`; the existing zone/firm validation is unchanged)
- Modify: `backend/services/payment/settle.service.js` ≈ line 84 (the non-food logistics block)
- Modify: `backend/services/delayedRiderDispatch.service.js` (candidate queries ≈ lines 48 and 162)
- Test: `backend/tests/integration/instant-buy-dispatch.test.js`

**Interfaces:**
- Produces: order field `delivery_details_status`.
- Produces: settlement rule. For a `logistics_partner` order with `delivery_details_status === 'pending'`, no shipment is created and `rider_dispatch_at = now + 30 min`. The worker picks orders where `rider_dispatch_at <= now` and (`food_status: 'preparing'` OR `delivery_details_status` in `['pending','complete']` with no `food_status`).
- Produces: when the worker fires while still `'pending'`, the vendor and the firm get the notification `Buyer has not sent the exact spot. Call <phone> before delivery.`

- [ ] **Step 1: Write failing tests:**
  - `pending-details order is paid without a shipment` — settle → `Shipment.countDocuments({order_id}) === 0`, `rider_dispatch_at` ≈ +30 min.
  - `worker creates the shipment once rider_dispatch_at passes` — set it to the past, run the worker tick → 1 shipment, `rider_dispatch_at === null`.
  - `normal checkout orders still dispatch at payment` — an order without the flag → shipment created at settle (the existing behaviour).
  - `fallback notifies vendor and firm with the buyer phone` — fire while pending → two notifications whose message contains the phone.
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement** the field, the createOrder flag, the settle branch and the worker query/notification.
- [ ] **Step 4: Run** the file plus `rider-dispatch.test.js`, `payment-dispatch-cash.test.js`, `orders-extended.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `Hold rider dispatch until the buyer sends delivery details`.

### Task 3: Delivery details endpoint

**Files:**
- Modify: `backend/controllers/order.controller.js`, `backend/routes/order.routes.js`
- Test: `backend/tests/integration/instant-buy-details.test.js`

**Interfaces:**
- Consumes: `delivery_details_status`, `rider_dispatch_at` (Task 2).
- Produces: `PATCH /api/v1/orders/:id/delivery-details` (protect; guests allowed). Body: `{ full_name, phone, street?, landmark?, location?: {lat,lng,source}, place_name?, zone_id?, quartier? }`. Returns `200 { success, data: { order } }`.
  - **Rules:** owner only (404 otherwise); `payment_status === 'paid'` (409 otherwise). A `quartier` that differs from the paid one → 400 `The delivery area was paid for and cannot change.` A shipment already `picked_up` or later → 409.
  - **Effects:** writes `shipping_address` fields, sets `delivery_details_status: 'complete'`, sets `rider_dispatch_at = now` when no shipment exists yet, and notifies the vendor (`Delivery details received`). For non-guests it saves the address via `savedAddress.service` the way `cart-split` does.

- [ ] **Step 1: Write failing tests** for each rule above (owner, unpaid, area change, after pickup, success sets complete + dispatch now, second submit before pickup updates).
- [ ] **Step 2: Run** the file. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the file. Expected: PASS.
- [ ] **Step 5: Commit** `Buyers send delivery details after paying`.

### Task 4: Claim guest orders on sign-in

**Files:**
- Create: `backend/services/guestClaim.service.js`
- Modify: `backend/controllers/auth.controller.js`, `backend/routes/auth.routes.js`
- Test: `backend/tests/integration/guest-claim.test.js`

**Interfaces:**
- Produces: `claimGuest(guestId, userId, session) -> { orders, transactions }`. Inside one transaction it moves `Order.customer_id`, `Transaction.user_id`, `Escrow.buyer_id`, `Shipment` customer refs, `WithdrawalRequest.requested_by` and `wallet_balance` (via `creditBalance` on the real user and a matching debit on the guest). The guest is then set `is_active: false`.
- Produces: `POST /api/v1/auth/guest/claim` (protect, real user only) with body `{ guest_token }` → 200 `{ success, data: { orders } }`. An invalid or expired token, or a non-guest token → 400. Already claimed → 200 with `orders: 0`.

- [ ] **Step 1: Write failing tests:** moves orders + transactions + balance atomically; a second claim → `orders: 0`; a token of a non-guest → 400; a guest token can't call claim itself → 403.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the file plus `tests/jobs` invariants tests if present. Expected: PASS.
- [ ] **Step 5: Commit** `Signing in claims guest orders from this device`.

### Task 5: Guest refund sweep and cleanup job

**Files:**
- Create: `backend/services/guestMaintenance.service.js`
- Modify: `backend/server.js` (start the worker next to `startStaleTransactionCleanupWorker`)
- Test: `backend/tests/integration/guest-maintenance.test.js`

**Interfaces:**
- Produces: `sweepGuestRefunds() -> number`. For guests with `wallet_balance >= 500` and no pending/approved `WithdrawalRequest`, it creates one through the same code path as `POST /withdrawals`: debit the balance, `withdrawal_method: 'momo'`, the phone from the guest's latest paid order (`shipping_address.phone`, else the collection transaction phone), `recipient_details: { first_name: 'Guest', last_name: 'Buyer', country: 'CM' }`.
- Produces: `purgeIdleGuests() -> number`. Deletes guests whose `createdAt` is more than 7 days ago and who have no `Order`.
- Produces: `startGuestMaintenanceWorker()`. Runs the sweep every 5 min and the purge every 24 h. Its intervals are `unref()`'d.

- [ ] **Step 1: Write failing tests:** refund ≥500 creates exactly one withdrawal and empties the balance; 499 does nothing; a second sweep creates no duplicate; the purge removes an old idle guest but keeps an old guest with an order and keeps non-guests.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Extract the withdrawal-creation core of `submitWithdrawalAttempt` into a reusable function rather than copying it.
- [ ] **Step 4: Run** the file plus `withdrawal*.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `Refund guests to Mobile Money and clean up idle guest accounts`.

### Task 6: Web guest session and shared Mobile Money checkout helpers

**Files:**
- Create: `web/lib/guestSession.js`, `web/lib/instantBuy.js`
- Modify: `web/services/paymentProvider.js` (optional last `requestConfig` argument on `initiateCollection`, `initiateSmartCameroonCollection`, `pollTransactionStatus`, forwarded to every `api` call)
- Modify: `web/hooks/useAuth.js` (after a successful `verifyOtp` login: if a guest session exists, `POST /auth/guest/claim`, then clear it; failures are ignored)
- Test: `web/lib/instantBuy.test.js`, `web/lib/guestSession.test.js`

**Interfaces:**
- Produces: `getGuestSession() -> {token,user}|null`, `ensureGuestSession() -> Promise<{token,user}>` (creates via `/auth/guest` if missing), `clearGuestSession()`. All wrap storage in try/catch.
- Produces: `authConfigFor(user) -> axiosConfig`. This is `{}` for signed-in users; for guests it is `{ headers: { Authorization: 'Bearer <guest token>' } }`. The `api` interceptor only sets Authorization when a stored token exists, so the explicit header survives for signed-out visitors.
- Produces: `placeInstantOrder({ item, quantity, variant, selected_options, area, logisticsCompanyId, fulfilment_type, scheduled_for }, config) -> { orderIds }`. It calls `POST /orders/cart-split` with an `Idempotency-Key` and `delivery_details_pending: true`, and the address holds only `quartier`, `city`, `zone_id`.
- Produces: `sendDeliveryDetails(orderId, details, config)`, plus `failInstantOrder(orderIds, reason, config)` → `/payments/checkout/failed`.

- [ ] **Step 1: Write failing tests:** `authConfigFor` signed-in → `{}`, guest → Bearer header; `placeInstantOrder` posts `delivery_details_pending: true` and no street; `ensureGuestSession` reuses a stored session; storage throwing → still returns a fresh session; `pollTransactionStatus` forwards the config.
- [ ] **Step 2: Run** `cd web && npx vitest run lib/instantBuy.test.js lib/guestSession.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** those plus `npx vitest run components/wallet app/checkout`. Expected: PASS.
- [ ] **Step 5: Commit** `Guest session and instant order helpers`.

### Task 7: Instant Buy sheet and Buy Now wiring

**Files:**
- Create: `web/components/checkout/InstantBuySheet.js`, `web/hooks/useInstantBuy.js`
- Modify: `web/components/ProductCard.js:99-123`, `web/app/products/[id]/ProductDetailsPageClient.js:153-162`, `web/components/dine/MealCard.js:68-73`, `web/components/dine/DineMealCard.js:81`, `web/components/dine/MealDetailModal.js:212`
- Test: `web/components/checkout/InstantBuySheet.test.js`

**Interfaces:**
- Consumes: Task 6 helpers, `useMobileMoneyFeeRates`/`estimateMobileMoneyFee`, `resolveCameroonMobileMoneyGateway`, `NetworkLogo`, `AddressField`, `useFeatureFlag('instant_buy')`.
- Produces: `<InstantBuySheet open item quantity variant selectedOptions bookingType onClose />`, loaded with `next/dynamic` (`ssr: false`). Steps: `pay` → `waiting` → `details` → `done`.
  - **Pay step:** the area picker from `/logistics/zones` (skipped for pickup/dine-in), a delivery line (default "Seller delivers"), and a "Change" list of zone-priced firms. Intercity → "Continue in checkout" link. Then total = item + delivery + estimated MoMo fee, the MoMo number with `NetworkLogo`, and a Pay button.
  - **Waiting step:** "Approve the prompt on your phone". Failure or timeout → message + "Try again" and `failInstantOrder`.
  - **Details step:** "Payment confirmed · {gross} XAF". For guests: name, phone (pre-filled with the MoMo number) and `AddressField`. For signed-in users: the saved address pre-filled with Confirm.
  - **Done step:** order number and "Track order" link; guests also get "Create an account to keep your orders" → `/login`.
- Buy Now handlers: when `instant_buy` is on, open the sheet instead of the login redirect or `/checkout`, after the existing minimum-order, variant and meal-option checks. With the flag off, the code path is unchanged.

- [ ] **Step 1: Write failing tests:**
  - guest happy path: Pay calls `ensureGuestSession`, then `placeInstantOrder`, then `initiateSmartCameroonCollection` with the guest config; on success it shows the details form with the phone pre-filled; submit calls `sendDeliveryDetails`.
  - signed-in path: the saved address is shown and Confirm sends it.
  - payment failure: shows "Try again" and calls `failInstantOrder`.
  - distance firms are absent from the Change list.
  - ProductCard with the flag off still routes to `/checkout?productId=…`.
- [ ] **Step 2: Run** `npx vitest run components/checkout`. Expected: FAIL.
- [ ] **Step 3: Implement** the sheet and wire the five Buy Now handlers.
- [ ] **Step 4: Run** the full web suite `npx vitest run`. Expected: all pass (233+ tests).
- [ ] **Step 5: Manual check** in Edge at 390 px and 1440 px: a signed-out window and a signed-in one. Use a low-amount real MTN payment against the local backend, then confirm the order in `/orders` and the held dispatch.
- [ ] **Step 6: Commit** `Buy Now opens Mobile Money directly`.

### Task 8: Turn it on and ship

- [ ] **Step 1:** Run the full backend suite in the background (`cd backend && npx vitest run`). Note the known pre-existing `app-version` fee test failure; everything else should pass.
- [ ] **Step 2:** Push the branch and `main` per the usual flow.
- [ ] **Step 3:** Tell the owner to redeploy the backend before enabling `instant_buy` in Admin → Features, and to rebuild the APK for the apps.
