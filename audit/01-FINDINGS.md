# AuraMarket — Audit Findings

**Generated:** 2026-08-19
**Scope:** Full codebase — backend (Express/Node 22, Mongoose 9, Socket.io 4) + frontend (Next.js 16, React 19, Capacitor)
**Method:** Five parallel deep-dive agents, each reading actual source before reporting. No finding is inferred from filenames or grep hits alone.

---

## CRITICAL

---

### [CRITICAL] No signature verification on PayUnit webhook
- **Where:** `backend/controllers/payment.controller.js:636-660`
- **What:** `payunitWebhook` processes incoming payment confirmations and credits user wallets without verifying the request's authenticity. Compare line 70–71 where Paystack verifies `x-paystack-signature` — PayUnit has no equivalent check.
- **Why it matters:** Any attacker who can send an HTTP POST to `/api/payment/payunit/webhook` can mark arbitrary transactions as successful and inject fake credits into any wallet. No special knowledge required.
- **Evidence:** Lines 636–660 read `req.body` and call wallet credit logic with zero signature/HMAC validation.
- **Fix:** Implement HMAC-SHA256 verification using the PayUnit webhook secret: `crypto.createHmac('sha256', PAYUNIT_WEBHOOK_SECRET).update(JSON.stringify(req.body)).digest('hex')` and compare with the incoming header before processing.
- **Effort:** small
- **Confidence:** high

---

### [CRITICAL] Non-atomic stock deduction — check-then-act race
- **Where:** `backend/controllers/order.controller.js:194-245`
- **What:** Stock is validated with `.find()` and then decremented via `product.save()` inside a for-loop. The validation and the mutation are two separate operations, even within a Mongoose session.
- **Why it matters:** Two concurrent orders for the same last-in-stock item can both pass the availability check before either write lands, causing negative stock and confirmed orders for goods that don't exist.
- **Evidence:** Lines 203–207: `variantMatch.stock -= quantity` then `await product.save({ session })`. The check at ~line 194 and the decrement are not a single atomic MongoDB operation.
- **Fix:** Replace the read-modify-write with an atomic findOneAndUpdate: `Product.findOneAndUpdate({ _id: id, 'variants._id': variantId, 'variants.stock': { $gte: qty } }, { $inc: { 'variants.$.stock': -qty } }, { session, new: true })`. Null result = out of stock.
- **Effort:** medium
- **Confidence:** high

---

### [CRITICAL] Coupon usage counter not atomic
- **Where:** `backend/controllers/order.controller.js:251-261`, `backend/models/Coupon.model.js:45-47`
- **What:** Coupon validation (`isValid()`) and usage increment (`coupon.used_count += 1; await coupon.save()`) are separate operations. Two simultaneous checkouts with the same single-use coupon both pass validation before either write commits.
- **Why it matters:** A max_uses=1 coupon can be redeemed any number of times concurrently, causing revenue loss and accounting mismatches.
- **Evidence:** Line 261: `coupon.used_count += 1; await coupon.save({ session })` — standard read-modify-write race.
- **Fix:** Atomic increment with guard: `const updated = await Coupon.findOneAndUpdate({ _id: coupon._id, used_count: { $lt: coupon.max_uses } }, { $inc: { used_count: 1 } }, { session, new: true })`. If `updated` is null, the coupon is already exhausted.
- **Effort:** small
- **Confidence:** high

---

### [CRITICAL] Wallet balance updated non-atomically in 22+ places
- **Where:** `backend/controllers/wallet.controller.js:167`, `backend/controllers/order.controller.js:477, 620`, `backend/controllers/escrow.controller.js:91`, and ~18 more locations
- **What:** Wallet balance is modified via `user.wallet_balance -= amount; await user.save()` in some paths and `User.findByIdAndUpdate(..., { $inc: { wallet_balance: amount } })` in others. The read-modify-write pattern loses concurrent writes.
- **Why it matters:** Concurrent deposit and withdrawal can result in one write silently overwriting the other. Example: balance 1000, concurrent withdraw 500 and deposit 100 both read 1000; one write produces 500, the other 1100; the committed value will be whichever saved last — one operation is lost entirely.
- **Evidence:** Line 167 in `wallet.controller.js` uses `user.wallet_balance -= amount; await user.save({ session })`. Line 55 in `payment.controller.js` uses `$inc`. The patterns are inconsistent across ~22 call sites.
- **Fix:** Eliminate all read-modify-write patterns. Use `$inc` exclusively everywhere: `User.findByIdAndUpdate(userId, { $inc: { wallet_balance: delta } }, { session, new: true })`. Create a single `adjustWalletBalance(userId, delta, session)` helper and replace all 22+ direct mutations.
- **Effort:** large
- **Confidence:** high

---

### [CRITICAL] Floating-point arithmetic on all monetary fields
- **Where:** `backend/models/Transaction.model.js:24-26`, `backend/models/User.model.js:54-59`, `backend/models/Order.model.js:58-79`, `backend/utils/platformFees.js:17-57`
- **What:** Every monetary field is a JavaScript `Number` (IEEE 754 double). All fee calculations use standard JS division and multiplication.
- **Why it matters:** `0.1 + 0.2 === 0.30000000000000004` in JavaScript. Commission splits (e.g., 2.5% of 1030 XAF = 25.75, stored as floating point) accumulate rounding errors across thousands of transactions. Monthly reconciliation will show unexplained gaps.
- **Evidence:** `platformFees.js:49`: `platformFee: clampToBase(commissionFee + escrowFee, base)` — floating-point arithmetic with no enforced rounding before DB write. `toXAF()` helper exists at line 99 but is not consistently called before every write.
- **Fix:** Store all amounts as integers (minor currency units, e.g., XAF cents or use whole XAF with a rule that all amounts are whole integers). Apply `Math.round()` at every calculation boundary. Enforce this with a schema getter/setter or pre-save hook. Never store a fraction.
- **Effort:** large
- **Confidence:** high

---

### [CRITICAL] Escrow auto-release race — double payout to vendor
- **Where:** `backend/services/escrowAutoRelease.service.js:26-103`, `backend/controllers/escrow.controller.js` (finalizeEscrowPayout)
- **What:** The auto-release worker and any manual release trigger both call `finalizeEscrowPayout()` without first atomically claiming the escrow record. If a manual release and the worker fire at the same time (or if the worker runs on two PM2 processes simultaneously), both can see `status: 'held'` and both proceed to pay the vendor.
- **Why it matters:** Vendor receives two payouts for one order. Platform loses double the escrow value.
- **Evidence:** Lines 31–34 fetch the escrow, then line 83 calls `finalizeEscrowPayout()`. There is no intervening atomic status update (e.g., `findOneAndUpdate({ status: 'held' }, { $set: { status: 'releasing' } })`) to prevent re-entry.
- **Fix:** Before calling `finalizeEscrowPayout`, atomically claim the record: `const claimed = await Escrow.findOneAndUpdate({ _id: escrow._id, status: 'held' }, { $set: { status: 'releasing' } }, { session })`. If `claimed` is null, abort — another process already claimed it.
- **Effort:** medium
- **Confidence:** high

---

### [CRITICAL] JWT default expiry is 4 years
- **Where:** `backend/config/env.js:31`
- **What:** `JWT_EXPIRES_IN` defaults to `'1460d'` (4 years) if the environment variable is not set.
- **Why it matters:** A stolen or leaked token remains valid for up to 4 years. There is no revocation mechanism per token (only `token_version` bump, which requires the user to be online). Any credential leak becomes a 4-year compromise window.
- **Evidence:** Line 31: `JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1460d'`
- **Fix:** Change default to `'24h'`. Implement refresh token flow: short-lived access tokens (15 min–24 h) + longer-lived refresh tokens (7–30 days) with server-side revocation. The socket layer already reads `token_version`; the HTTP layer should too.
- **Effort:** medium
- **Confidence:** high

---

### [CRITICAL] Video transcoding on the main request thread
- **Where:** `backend/controllers/upload.controller.js:57-122`
- **What:** `maybeTranscodeVideoForWeb` runs FFmpeg via a 120-second `exec()` promise synchronously on the request handler thread. Large uploads block the event loop for up to 2 minutes.
- **Why it matters:** While FFmpeg runs, Node cannot process any other request on that process. In a PM2 cluster, all processes can be simultaneously blocked if multiple users upload videos at once, making the API completely unresponsive.
- **Evidence:** Line 96: `await compressFn(inputPath, outputPath, ...)` where `compressFn` is a blocking child_process exec. No worker thread, no job queue offload.
- **Fix:** Push transcoding into the existing `jobQueue.service.js`. Return `202 Accepted` with a `jobId`. Client polls `GET /uploads/status/:jobId` or receives a socket push when transcoding completes.
- **Effort:** large
- **Confidence:** high

---

## HIGH

---

### [HIGH] CORS allows all *.vercel.app origins and private IP ranges
- **Where:** `backend/middleware/security.middleware.js:119-129`
- **What:** `isAllowedOrigin` returns `true` for any `*.vercel.app` hostname and for all RFC-1918 private IP blocks (10.x, 172.16-31.x, 192.168.x). Any Vercel-hosted site (including attacker-controlled forks) can make credentialed cross-origin requests.
- **Why it matters:** An attacker deploys a phishing clone on Vercel, CORS passes, and the clone can make authenticated API calls on behalf of a user who visits it.
- **Evidence:** Lines 122–123: `if (hostname === 'vercel.app' || hostname.endsWith('.vercel.app')) return true;`
- **Fix:** Replace the wildcard with an explicit allowlist of known Vercel deployment URLs. Remove the private-IP block from the CORS allowlist; use a separate dev-only flag if localhost/LAN access is needed.
- **Effort:** small
- **Confidence:** high

---

### [HIGH] Path traversal in S3 video key validation
- **Where:** `backend/controllers/upload.controller.js:376-388`
- **What:** `processVideoFromS3` accepts a `key` from the request body and validates only that it starts with `'status-sources/'`. A key like `status-sources/../../../sensitive/file.mp4` passes the prefix check.
- **Why it matters:** Authenticated users can trigger download and processing of arbitrary S3 objects by crafting traversal keys.
- **Evidence:** Lines 383–388: `if (!key.startsWith('status-sources/')) { return error }` — no normalization before the prefix check.
- **Fix:** Normalize first: `const normalized = path.posix.normalize(key); if (!normalized.startsWith('status-sources/') || normalized.includes('..')) throw ...`
- **Effort:** small
- **Confidence:** high

---

### [HIGH] Debug and test routes exposed without production guard
- **Where:** `backend/routes/v1.router.js:82-84`, `backend/routes/debug.routes.js`, `backend/routes/test-routes.js`
- **What:** Debug routes are mounted when `ENABLE_DEBUG_ROUTES === 'true'`. `ENABLE_DEBUG_ROUTES` is not documented in `.env.example` and has no safeguard preventing it from being set in production. `test-routes.js` is never imported anywhere — it's dead code but leaks intent.
- **Why it matters:** If accidentally enabled, debug endpoints return internal mappings (vendor-user relationships). The existence of the variable is invisible to operators who don't read source code.
- **Evidence:** `v1.router.js:82-84`. `.env.example` has no mention of `ENABLE_DEBUG_ROUTES`.
- **Fix:** Add `ENABLE_DEBUG_ROUTES=false # Never enable in production` to `.env.example`. Add a runtime guard: if `NODE_ENV === 'production' && ENABLE_DEBUG_ROUTES === 'true'`, log a CRITICAL warning and refuse to start. Delete `test-routes.js`.
- **Effort:** trivial
- **Confidence:** high

---

### [HIGH] Hardcoded VAPID keys with fallback values
- **Where:** `backend/utils/notifier.js:13-14`
- **What:** `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` fall back to hardcoded literal key strings if the environment variables are absent.
- **Why it matters:** In any deployment missing these env vars, the hardcoded keys are used. Anyone with the source code can sign push notifications for any subscriber registered against those keys, sending arbitrary payloads to all users.
- **Evidence:** Lines 13–14: `const VAPID_PUB = process.env.VAPID_PUBLIC_KEY || 'BPhRBNH4-gNAvZGDA...'`
- **Fix:** Remove both fallback strings. Add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to `validateEnv()` in `config/env.js` as required. Server should refuse to start if they are absent.
- **Effort:** small
- **Confidence:** high

---

### [HIGH] Missing env vars in .env.example
- **Where:** `backend/config/env.js:39-59`, `backend/.env.example`
- **What:** The following vars are read by `env.js` but absent from `.env.example`: `EMAIL_FROM`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_SECURE`, `RESEND_API_KEY`, `EVERSEND_CLIENT_ID`, `EVERSEND_CLIENT_SECRET`, `EVERSEND_WEBHOOK_SECRET`, `EVERSEND_BASE_URL`, `PAYUNIT_API_USERNAME`, `PAYUNIT_API_PASSWORD`, `PAYUNIT_LIVE_KEY`, `PAYUNIT_SANDBOX_KEY`, `PAYUNIT_MODE`, `PAYUNIT_BASE_URL`, `ENABLE_DEBUG_ROUTES`.
- **Why it matters:** New deployments silently misconfigure email and payment gateways. EVERSEND and PAYUNIT failing to configure means those payment paths are broken with no startup warning.
- **Evidence:** `env.js` reads these vars; grep of `.env.example` finds none of them.
- **Fix:** Add all missing vars to `.env.example` with placeholder values and one-line comments. Add required-var assertions in `validateEnv()` for any that are not optional.
- **Effort:** trivial
- **Confidence:** high

---

### [HIGH] External API calls (Paystack, Eversend) have no timeouts
- **Where:** `backend/services/payment/gateways/paystack.gateway.js:35, 72`, `backend/services/eversend.service.js:30`
- **What:** `axios.post/get` calls to Paystack and the Eversend token endpoint are made without an `timeout` option. If the external API is unreachable, requests hang indefinitely.
- **Why it matters:** In a PM2 cluster, every worker process can simultaneously stall on a hung Paystack call, making the entire payment system — and any request sharing that process — unresponsive. Node's event loop is blocked for the duration of the hang.
- **Evidence:** `paystack.gateway.js:35`: `await axios.post('https://api.paystack.co/...', ..., { headers: {...} })` — no `timeout` property. `eversend.service.js:30`: same pattern.
- **Fix:** Add `timeout: 10_000` to every external axios call. Wrap in a try-catch that returns a `503` if the gateway is unreachable.
- **Effort:** trivial
- **Confidence:** high

---

### [HIGH] Payment webhooks not idempotent — double-credit risk
- **Where:** `backend/controllers/payment.controller.js:68-105` (Paystack), `636-660` (PayUnit), `1185-1378` (Eversend)
- **What:** Webhook handlers check `transaction.status === 'pending'` before crediting, but this check and the subsequent update are two separate operations. Two simultaneous webhook retries from the gateway can both pass the check before either write lands.
- **Why it matters:** Gateway-side retries (triggered by network timeouts) cause double wallet credits and duplicate order confirmations.
- **Evidence:** Line 76: `if (transaction && transaction.status === 'pending') { transaction.status = 'completed'; await transaction.save(); }` — separate read-then-write.
- **Fix:** Replace with a single atomic operation: `const settled = await Transaction.findOneAndUpdate({ _id: tx._id, status: 'pending' }, { $set: { status: 'completed', ... } })`. If `settled` is null, the webhook already ran — return 200 immediately without re-crediting.
- **Effort:** small
- **Confidence:** medium

---

### [HIGH] Worker errors silently dropped — vendor funds stuck
- **Where:** `backend/services/escrowAutoRelease.service.js:177-186`, `backend/services/foodAcceptanceTimeout.service.js:60-87`
- **What:** In both workers, when the inner operation (escrow release / food refund) throws, the error is logged but the item is not retried. The next run of the worker will not pick it up again (status already changed, or record no longer matches the query filter).
- **Why it matters:** A transient DB error during escrow release leaves vendor funds permanently stuck. A failed refund after food order cancellation leaves the buyer unrefunded. Both require manual admin intervention that may never happen.
- **Evidence:** `escrowAutoRelease:181`: `catch(err) { logger.error(err) }` — no retry scheduled. `foodAcceptanceTimeout:63-67`: refund throws, only a `setImmediate` notification fires; the order is committed as cancelled anyway.
- **Fix:** On transient failure, re-queue the item with exponential backoff (use `jobQueue.enqueueJob()` with `attempts: 3`). Only commit order cancellation after refund succeeds. If all retries fail, escalate to admin with the specific order ID.
- **Effort:** medium
- **Confidence:** high

---

### [HIGH] In-memory job queue lost when PM2 worker dies
- **Where:** `backend/services/jobQueue.service.js:5`, `backend/ecosystem.config.js:6-7`
- **What:** `jobQueue.service.js` holds all pending and in-progress jobs in a `Map` in process memory. PM2 runs in `cluster` mode with `instances: 'max'`. If a worker crashes mid-job, all its queued jobs are lost with no recovery.
- **Why it matters:** Notification emails, push notifications, and any other queued work silently disappear on worker crash. Users never receive order confirmations, etc.
- **Evidence:** `jobQueue.service.js:5`: `const queues = new Map()` — no persistence. `ecosystem.config.js:6`: `exec_mode: 'cluster'` — multiple workers, each with its own `queues` Map.
- **Fix:** Switch to a persistent queue backed by Redis (BullMQ is the natural choice given ioredis is already a dependency). Or at minimum, run workers in `fork` mode (single process) and accept reduced throughput until a proper queue is in place.
- **Effort:** large
- **Confidence:** high

---

### [HIGH] Background workers share no cross-process lock in cluster mode
- **Where:** `backend/services/escrowAutoRelease.service.js:12-14`, and all other interval-based worker services
- **What:** Each worker uses a module-scoped `let running = false` flag to prevent overlapping runs. In PM2 cluster mode, each process has its own flag, so all 4+ processes run the same escrow/food/orphan batch simultaneously.
- **Why it matters:** Multiple processes can call `finalizeEscrowPayout()` on the same escrow in the same time window. DB transactions mitigate (the second writer's transaction fails on the state check) but only if the check and update are atomic — which they currently are not (see CRITICAL finding above).
- **Evidence:** `escrowAutoRelease.service.js:12`: `let running = false` — process-local only.
- **Fix:** Use a Redis distributed lock (e.g., `SET worker:escrow:lock <workerid> NX EX 600`) before each batch. Only the process that acquires the lock runs the batch. Release on completion or expiry.
- **Effort:** medium
- **Confidence:** high

---

### [HIGH] Socket delivery retry state not shared across workers
- **Where:** `backend/sockets/chat.socket.js:117-282`
- **What:** `pendingRetries` Map is in-process memory. When a message fails delivery and a retry is scheduled, only the current worker holds it. Redis adapter replicates room membership but not retry state. If that worker restarts, the retry is lost.
- **Why it matters:** In multi-worker PM2 deploys, users who go offline during a worker restart permanently miss queued messages (the retry is recovered only if the specific crashed worker comes back online).
- **Evidence:** `chat.socket.js:117`: `const pendingRetries = new Map()` — process-local. Redis adapter at line 99 handles room fanout but not retry scheduling.
- **Fix:** On user reconnect (any worker), query Redis for pending retries for that user (`LRANGE chat:retry:<userId> 0 -1`) and reschedule locally. OR use a proper durable message queue for delivery guarantees.
- **Effort:** large
- **Confidence:** high

---

### [HIGH] Unbounded .find() queries — OOM and DoS potential
- **Where:** `backend/controllers/admin.controller.js`, `backend/controllers/order.controller.js`, and multiple other controllers (6+ files)
- **What:** Several `.find()` calls have no `.limit()`. Fetching all transactions for a high-volume user or all orders in an admin view can return millions of documents and exhaust process heap.
- **Why it matters:** A single crafted request against an unbounded endpoint can spike memory and crash the process. In cluster mode, a few concurrent requests can take down all workers.
- **Evidence:** Pattern: `Transaction.find({ user_id: req.user._id }).sort('-createdAt')` without `.limit()` or pagination parameters.
- **Fix:** Enforce a maximum limit on every collection query in controllers. Default page size 50, max 200. Add a lint rule or middleware that rejects `.find()` without `.limit()` on public-facing routes.
- **Effort:** medium
- **Confidence:** medium

---

### [HIGH] In-memory socket Maps grow unboundedly
- **Where:** `backend/sockets/chat.socket.js:110-111, 437, 440`
- **What:** Module-scoped `userSockets`, `typingThrottle`, and `typingTimers` Maps are populated on every connection and cleaned only partially on disconnect. Reconnecting clients add new entries without evicting old ones. A malicious client can open many socket connections to keep growing these Maps.
- **Why it matters:** On high-traffic deployments over days/weeks, unchecked Map growth causes memory bloat and eventual OOM crash.
- **Evidence:** `chat.socket.js:110`: `const userSockets = new Map()` (module scope). Cleanup at line 565 only fires after an 8-second grace timer, which can be bypassed by rapid reconnects.
- **Fix:** Cap `userSockets` per userId to a reasonable limit (e.g., 5 concurrent devices). Add a periodic sweep (every 30 minutes) to evict stale typing/throttle state. Or move socket presence to Redis with TTL keys.
- **Effort:** medium
- **Confidence:** high

---

### [HIGH] Notifier crashes silently if `io` is not initialised
- **Where:** `backend/utils/notifier.js:258-262`
- **What:** `sendNotification()` calls `app.get('io')` without a null guard. If `app` is null or Socket.io failed to initialise, `app.get` throws a TypeError that propagates into every caller.
- **Why it matters:** A Socket.io startup failure cascades into every notification call across the codebase, silently killing order confirmations, ride assignments, and chat delivery.
- **Evidence:** Line 258: `const io = app.get('io')` — no null check on `app`. Called with `app` from `setImmediate` in `order.controller.js:527`.
- **Fix:** `const io = app?.get?.('io'); if (!io) { logger.warn('Socket.io unavailable; skipping real-time emit'); }` — fail gracefully and continue with push/email paths.
- **Effort:** small
- **Confidence:** high

---

### [HIGH] N+1 queries in stock-watch alert dispatch
- **Where:** `backend/controllers/product.controller.js:487-496`
- **What:** After a product restock, the code iterates watchers in a for-loop, calling `sendNotification()` and `StockWatch.findByIdAndDelete()` per watcher. 50 watchers = 50 notifications + 50 individual deletes, all sequential.
- **Why it matters:** A popular product restock with 500 watchers blocks the request handler for seconds, stalls the event loop, and hammers the DB with 1000 sequential operations.
- **Evidence:** Lines 488–495: `for (const watch of watchers) { await sendNotification(...); await StockWatch.findByIdAndDelete(watch._id); }`
- **Fix:** `await StockWatch.deleteMany({ product_id })` in one query. Batch notification dispatch via `jobQueue.enqueueJob('notify_watchers', ...)` with a single payload containing all watcher IDs.
- **Effort:** small
- **Confidence:** high

---

### [HIGH] Wallet update logic duplicated in 10+ payment controller locations
- **Where:** `backend/controllers/payment.controller.js:55, 80, 365, 865, 902, 992, 1044, 1133, 1249, 1465` (and more)
- **What:** Wallet credit/debit logic (`User.findByIdAndUpdate(..., { $inc: { wallet_balance: amount } })`) is copy-pasted inline at 10+ call sites in `payment.controller.js`, each with slightly different surrounding logic and error handling.
- **Why it matters:** When a new business rule is needed (e.g., "log all wallet changes to an audit table"), each of the 10+ sites must be found and updated individually. Missing one causes silent discrepancies.
- **Evidence:** Grep for `$inc.*wallet_balance` in `payment.controller.js` returns 10+ matches, each a standalone update.
- **Fix:** Extract to `services/wallet.service.js` → `adjustBalance(userId, delta, session, { reference, reason })`. This function updates balance, creates a Transaction record, and emits the wallet event. Replace all inline updates with this call.
- **Effort:** medium
- **Confidence:** high

---

## MEDIUM

---

### [MEDIUM] Eversend webhook signature uses unaudited custom method
- **Where:** `backend/controllers/payment.controller.js:1185-1192`, `backend/services/eversend.service.js`
- **What:** `eversendWebhook` delegates signature verification to `eversend.verifyWebhookSignature()`. The implementation inside `eversend.service.js` is not verified to use constant-time comparison, raising the possibility of timing-based forgery.
- **Why it matters:** A non-constant-time comparison can leak whether the HMAC is partially correct, enabling an attacker to reconstruct a valid signature byte-by-byte.
- **Evidence:** Line 1188: `const isValid = eversend.verifyWebhookSignature(req.body, signature)` — implementation is a black box from the audit's perspective.
- **Fix:** Implement inline using `crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(received))`. Remove delegation to the service for security-critical path.
- **Effort:** small
- **Confidence:** medium

---

### [MEDIUM] User profile endpoint allows unauthenticated enumeration
- **Where:** `backend/controllers/auth.controller.js:593-638`
- **What:** `GET /api/auth/users/:id` returns public profile data for any user ID without rate limiting per requesting user. Any authenticated client can iterate ObjectIDs and build a full user directory.
- **Why it matters:** Bulk user enumeration enables targeted phishing, spam, and scraping of the entire vendor/user database.
- **Evidence:** Lines 596–605 select name, avatar, role, branding — no per-requester rate limit, no business-need check.
- **Fix:** Apply a per-user rate limit (e.g., 60 lookups/hour). Optionally require a "follow" relationship or vendor-buyer relationship before returning profile data.
- **Effort:** medium
- **Confidence:** medium

---

### [MEDIUM] Withdrawal phone number not validated to E.164 spec
- **Where:** `backend/controllers/withdrawal.controller.js:43-54`
- **What:** `toE164()` normalises phone numbers but does not validate the final length (E.164 must be 7–15 digits after the `+`). An over-length number passes server validation, reaches Eversend, is rejected at the gateway, and the withdrawal is stuck.
- **Why it matters:** User's wallet balance may already be deducted before the gateway rejects the request. Manual admin reversal required.
- **Evidence:** Lines 43–54 — normalization without a final format check.
- **Fix:** After normalization, assert: `if (!/^\+[1-9]\d{6,14}$/.test(e164)) return res.status(400).json({ message: 'Invalid phone number' })`.
- **Effort:** small
- **Confidence:** medium

---

### [MEDIUM] No idempotency key for wallet deposit initiation
- **Where:** `backend/controllers/wallet.controller.js:104-134`
- **What:** `initiateDeposit` creates a new Transaction record for every request without checking for a recent duplicate. Network retries from mobile clients create multiple pending transactions for the same intended deposit.
- **Why it matters:** User's payment UI retries on timeout and creates 3 pending transactions. All three may complete if the gateway processes the payment for each. User is charged 3× and credited 3×.
- **Evidence:** Lines 113–121 — `Transaction.create({...})` with no idempotency check.
- **Fix:** Accept an optional `idempotency_key` header. Before creating, check: `Transaction.findOne({ user_id, idempotency_key, createdAt: { $gt: Date.now() - 86400000 } })`. Return the existing transaction if found.
- **Effort:** small
- **Confidence:** medium

---

### [MEDIUM] Admin role changes require no secondary approval
- **Where:** `backend/controllers/admin.controller.js:1208-1228`
- **What:** `updateUserAdmin` allows a single admin to change any user's `role` (including to `admin`) and `verification_status` without logging the change or requiring a second approver.
- **Why it matters:** A compromised admin session or a malicious insider can silently grant admin privileges to an attacker-controlled account.
- **Evidence:** Line 1223: `if (role) user.role = role;` — no audit log written, no approval gate.
- **Fix:** Write an audit log entry for every role change: `{ changedBy: req.user._id, changedUser: user._id, oldRole, newRole, timestamp }`. For promotion to `admin`, require a second admin to confirm via a signed token.
- **Effort:** medium
- **Confidence:** medium

---

### [MEDIUM] Cart stock check vs. order placement race — partial order risk
- **Where:** `backend/controllers/cart.controller.js:105-124`, `backend/controllers/order.controller.js:194-245`
- **What:** Stock is checked when adding to cart and re-checked at order placement. Between the two checks, another order may deplete stock. If the depletion happens mid-order (after some items are reserved), the session is rolled back but the user sees a generic error with no indication of which item failed.
- **Why it matters:** Poor UX and potential abandoned-cart churn. In the worst case, partial rollback edge cases leave orphaned data.
- **Evidence:** Two sequential stock checks without a reservation or advisory lock between them.
- **Fix:** Accept stock changes between cart and checkout as normal e-commerce behaviour. Show a clear error identifying the out-of-stock item(s) so the user can adjust their cart. Add a `pre_checkout_validate` endpoint that returns item-level availability before payment begins.
- **Effort:** medium
- **Confidence:** medium

---

### [MEDIUM] Cascade notifications sent without backpressure or error handling
- **Where:** `backend/controllers/order.controller.js:521-588`
- **What:** 4–6 `sendNotification()` calls are wrapped in `setImmediate()` with no `.catch()`. If the notifier throws, the error is swallowed and the user never receives their order confirmation.
- **Why it matters:** Silent notification failures mean vendors don't know about new orders and buyers don't get confirmation — both reducing trust and causing support load.
- **Evidence:** Lines 527, 548, 563, 578: `setImmediate(async () => { sendNotification(...) })` — no error handling.
- **Fix:** Wrap each `setImmediate` block in `try/catch` and log failures. Better: use `jobQueue.enqueueJob('notify', handler, payload, { attempts: 2 })` to get automatic retry.
- **Effort:** small
- **Confidence:** high

---

### [MEDIUM] Product list cache TTL too long for volatile data
- **Where:** `backend/controllers/product.controller.js:339`
- **What:** Product lists are cached for 60 seconds. Price changes and stock depletions are invisible to users for up to 60 seconds after the fact.
- **Why it matters:** User adds item to cart at cached price; live price is lower/higher; checkout shows a different amount — erodes trust.
- **Evidence:** Line 339: `await cache.set(cacheKey, responseData, 60)` — 60-second TTL.
- **Fix:** Reduce TTL to 10–15 seconds, or implement event-driven invalidation: on product save, publish to a Redis channel and have cache middleware subscribe to invalidate matching keys immediately.
- **Effort:** small
- **Confidence:** medium

---

### [MEDIUM] No rate limit on video upload endpoint
- **Where:** `backend/controllers/upload.controller.js:124-150`
- **What:** The upload endpoint has no per-user rate limit. A single user can upload many large videos in rapid succession, triggering parallel FFmpeg processes on every worker.
- **Why it matters:** 10 concurrent 100 MB video uploads = 10 parallel FFmpeg processes = saturated CPU + disk I/O + potential OOM across all workers.
- **Evidence:** Route handler has no rate-limiter middleware. `rateLimiter.js` defines limiters for auth/OTP/payment but not uploads.
- **Fix:** Add an upload-specific limiter: `rateLimit({ windowMs: 3600_000, max: 5, keyGenerator: req => req.user._id })` applied to the video upload route.
- **Effort:** small
- **Confidence:** medium

---

### [MEDIUM] Background worker no graceful shutdown
- **Where:** `backend/server.js:234-249`, all interval worker services
- **What:** Graceful shutdown drains `jobQueue` but does not clear the `setInterval` timers in `escrowAutoRelease`, `foodAcceptanceTimeout`, and other workers. They continue running until the process is forcibly killed.
- **Why it matters:** An escrow release or food cancellation mid-transaction when SIGTERM arrives may be interrupted, leaving the DB in an inconsistent intermediate state.
- **Evidence:** Worker services start timers but do not export `stop()` functions. `server.js:234-249` calls `drainQueues()` but not `stopWorkers()`.
- **Fix:** Each worker service should export a `stop()` function that calls `clearInterval(timer)`. `server.js` graceful shutdown should call `stop()` on all workers before closing the HTTP server.
- **Effort:** small
- **Confidence:** high

---

### [MEDIUM] Food timeout clawback committed even when refund fails
- **Where:** `backend/services/foodAcceptanceTimeout.service.js:25-126`
- **What:** The worker cancels the order first, then attempts the buyer refund. If the refund throws, the order cancellation is still committed. The buyer's money is unreturned, the order shows cancelled, and no automatic retry is scheduled.
- **Why it matters:** Every refund failure in this path causes silent loss of buyer funds. Admin notification is sent but may be missed.
- **Evidence:** Lines 58–90: cancel + clawback inside one transaction; if clawback fails at line 63, the catch block logs and sends a notification, but the transaction (including the cancel) is still committed at line 90.
- **Fix:** Move the clawback to execute **before** the cancel status update. If clawback fails, abort the entire transaction and leave the order in `pending_acceptance` so the next worker run retries.
- **Effort:** small
- **Confidence:** high

---

### [MEDIUM] Socket auth not re-validated per sensitive event
- **Where:** `backend/sockets/chat.socket.js:287-317, 374-434`
- **What:** JWT is verified only at connection handshake. If a user's `token_version` is bumped (logout on another device), or the account is deactivated, the existing socket session continues processing `send_message` events until the TCP connection drops.
- **Why it matters:** A user who logs out on their web browser remains able to send and receive messages on their phone's open socket indefinitely.
- **Evidence:** `io.use()` at line 287 runs once. `socket.on('send_message')` at line 374 does not re-check auth.
- **Fix:** On `send_message` and other state-changing events, verify the user's `is_active` and `token_version` match the socket's stored values: `const user = await User.findById(socket.userId).select('is_active token_version').lean(); if (!user?.is_active || user.token_version !== socket.tokenVersion) return socket.emit('error', { reason: 'session_expired' })`.
- **Effort:** small
- **Confidence:** medium

---

### [MEDIUM] Redis adapter failure falls back silently in multi-worker setup
- **Where:** `backend/sockets/chat.socket.js:94-108`
- **What:** If the Redis adapter fails to load or Redis is unreachable at startup, `chat.socket.js` logs a warning and continues with the default in-memory adapter. In a multi-process cluster, each worker's in-memory adapter is isolated — messages sent by user A via Worker 1 never reach user B connected to Worker 2.
- **Why it matters:** Chat breaks across workers silently. Users see messages as "sent" (ACK from their worker) but recipients never receive them.
- **Evidence:** Lines 105–107: `.catch((error) => { console.warn('Redis adapter unavailable, falling back to in-memory') })` — no crash, no escalation.
- **Fix:** On adapter failure, either (a) crash the process so the operator is alerted (`process.exit(1)`) or (b) retry every 10 seconds with a circuit breaker before accepting socket connections. At minimum, alert via the logger at ERROR level.
- **Effort:** small
- **Confidence:** medium

---

### [MEDIUM] Intercity order advance cap not atomic
- **Where:** `backend/controllers/order.controller.js:387-395`
- **What:** The cap of 3 simultaneous intercity advances is enforced by counting active orders then inserting. Two concurrent requests both count 2, both proceed, and both insert — resulting in 4 simultaneous advances.
- **Why it matters:** Vendor over-commits financially, taking on more intercity exposure than the cap allows.
- **Evidence:** Lines 387–395: `Order.countDocuments(...)` then later `Order.create(...)` — separate operations.
- **Fix:** Use an atomic findAndModify pattern or move the count check inside the insert transaction with a `$where` or aggregation-based conditional insert.
- **Effort:** medium
- **Confidence:** medium

---

### [MEDIUM] Inconsistent mobile money fee — hardcoded constant vs. env-configurable util
- **Where:** `backend/controllers/order.controller.js:41, 415, 1591`, `backend/utils/mobileMoneyFees.js:1-4`
- **What:** The 50 XAF mobile money collection fee is defined twice: once as a hardcoded constant in `order.controller.js` (line 41) and once as an env-configurable value in `mobileMoneyFees.js`. The controller uses its own constant, ignoring any `MOBILE_MONEY_COLLECTION_FEE_XAF` env var.
- **Why it matters:** Changing the fee via env var has no effect on order creation — the hardcoded value always wins. This creates silent misconfiguration.
- **Evidence:** `order.controller.js:41`: `const MOBILE_MONEY_COLLECTION_FEE_XAF = 50` (hardcoded). `mobileMoneyFees.js:4`: reads `process.env.MOBILE_MONEY_COLLECTION_FEE_XAF || 50`.
- **Fix:** Remove the constant from `order.controller.js`. Import `getMobileMoneyCollectionFee` from `mobileMoneyFees.js` and call it at lines 415 and 1591.
- **Effort:** small
- **Confidence:** high

---

### [MEDIUM] Shipment model missing index on `order_id`
- **Where:** `backend/models/Shipment.model.js:99-100`
- **What:** Shipment has compound indexes on `(vendor_id, status, createdAt)` and `(logistics_id, status, createdAt)` but no index on `order_id` alone. Queries like `Shipment.findOne({ order_id: X })` perform full collection scans.
- **Why it matters:** Order detail pages and status lookups that join shipment data will degrade as the shipment collection grows.
- **Evidence:** Lines 99–100 define the existing indexes. `order_id` is not among them.
- **Fix:** `ShipmentSchema.index({ order_id: 1 })`. Run via `backend/scripts/ensure_indexes.js`.
- **Effort:** trivial
- **Confidence:** medium

---

### [MEDIUM] Logistics zone `ancestors` field has no index
- **Where:** `backend/services/logistics.service.js:214-217`
- **What:** `LogisticZone.find({ $or: [{ _id: cityId }, { ancestors: cityId }] })` performs an `$or` query where the `ancestors` array field has no index.
- **Why it matters:** Zone hierarchy lookups on every food order placement scan the full collection. Slow at scale.
- **Evidence:** Lines 215–217: query on `ancestors` with no index support.
- **Fix:** `LogisticZoneSchema.index({ ancestors: 1 })`.
- **Effort:** trivial
- **Confidence:** medium

---

### [MEDIUM] Orphan detector silently aborts on DB unavailability
- **Where:** `backend/services/orphanDetector.service.js:44, 83-116`
- **What:** If MongoDB is unreachable when the 24-hour scan fires, the detector aborts silently. The next attempt is in another 24 hours. Multiple nested `catch(_) {}` blocks swallow model-specific errors.
- **Why it matters:** Data integrity issues go undetected for up to 24 hours after a DB hiccup.
- **Evidence:** Line 44: `if (mongoose.connection.readyState !== 1) return;`. Lines 83–116: silent `catch` blocks.
- **Fix:** On abort, schedule a retry in 15 minutes. Replace silent `catch` with `logger.warn(...)` so operators can see when checks are being skipped.
- **Effort:** small
- **Confidence:** medium

---

### [MEDIUM] Cache invalidation iterates all keys on every product edit
- **Where:** `backend/controllers/product.controller.js:469-471`, `backend/utils/cache.js:53`
- **What:** On every product update, the code calls `cache.keys()` and iterates the entire in-memory cache Map to find and delete keys with the `products_` prefix.
- **Why it matters:** As the cache grows to hundreds of entries, every product edit triggers O(n) synchronous iteration on the main thread.
- **Evidence:** `product.controller.js:469-471`: `for (const key of cache.keys()) { if (key.startsWith('products_')) await cache.delete(key); }`
- **Fix:** Add `cache.deleteByPrefix(prefix)` as a native method in `cache.js` that maintains a secondary prefix index for O(1) lookup. Or use Redis SCAN with pattern matching.
- **Effort:** small
- **Confidence:** high

---

## LOW

---

### [LOW] Hardcoded support email auto-grants admin role
- **Where:** `backend/controllers/auth.controller.js:84-96`
- **What:** `ensureSupportAdmin` automatically promotes any user whose email matches `support@auradime.com` to the admin role. This promotion happens on every login for that email with no OTP or secondary verification.
- **Why it matters:** If the email is spoofed or the SMTP account compromised, an attacker can register and log in with that address to obtain admin privileges automatically.
- **Evidence:** Lines 84–96: `isSupportAdminEmail(user.email)` check triggers role grant with no further gate.
- **Fix:** Remove the auto-grant. Provision admin accounts via a secure one-time setup script that requires an existing admin or a signed env-var-protected token.
- **Effort:** medium
- **Confidence:** medium

---

### [LOW] Local upload path not canonically validated against uploads root
- **Where:** `backend/controllers/upload.controller.js:195-212`
- **What:** The `uploadDir` is constructed with `path.join(__dirname, '..', 'uploads', folder)` where `folder` is user-supplied. `normalizeS3Folder()` sanitises the input, but the resolved path is not checked to still be within the uploads directory.
- **Why it matters:** If `normalizeS3Folder()` has a gap, crafted folder names could write files outside `uploads/`.
- **Evidence:** Lines 195–204: path construction without final boundary check.
- **Fix:** After constructing the path: `if (!path.resolve(targetPath).startsWith(path.resolve(uploadsRoot))) throw new Error('Invalid upload path')`.
- **Effort:** small
- **Confidence:** low

---

### [LOW] Status enum values differ across Order, Escrow, and Transaction models
- **Where:** `backend/models/Order.model.js:85-89`, `backend/models/Escrow.model.js:34-37`, `backend/models/Transaction.model.js:29-33`
- **What:** Each model defines its own status string literals. There is no shared constants file. `Order.payment_status` has `['pending','paid','refunded','failed']`; `Escrow.status` has `['held','pending_release','released','refunded','disputed']`. These overlap in meaning but differ in spelling.
- **Why it matters:** A developer adding a new status in one model will likely miss the others. Inconsistent string comparisons across controllers cause subtle bugs.
- **Evidence:** Three models, three independently defined enum arrays.
- **Fix:** Create `backend/constants/statusEnums.js` exporting shared enum arrays and import them into all models and controllers.
- **Effort:** small
- **Confidence:** low

---

### [LOW] No centralised audit log for sensitive financial operations
- **Where:** `backend/controllers/wallet.controller.js:263` (calls `logAction()`), most other sensitive controllers do not
- **What:** `AuditLog` model exists and `logAction()` is called in some paths, but withdrawal approvals, escrow releases, platform fee changes, and admin order modifications are not consistently logged.
- **Why it matters:** Without a complete audit trail, forensic investigation of fund discrepancies is impossible and compliance is undermined.
- **Evidence:** `logAction()` called in ~2 places; critical operations in `escrow.controller.js`, `payment.controller.js`, and `admin.controller.js` do not call it.
- **Fix:** Establish a rule: any operation that changes a balance, a user's role, or order money amounts must write an `AuditLog` entry. Add a lint check or PR review checklist item.
- **Effort:** medium
- **Confidence:** low

---

### [LOW] Orphaned files — scratch script and dead test-routes file
- **Where:** `backend/routes/test-routes.js`, `backend/scratch/check_orders.js`
- **What:** `test-routes.js` is never imported anywhere (confirmed by grep). `scratch/check_orders.js` is a one-off debug query script left in the repo.
- **Why it matters:** Confuses future maintainers; `test-routes.js` implies route validation runs on startup when it doesn't.
- **Evidence:** Zero references to `test-routes` or `check_orders` outside their own files.
- **Fix:** Delete both files. If `test-routes.js`'s validation logic is wanted, integrate it into the startup sequence in `server.js`.
- **Effort:** trivial
- **Confidence:** high

---

### [LOW] Order, admin, and payment controllers are 1600–2300 line monoliths
- **Where:** `backend/controllers/order.controller.js` (~2307 lines), `backend/controllers/admin.controller.js` (~1953 lines), `backend/controllers/payment.controller.js` (~1607 lines)
- **What:** All three controllers mix HTTP request handling with business logic, fee calculation, state transitions, and external API calls in a single file.
- **Why it matters:** Changes to one feature risk breaking another. Unit testing individual functions requires loading thousands of lines of context. Merge conflicts are common.
- **Evidence:** Line counts verified.
- **Fix:** Extract domain logic into service modules (`services/order/`, `services/payment/`). Keep controllers as thin request routers. This is a long-term refactor that should be done feature-by-feature.
- **Effort:** large
- **Confidence:** medium

---

### [LOW] Frontend image optimisation config missing backend domain
- **Where:** `web/next.config.js:15-25`
- **What:** `remotePatterns` includes `unsplash`, `google`, and `dicebear` but not the application's own API domain. Product images and vendor logos served from the backend's `/uploads/` path are not processed by Next.js Image Optimisation.
- **Why it matters:** Product images are served uncompressed and uncached via CDN, wasting bandwidth on mobile devices.
- **Evidence:** Lines 15–25 — backend hostname absent from remotePatterns.
- **Fix:** Add `{ protocol: 'https', hostname: '<api-domain>', pathname: '/uploads/**' }` to remotePatterns. Or configure CloudFront to serve the uploads subdomain and add that CDN hostname.
- **Effort:** trivial
- **Confidence:** medium

---

### [LOW] Migrations are ungoverned one-off scripts
- **Where:** `backend/migrations/` (15 scripts, 01–15)
- **What:** Migrations are standalone Node scripts with no runner, no version-tracking table, and no idempotency guard. Re-running a migration (e.g., `01_zone_insert_cities.js`) can insert duplicate data.
- **Why it matters:** New team members don't know which migrations have been applied. Re-runs on a partially migrated database corrupt data.
- **Evidence:** Migration comments: "Prerequisite: run 01 first" — documented manually, not enforced.
- **Fix:** Adopt a lightweight migration runner (e.g., a `migrations_applied` collection in MongoDB recording each run's filename and timestamp). Or use `migrate-mongo` which fits natively.
- **Effort:** medium
- **Confidence:** low

---

*End of findings — 8 CRITICAL, 15 HIGH, 19 MEDIUM, 10 LOW (52 total)*
