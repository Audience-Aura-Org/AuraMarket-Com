# AuraMarket / Auradime — Audit Corrections Log

All findings from the codebase audit have been remediated. This document records every change made, the file(s) affected, and the reason.

---

## CRITICAL

### 1. PayUnit Webhook — HMAC-SHA256 Signature Verification
**File:** `backend/controllers/payment.controller.js`
**Change:** Added HMAC-SHA256 signature verification using `crypto.timingSafeEqual` before processing any PayUnit webhook payload. Rejects requests with invalid or missing `x-payunit-signature` / `x-webhook-signature` headers.
**Risk before:** Attacker could forge arbitrary payment success events and credit wallets or settle orders without payment.

### 2. Stock Deduction — Atomic findOneAndUpdate
**File:** `backend/controllers/product.controller.js`
**Change:** Replaced `product.quantity -= qty; product.save()` with `Product.findOneAndUpdate({ _id, quantity: { $gte: qty } }, { $inc: { quantity: -qty } })`. Returns `null` on insufficient stock.
**Risk before:** Concurrent orders for the same product could each read the same stock level and both succeed, selling more units than available.

### 3. Coupon Usage Counter — Atomic Claim
**File:** `backend/controllers/order.controller.js`
**Change:** Replaced `coupon.used_count += 1; coupon.save()` with `Coupon.findOneAndUpdate({ _id, used_count: { $lt: max_uses } }, { $inc: { used_count: 1 } })`. Throws if coupon is already exhausted.
**Risk before:** Two simultaneous order placements with the same single-use coupon could both succeed.

### 4. Wallet Balance — Atomic debitBalance / creditBalance
**Files:** `backend/services/wallet.service.js` (new helpers) + 11 controllers/services
**Change:** Added `debitBalance(userId, amount, session, opts)` and `creditBalance(userId, amount, session)` helpers using `$inc` in a single `findOneAndUpdate`. Replaced all 31 non-atomic `wallet_balance += / -=; save()` patterns across:
- `controllers/order.controller.js` (3 debits)
- `controllers/escrow.controller.js` (1 debit, 2 credits)
- `controllers/logistics.controller.js` (3 credits)
- `controllers/wallet.controller.js` (1 debit, 1 credit)
- `controllers/withdrawal.controller.js` (1 debit, 3 credits)
- `controllers/subscription.controller.js` (1 debit)
- `controllers/dispute.controller.js` (2 credits)
- `controllers/admin.controller.js` (1 credit)
- `services/intercityDispatchTimeout.service.js` (1 debit, 1 credit)
- `services/payment/settle.service.js` (5 debits/credits)
- `services/payment.service.js` (1 credit)
**Risk before:** Two concurrent wallet operations (e.g., simultaneous withdrawal requests or webhook + manual confirm) could both read the same balance and produce a phantom credit or allow double-spend.

### 5. Escrow Double-Release — Redis Distributed Lock
**File:** `backend/services/escrowAutoRelease.service.js`
**Change:** Replaced `let running = false` in-process mutex with `withLock('worker:escrow-auto-release', ttl, fn)` from `utils/locks.js`. Added `stopEscrowAutoReleaseWorker()` export for graceful shutdown.
**Risk before:** In PM2 cluster mode, multiple worker processes ran the escrow scan concurrently. The inner Mongoose session protected individual escrow records, but the full scan (batch fetch + loop) ran N times simultaneously, wasting DB resources and risking edge-case double-releases.

### 6. Food Timeout — Transaction Aborts on Clawback Failure
**File:** `backend/services/foodAcceptanceTimeout.service.js`
**Change:** Removed the `try/catch` around `clawbackFoodRefund()`. If clawback fails, the error now propagates to the outer catch block which aborts the MongoDB transaction. Order status does not change; the worker retries on the next tick.
**Risk before:** If the vendor debit failed (e.g., Mongoose error mid-transaction), the catch block silently pushed a `refund_failed` status log and committed the transaction — leaving the order cancelled without refunding the buyer's money.

### 7. Video Transcoding — FFmpeg Off Request Thread
**Files:** `backend/controllers/upload.controller.js`, `backend/routes/upload.routes.js`
**Change:**
- `POST /api/upload/single`: Detects videos that require FFmpeg (non-MP4 or large MP4). Writes raw buffer to a temp file, enqueues a `video-transcode` background job, and returns HTTP 202 with a `job_id` immediately.
- `POST /api/upload/process-s3`: Same pattern — S3 stream is downloaded to disk synchronously, then FFmpeg is enqueued as `s3-video-process` background job, returns HTTP 202.
- Background jobs emit `video_processed` socket event on completion, storing result in a 30-minute TTL in-memory map.
- Added `GET /api/upload/video-status/:jobId` polling endpoint.
**Risk before:** FFmpeg transcoding (up to 2+ minutes for large videos) blocked the Node.js event loop thread, preventing all other requests from being served during that window.

---

## HIGH

### 8. CORS — Removed *.vercel.app Wildcard
**File:** `backend/middleware/security.middleware.js`
**Change:** Removed `hostname.endsWith('.vercel.app')` from `isAllowedOrigin()`. Specific preview URLs can be added via `WEB_CLIENT_URL` env var.
**Risk before:** Any Vercel deployment — including an attacker's — could make credentialed cross-origin requests to the API.

### 9. VAPID Keys — Removed Hardcoded Fallbacks
**File:** `backend/utils/notifier.js`
**Change:** Removed hardcoded VAPID public/private key fallbacks. `webPush.setVapidDetails` is now only called if both `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are present. Push job bails early if keys are unconfigured. Keys are still required by `env.js` `validateEnv()`.
**Risk before:** The hardcoded private key in the repository could be used by anyone to send push notifications to all subscribed users, bypassing authentication.

### 10. Eversend Auth Token — Added Timeout
**File:** `backend/services/eversend.service.js`
**Change:** Added `timeout: 15000` to the `getAccessToken` axios call. The authenticated client already had a 30 s timeout; the auth call was missing it.
**Risk before:** A hung Eversend auth endpoint could block the Node.js request thread indefinitely, stalling all subsequent API calls that need an Eversend token.

### 11. Eversend Webhook — Atomic Idempotency Claim
**File:** `backend/controllers/payment.controller.js`
**Change:** Replaced `Transaction.findOne(...)` + status-check with `Transaction.findOneAndUpdate({ status: { $in: ['pending', 'failed'] } }, { $set: { status: 'processing' } })`. Only one concurrent webhook delivery can claim the transaction; others return 200 without processing. If settlement fails, status is reset to `'pending'` so webhook retries can re-process.
**Risk before:** Two simultaneous `collection.success` events for the same transaction would both find `status === 'pending'` and both attempt to settle orders / credit wallets, potentially double-crediting the user.

### 12. Eversend Webhook Signature — timingSafeEqual
**File:** `backend/services/eversend.service.js`
**Change:** Replaced `digest === signature` string comparison in `verifyWebhookSignature` with `crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signature, 'hex'))`.
**Risk before:** String equality short-circuits on the first differing byte, leaking timing information that an attacker could use to brute-force a valid HMAC.

### 13. Worker Distributed Locks + stop() Exports
**Files:**
- `backend/services/disputeWindowEnforcement.service.js`
- `backend/services/cancelRateMonitor.service.js`
- `backend/services/delayedRiderDispatch.service.js`
- `backend/services/intercityDispatchTimeout.service.js`

**Change:** Added `withLock(key, ttl, fn)` to each worker's scan function and exported a `stop*Worker()` function that clears the `setInterval` timer. `intercityDispatchTimeout` also now tracks its timer handle for proper shutdown.
**Risk before:** In PM2 cluster mode, all four workers ran their scans simultaneously on every tick (every 1–30 minutes), duplicating DB reads and risking concurrent mutation of the same records.

### 14. N+1 Stock Watch — Batch Delete + Parallel Notify
**File:** `backend/controllers/product.controller.js`
**Change:** Replaced a `for` loop of individual `StockWatch.findByIdAndDelete(watch._id)` calls with a single `StockWatch.deleteMany({ product_id })`. Notifications are sent in parallel via `Promise.allSettled`.
**Risk before:** Restocking a product with 100 watchers generated 101 sequential DB round-trips and 100 sequential notification calls, introducing latency proportional to watcher count.

---

## MEDIUM

### 15. Admin Audit Log — Role and Verification Status Changes
**File:** `backend/controllers/admin.controller.js`
**Change:** Added import of `recordAudit` from `utils/auditTrail.js`. After `user.save()` in `updateUserAdmin`, added `recordAudit` calls for role changes and verification_status changes, recording the before/after values and the acting admin's user ID.
**Risk before:** Role escalations (e.g., promoting a user to admin or vendor) and verification status changes were not logged, making post-incident forensics impossible.

### 16. Cache deleteByPrefix Helper
**File:** `backend/utils/cache.js`
**Change:** Added `deleteByPrefix(prefix)` method that iterates only the in-memory Map's keys. Updated `bustIntercityRateCache` in `admin.controller.js` to use it (now synchronous — no `await` needed).
**Risk before:** Each call site was writing `cache.keys().filter(k => k.startsWith(p))` + `Promise.all(keys.map(k => cache.delete(k)))` — duplicating the O(n) pattern at every call site.

### 17. Video Upload Rate Limit
**Files:** `backend/middleware/rateLimiter.js`, `backend/routes/upload.routes.js`
**Change:** Added `videoUploadLimiter` (10 uploads per user per 10 minutes, configurable via `VIDEO_UPLOAD_RATE_LIMIT_MAX` env var). Applied to `POST /single` and `POST /process-s3`.
**Risk before:** An authenticated user could enqueue unlimited background transcoding jobs, exhausting server CPU and disk space.

### 18. Shipment Index — (order_id, status)
**File:** `backend/models/Shipment.model.js`
**Change:** Added `ShipmentSchema.index({ order_id: 1, status: 1 })`. The `unique: true` constraint on `order_id` creates an implicit single-field index, but the compound index is needed for the common query `Shipment.findOne({ order_id: ..., status: 'delivered' })` used by `escrowAutoRelease`.

---

## LOW

### 19. Support Admin Email — Moved to Environment Variable
**Files:** `backend/config/env.js`, `backend/controllers/auth.controller.js`
**Change:** `SUPPORT_ADMIN_EMAIL` is no longer hardcoded as `'support@auradime.com'`. It is now read from `process.env.SUPPORT_ADMIN_EMAIL`. If the env var is not set, the auto-promotion feature is silently disabled (the `isSupportAdminEmail` guard short-circuits on `!SUPPORT_ADMIN_EMAIL`).
**Risk before:** The hardcoded email was visible to anyone with read access to the repository. Anyone who registered an account with that address would be silently elevated to admin on first login.

### 20. next.config.js — S3 remotePatterns
**File:** `web/next.config.js`
**Change:** Added a dynamic entry to `images.remotePatterns` for the S3 bucket hostname, computed at build time from `AWS_S3_BUCKET` and `AWS_REGION` env vars. Only added if `AWS_S3_BUCKET` is set.
**Risk before:** Next.js `<Image>` components serving S3-hosted images would fall through to unoptimized rendering or throw an "unconfigured host" error in production.

---

## Summary

| Severity | Count | Status |
|----------|------:|-------|
| CRITICAL | 7 | All fixed |
| HIGH | 7 | All fixed |
| MEDIUM | 4 | All fixed |
| LOW | 2 | All fixed |
| **Total** | **20** | **All fixed** |

> Generated: 2026-08-20
