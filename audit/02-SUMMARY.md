# AuraMarket — Audit Summary

**Generated:** 2026-08-19
**Full findings:** `audit/01-FINDINGS.md`
**Codebase map:** `audit/00-MAP.md`

---

## 1. Overall Health Assessment

AuraMarket is a feature-complete, multi-sided marketplace with a large surface area (43 models, 37 route files, 22 background workers, real-time sockets, 4 payment gateways, Capacitor mobile builds) and a small engineering team. The architecture choices are largely reasonable, and the codebase is active and well-commented. However, it has **seven concurrent correctness bugs that affect money** — stock races, coupon races, wallet balance overwrites, escrow double-release, floating-point currency, missing webhook idempotency, and no PayUnit signature verification. Any one of these is enough to cause real financial loss in production today. Beyond money correctness, the system's background workers and in-memory job queue are not safe for PM2 cluster mode, meaning financial operations (escrow releases, food refunds) can run simultaneously on multiple processes and corrupt state. The security posture is weakened by a 4-year JWT default, a CORS wildcard for all Vercel-hosted apps, and hardcoded VAPID fallback keys. Performance is generally adequate but three blocking patterns — FFmpeg on the main thread, axios calls without timeouts, and sequential stock queries in a loop — are crash vectors under moderate load. The codebase needs focused, sequenced remediation rather than a rewrite.

---

## 2. Counts by Severity and Category

| Severity | A Security | B Correctness | C Data Layer | D Performance | E Reliability | F Maintainability | Total |
|----------|-----------|---------------|-------------|--------------|--------------|-------------------|-------|
| CRITICAL | 2 | 4 | — | 1 | — | — | **7** |
| HIGH | 4 | 2 | 2 | 3 | 4 | 2 | **17** |
| MEDIUM | 5 | 4 | 2 | 3 | 5 | — | **19** |
| LOW | 2 | 2 | — | 1 | — | 4 | **9** |
| **Total** | **13** | **12** | **4** | **8** | **9** | **6** | **52** |

---

## 3. Top 10 Fixes Ranked by Impact ÷ Effort

| # | Finding | Impact | Effort | Why now |
|---|---------|--------|--------|---------|
| 1 | **Add PayUnit webhook signature verification** | Money injection via forged webhooks | trivial | One `crypto.createHmac` check. Eliminates a fake-payment backdoor. |
| 2 | **Add axios timeouts to Paystack & Eversend** | Entire payment system hangs on gateway downtime | trivial | One-line `timeout: 10_000` per call. Prevents event-loop stall. |
| 3 | **Make idempotent webhook processing atomic** (`findOneAndUpdate` on `status: 'pending'`) | Double wallet credits on gateway retry | small | Replaces 3 read-then-write patterns. Required at all three gateways. |
| 4 | **Fix coupon usage counter** (atomic `findOneAndUpdate` with `$lt` guard) | Single-use coupons used unlimited times | small | One targeted change in `order.controller.js`. |
| 5 | **Add graceful shutdown to interval workers** (export `stop()`, clear timers) | Mid-transaction interruption on deploy | small | Trivial `clearInterval` calls. Required for safe rolling restarts. |
| 6 | **Remove VAPID fallback hardcoded keys** (make env vars required) | Arbitrary push notification injection | small | Delete two fallback strings, add to `validateEnv()`. |
| 7 | **Fix food timeout worker** — move clawback before cancel in same transaction | Silent buyer funds loss on failed refund | small | Reorder two operations in `foodAcceptanceTimeout.service.js`. |
| 8 | **Restrict CORS** — remove `*.vercel.app` wildcard, replace with explicit domain allowlist | CSRF from attacker-controlled Vercel forks | small | Replace wildcard check with hardcoded production domain. |
| 9 | **Fix stock deduction race** — atomic `findOneAndUpdate` with `$gte` guard | Overselling, negative stock | medium | Replace for-loop read-modify-write with single bulk atomic update. |
| 10 | **Fix escrow double-release** — claim record atomically before `finalizeEscrowPayout` | Double vendor payout | medium | One `findOneAndUpdate` status guard before calling finalize. |

---

## 4. The 3 Systemic Root Causes

### Root Cause 1 — "Read-modify-write" is the default pattern for all state mutations

The codebase consistently reads a document, mutates it in memory, then saves it. This is seen in stock deduction (order.controller), coupon usage (order.controller), wallet balance updates (22+ locations across wallet/payment/escrow controllers), and escrow status transitions. The pattern is not safe under any concurrent workload and will produce corrupted financial data in production. This is not a one-off oversight — it is the architectural default. The fix is also systematic: a team-wide rule that **no financial field is ever mutated with read-modify-write**; all such mutations must use `$inc`, `$set` with a conditional filter, or a `findOneAndUpdate` that returns null on a conflicting state.

### Root Cause 2 — In-process state is used for distributed concerns

The job queue, socket delivery retry map, worker "running" flags, and typing state maps are all held in Node.js process memory. PM2 runs the server in cluster mode with multiple processes, each holding its own independent copy of this state. This means background workers run simultaneously across processes (escrow, food timeout, orphan detector all fire on every worker), socket delivery retries are lost on worker restart, and job queue items disappear when a process dies. The fix requires moving all shared state to Redis: job queue (BullMQ), distributed worker locks (`SET NX EX`), and socket retry state (Redis List with TTL). This is a significant architecture change but the Redis infrastructure already exists — it just isn't used for these concerns.

### Root Cause 3 — External dependencies are called without defensive wrappers

Axios calls to Paystack, Eversend, and PayUnit have no timeouts. Workers have no retry/backoff. The in-memory job queue has no persistence and no dead-letter path. The cash-flow through the system (payment gateway → webhook → wallet credit → escrow release → vendor payout) has no circuit breaker at any point. When any external service (gateway, SMTP, Redis) is slow or unreachable, the failure propagates immediately to the user or silently drops the operation. The fix is defensive wrappers: axios instances with `timeout` and retry logic, worker operations wrapped in `enqueueJob` with `attempts: 3`, and circuit breakers on payment gateway clients.

---

## 5. What Could Not Be Audited

| Gap | Reason |
|-----|--------|
| Actual `.env` values | File exists but contains live credentials; contents intentionally not read |
| Paystack / Eversend / PayUnit gateway-side configuration | External services; no API access |
| `eversend.service.js` `verifyWebhookSignature` implementation | Not read in depth by the security agent; flagged as medium-confidence |
| Frontend TypeScript types vs. API reality | The frontend is JavaScript; no `.ts` interface files exist for most API responses |
| Android/Capacitor native code | `web/android/` Java/Gradle code not audited |
| Infrastructure / network layer | No access to cloud config (AWS IAM, S3 bucket policies, CloudFront distribution settings, VPC) |
| Test coverage | `backend/tests/` was not read in detail; test completeness is unknown |
| Database actual index state | Indexes are declared in schemas but whether `ensure_indexes.js` has been run in production is unknown |
| Third-party dependency CVEs | `npm audit` was not run; dependency vulnerability check was not in scope for this pass |

---

*To continue: run Prompt 2 (Security Deep Dive) and Prompt 4 (Data Layer Deep Dive) against the worst-scoring areas before fixing anything. Approve fixes one work item at a time per Prompt 8.*
