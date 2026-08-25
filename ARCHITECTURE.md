# AuraMarket (Auradime) — System Architecture

## Overview

AuraMarket is a multi-sided marketplace platform connecting **customers**, **vendors**, and **logistics companies** in Central/West Africa (primary market: Cameroon, XAF currency). It is delivered as a web app, a PWA, and an Android APK.

```
┌──────────────────────────────────────────────────────────────┐
│                        Clients                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Next.js Web │  │ Android APK  │  │  Admin Browser   │   │
│  │  (PWA)       │  │ (Capacitor)  │  │  (same web app)  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘   │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │   HTTPS / WSS   │                  │
┌─────────▼─────────────────▼──────────────────▼──────────────┐
│               Nginx Reverse Proxy (api.auradime.com)         │
│               proxy_pass → localhost:5000                    │
└─────────────────────────┬────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│                    Express.js API Server                     │
│                    (Node.js 22+, PM2 cluster ×2)             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  REST API   │  │  Socket.io   │  │  Background Jobs │    │
│  │  (33 routes)│  │  (real-time) │  │  (10 workers)    │    │
│  └──────┬──────┘  └──────┬───────┘  └──────────────────┘    │
└─────────┼────────────────┼──────────────────────────────────┘
          │                │
   ┌──────▼──────┐  ┌──────▼──────┐
   │  MongoDB    │  │    Redis    │
   │  (Mongoose) │  │  (Upstash)  │
   └─────────────┘  └─────────────┘
          │
   ┌──────▼──────────────────────────────────────┐
   │  External Services                          │
   │  AWS S3 · PawaPay · Eversend · PayUnit       │
   │  Firebase FCM · Nodemailer (Titan SMTP)     │
   └─────────────────────────────────────────────┘
```

---

## 1. Frontend — `web/`

### 1.1 Framework & Routing

| Concern | Technology |
|---------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | JavaScript |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts |
| Deployment | Vercel (auto-deploy from `main`) |

**App Router structure** (`web/app/`):
- Each directory is a route segment.
- `layout.js` wraps shared chrome (nav, footer, providers).
- `page.js` is the route entry point.
- `loading.js` / `error.js` provide suspense + error boundaries per route.

### 1.2 State Management

```
┌─────────────────────────────────────────┐
│  Zustand stores (web/services/ & hooks) │
│  ├── authStore    – JWT, user object    │
│  ├── cartStore    – cart items count    │
│  └── notifStore   – unread badge        │
└─────────────────────────────────────────┘
         │  consumed by
┌────────▼────────────────────────────────┐
│  React Context (web/context/)           │
│  ├── SocketContext – single WS instance │
│  ├── ChatContext   – chat state         │
│  └── LanguageContext – i18n             │
└─────────────────────────────────────────┘
```

### 1.3 Data Fetching

- **Axios** with a shared instance (`web/services/api.js`) that:
  - Auto-detects environment: `localhost:5000` for dev, `https://api.auradime.com/api/v1` for production.
  - Injects JWT from storage on every request.
  - Client-side GET cache (45 s fast cache + 3-day offline cache via `localStorage`).
  - Retry with exponential backoff (2 retries, base 500 ms).
- Server Components fetch data directly where SEO matters (product listings, store pages).
- Client Components use hook-based fetching or Zustand for interactive data.

### 1.4 Real-time (Client)

- `socket.io-client` connects on auth.
- A single `SocketContext` instance is shared across the component tree.
- Events: `new_message`, `notification`, `order_update`, `typing`, `status_update`.

### 1.5 Mobile / PWA

| Target | Mechanism |
|--------|-----------|
| Android APK | Capacitor wraps the Next.js build |
| iOS (future) | Capacitor (same code) |
| PWA | Web App Manifest + Service Worker (`public/sw.js` v10) |
| Push (web) | Web Push API (VAPID) |
| Push (Android) | Firebase Cloud Messaging (FCM) via Capacitor plugin |

**Service Worker caching strategy** (`public/sw.js`):
- Navigation pages → stale-while-revalidate
- `/_next/static/*` → cache-first (content-hashed, immutable)
- `api.auradime.com` GET → network-first + cache fallback (offline shows last-known data)
- CDN images / media → stale-while-revalidate
- Status videos → full file cached for offline playback + byte-range seek support

---

## 2. Backend — `backend/`

### 2.1 Framework & Structure

```
backend/
├── server.js              # Entry point: Express + Socket.io bootstrap
├── config/
│   ├── database.js        # Mongoose connection (pool: 2–25, heartbeat 10s)
│   ├── redis.js           # ioredis client + Socket.io Redis adapter
│   └── env.js             # Environment validation (required vars + production guards)
├── constants/
│   └── statusEnums.js     # Shared enum definitions across controllers
├── middleware/
│   ├── auth.middleware.js      # JWT verification, role guards
│   ├── rateLimiter.js          # express-rate-limit + Redis store (4 tiers)
│   ├── security.middleware.js  # CORS whitelist, Helmet, input sanitisation
│   └── cache.middleware.js     # Response cache middleware
├── routes/                # 33 route files (see §2.3)
├── controllers/           # Business logic, one file per domain
├── services/
│   ├── escrowAutoRelease.service.js      # Auto-release escrow after 6 h window
│   ├── foodAcceptanceTimeout.service.js  # Restaurant order acceptance deadline
│   ├── disputeWindowEnforcement.service.js
│   ├── cancelRateMonitor.service.js      # Vendor cancel-rate enforcement
│   ├── delayedRiderDispatch.service.js   # Rider assignment retry logic
│   ├── intercityDispatchTimeout.service.js
│   ├── intercityArrivalLapse.service.js
│   ├── avgDeliveryMinutes.service.js     # Hourly delivery time aggregation
│   ├── orphanDetector.service.js         # Data integrity checks + admin alerts
│   ├── wallet.service.js                 # Idempotent wallet credit/debit
│   ├── payment/
│   │   ├── gateway.registry.js           # Active gateway list
│   │   ├── settle.service.js             # Post-payment settlement logic
│   │   └── gateways/
│   │       ├── pawapay.gateway.js        # PawaPay Mobile Money (MTN MoMo / Orange CM)
│   │       ├── eversend.gateway.js
│   │       ├── payunit.gateway.js
│   │       └── flutterwave.gateway.js
│   ├── staleTransactionCleanup.service.js  # Expire/settle stale pending gateway txns
│   ├── eversend.service.js
│   ├── push.service.js                   # Web Push + FCM dispatcher
│   └── jobQueue.service.js               # Bull queue management
├── sockets/
│   └── chat.socket.js     # Socket.io event handlers
├── models/                # 39 Mongoose schemas (see schema.prisma)
├── utils/
│   ├── auditTrail.js      # Admin mutation audit logging
│   ├── claim.js           # Atomic claim helpers
│   ├── locks.js           # Redis-backed distributed locks
│   ├── money.js           # XAF rounding and fee calculation
│   ├── pagination.js      # Cursor/page pagination helpers
│   ├── notifier.js        # Socket.io + Notification doc emitter
│   ├── cache.js           # In-process LRU cache
│   └── s3.js              # AWS S3 upload helpers
└── uploads/               # Multer temp storage before S3 upload
```

### 2.2 Request Lifecycle

```
Client request
  → Nginx (TLS termination, proxy_pass :5000)
  → CORS preflight check (OPTIONS fast-path)
  → Security headers (Helmet + custom)
  → Rate limit check (Redis counter, 4 tiers)
  → Body parser (JSON / multipart)
  → Route matched
  → Auth middleware (JWT decode + role check)
  → Controller
      → Mongoose query
      → Business logic
      → External service call (optional)
  → JSON response
```

### 2.3 API Routes

| File | Prefix | Domain |
|------|--------|--------|
| `auth.routes.js` | `/api/auth` | Login, OTP, token refresh |
| `user.routes.js` | `/api/users` | Profile, addresses, preferences |
| `vendor.routes.js` | `/api/vendors` | Vendor CRUD, onboarding |
| `product.routes.js` | `/api/products` | Product CRUD, variants, search |
| `category.routes.js` | `/api/categories` | Category tree |
| `cart.routes.js` | `/api/cart` | Cart add/remove/clear |
| `order.routes.js` | `/api/orders` | Order placement & tracking |
| `payment.routes.js` | `/api/payments` | Gateway webhooks & initiation |
| `escrow.routes.js` | `/api/escrow` | Release / refund / dispute |
| `wallet.routes.js` | `/api/wallet` | Deposit, balance, history |
| `withdrawal.routes.js` | `/api/withdrawals` | Vendor payout requests |
| `transaction.routes.js` | `/api/transactions` | Ledger read |
| `shipment.routes.js` | `/api/shipments` | Logistics ticket management |
| `logistics.routes.js` | `/api/logistics` | Company profiles, zones |
| `chat.routes.js` | `/api/chat` | Message history REST |
| `notification.routes.js` | `/api/notifications` | In-app notification CRUD |
| `push.routes.js` | `/api/push` | Device subscription management |
| `review.routes.js` | `/api/reviews` | Product reviews |
| `qa.routes.js` | `/api/qa` | Product Q&A |
| `dispute.routes.js` | `/api/disputes` | Dispute lifecycle |
| `refund.routes.js` | `/api/refunds` | Refund requests |
| `coupon.routes.js` | `/api/coupons` | Promo code validation |
| `subscription.routes.js` | `/api/subscriptions` | Plan purchase & status |
| `kyc.routes.js` | `/api/kyc` | Document upload & review |
| `follow.routes.js` | `/api/follows` | Follow / unfollow vendors |
| `wishlist.routes.js` | `/api/wishlist` | Wishlist management |
| `status.routes.js` | `/api/status` | Vendor stories (24-h media) |
| `homepage.routes.js` | `/api/homepage` | Dynamic homepage config |
| `admin.routes.js` | `/api/admin` | Platform-wide admin actions |
| `discovery.routes.js` | `/api/discovery` | Personalised feed |
| `report.routes.js` | `/api/reports` | Abuse reports |
| `currency.routes.js` | `/api/currencies` | Exchange rates |
| `legal.routes.js` | `/api/legal` | ToS / Privacy content |

### 2.4 Authentication

```
OTP Flow (default)
  POST /api/auth/send-otp  →  email OTP (6-digit, bcrypt-hashed)
  POST /api/auth/verify-otp → JWT (access) + refresh token cookie

Password Flow (optional)
  POST /api/auth/register
  POST /api/auth/login

Token Management
  - Access token: 1460d JWT (signed with JWT_SECRET)
  - token_version field on User invalidates all tokens on logout/password change
  - Optional 2FA: TOTP via otplib
```

### 2.5 Real-time — Socket.io

```
Transport: WebSocket (fallback: polling)
Adapter:   socket.io-adapter-redis  →  multi-instance safe (Upstash)

Namespaces / Rooms:
  user:{userId}        – personal notifications
  vendor:{vendorId}    – vendor order alerts
  chat:{userId}        – DM conversations

Key Events (server → client):
  new_message          – chat message delivery
  message_delivered    – delivery receipt
  notification         – in-app alert
  order_status_update  – order pipeline change
  escrow_update        – escrow state change
  status_new           – new vendor story
```

### 2.6 Background Workers (10 services)

| Worker | Trigger | Purpose |
|--------|---------|---------|
| `escrowAutoRelease` | Every 5 min | Release held escrow after 6-hour window |
| `foodAcceptanceTimeout` | Every 2 min | Cancel unaccepted restaurant orders |
| `disputeWindowEnforcement` | Every 10 min | Close expired dispute windows |
| `cancelRateMonitor` | Daily | Flag vendors with high cancellation rates |
| `delayedRiderDispatch` | Every 3 min | Retry rider assignment for stale shipments |
| `intercityDispatchTimeout` | Every 5 min | Escalate unconfirmed intercity dispatches |
| `intercityArrivalLapse` | Every 10 min | Alert on overdue intercity arrivals |
| `avgDeliveryMinutes` | Hourly | Aggregate delivery time metrics per zone |
| `orphanDetector` | Every 30 min | Data integrity checks + admin alerts |
| `staleTransactionCleanup` | Every 30 min | Poll PawaPay for stale deposits; expire 24 h+ pending txns |

---

## 3. Database — MongoDB

### 3.1 Connection

- **Driver**: Mongoose 9 (promise-based)
- **Pool**: min 2 / max 25 connections
- **Heartbeat**: 10 s interval
- **Host**: MongoDB Atlas (shared cluster)

### 3.2 Collection Map (39 collections)

```
Identity & Auth
  users · authotps · kycs

Commerce
  products · categories · carts · orders
  coupons · wishlists · stockwatches · recentlyvieweds

Vendor & Store
  vendors · stores

Financial
  transactions · escrows · withdrawalrequests · refundrequests

Logistics
  logisticscompanies · logisticzones · shipments

Social & Communication
  messages · reviews · questions · follows
  disputes · reports

Notifications
  notifications · pushsubscriptions · emaillogs

Discovery
  useractivities

Vendor Stories
  statuses

Subscriptions
  subscriptionplans · usersubscriptions

Platform
  platformsettings · homepages · homepagesections
  currencies · legals · auditlogs
```

### 3.3 Key Indexes

| Collection | Index | Purpose |
|-----------|-------|---------|
| `products` | `{ name, description, tags }` text | Full-text search |
| `products` | `{ status, purchase_count, view_count }` | Trending sort |
| `orders` | `{ customer_id, createdAt }` | Customer order history |
| `orders` | `{ vendor_id, order_status }` | Vendor dashboard |
| `messages` | `{ sender_id, receiver_id, createdAt }` | Chat thread |
| `transactions` | `{ user_id, createdAt }` | Wallet history |
| `authotps` | `{ expires_at }` TTL (3600 s) | Auto-cleanup |
| `statuses` | `{ expires_at, vendor_id }` | Active story feed |
| `useractivities` | `{ user_id, timestamp }` | Discovery engine |

---

## 4. Cache — Redis (Upstash)

| Usage | Key pattern | TTL |
|-------|------------|-----|
| Rate limit counters | `auradime:rl:{tier}:{ip}` | Per-window |
| Socket.io pub/sub adapter | Internal | — |
| Session / token blocklist | `blocklist:{token}` | Token expiry |
| Product search cache | `search:{query}:{page}` | 5 min |
| Homepage config | `homepage:v1` | 10 min |
| Distributed locks | `lock:{resource}` | Op duration |

**Redis feature flags** (via env):
- `REDIS_CACHE_ENABLED` — in-process cache writes
- `REDIS_RATE_LIMIT_ENABLED` — Redis-backed rate limiting (falls back to memory)
- `REDIS_SOCKET_ENABLED` — Socket.io multi-instance adapter

---

## 5. File Storage — AWS S3

| Asset type | S3 path pattern |
|-----------|----------------|
| Product images | `products/{vendorId}/{uuid}.webp` |
| Vendor logos / banners | `vendors/{vendorId}/logo.webp` |
| Store assets | `stores/{vendorId}/banner.webp` |
| KYC documents | `kyc/{userId}/{type}.jpg` |
| Vendor status media | `statuses/{vendorId}/{uuid}.mp4` |
| Chat images | `chat/{senderId}/{uuid}.jpg` |
| Review photos | `reviews/{reviewId}/{uuid}.jpg` |
| Proof of delivery | `pods/{shipmentId}/{uuid}.jpg` |

- Upload flow: Multer → temp `backend/uploads/` → Sharp resize/compress → S3 PutObject → temp file deleted.
- Lifecycle policy on `statuses/` bucket prefix auto-deletes media after 24 h.
- `AWS_S3_ENABLED=true` required; falls back to local `uploads/` serving when false.

---

## 6. Payment Architecture

```
Customer pays
  │
  ├─ Wallet balance?          → direct debit from User.wallet_balance
  ├─ PawaPay (mobile money)   → USSD push / hosted checkout → webhook → settle
  ├─ Eversend (mobile money)  → Eversend API → webhook → verify → fulfill
  ├─ PayUnit (local CM)       → PayUnit API  → webhook → verify → fulfill
  └─ Pay on delivery          → order placed, payment collected physically

On success
  └─ If escrow_enabled = true:
       Escrow.status = "held"
       Funds locked until:
         a) Customer confirms delivery  → release to vendor
         b) 6-hour auto-release window → escrowAutoRelease worker
         c) Admin force-release or refund
```

**Webhook verification:**
- PawaPay: Content-Digest (SHA-256) + optional ECDSA P-256 signature (RFC-9421)
- Eversend: HMAC-SHA512 signature on raw body
- PayUnit: HMAC-SHA256 signature (`PAYUNIT_WEBHOOK_SECRET`)

**PawaPay specifics:**
- Deposit: USSD push to subscriber phone via `/v2/deposits`
- Checkout: hosted payment page via `/v2/checkouts`
- Payouts (withdrawals): `/v2/payouts` to vendor's MoMo/Orange number
- 4 webhook endpoints: deposit, checkout, refund, payout — all require `express.raw()` before `express.json()`
- Stale cleanup worker polls `/v2/deposits/{id}` for pending txns older than 4 h; hard-expires at 24 h

### 6.1 Commission & Fee Flow

```
Order total_amount
  - platform commission (PlatformSettings.commission_value %)
  - escrow fee (PlatformSettings.escrow_fee_value %)
  - logistics fee (Shipment.price, credited to logistics company)
  = net payout to vendor
```

### 6.2 Wallet Operations

All wallet credit/debit goes through `services/wallet.service.js`:
- **Idempotency**: each operation carries a unique `idempotencyKey` — duplicate requests are detected via Redis lock and return the original result.
- **Atomic updates**: MongoDB `$inc` with optimistic retry prevents race conditions.
- Audit trail written on every balance change.

---

## 7. Subscription Gate

```
User logs in
  → check UserSubscription (role, status, expires_at)
  → if status = active/grace       → full access
  → if status = limited            → read-only / restricted
  → if status = expired/cancelled  → prompt to subscribe
  → if role has no subscription_required (PlatformSettings) → free access
```

---

## 8. Key Design Patterns

| Pattern | Where used |
|---------|-----------|
| **Repository / Service layer** | `services/` wraps Mongoose queries |
| **Event-driven notifications** | Every major state change emits Socket.io + saves Notification doc |
| **Singleton settings** | `PlatformSettings.getSettings()` always returns the one document |
| **Idempotent messaging** | `Message.client_id` prevents duplicate sends on retry |
| **Idempotent wallet ops** | `wallet.service.js` — Redis lock + idempotencyKey deduplication |
| **Distributed locks** | `utils/locks.js` — Redis SET NX PX for cross-instance coordination |
| **Sparse unique indexes** | `User.referral_code`, `AuthOtp`, `PushSubscription` |
| **Soft delete** | `is_active` flag on Store, Category, Coupon, LogisticZone |
| **Audit trail** | `utils/auditTrail.js` records old/new values on every admin mutation |
| **Money handling** | `utils/money.js` — integer XAF arithmetic, no floating point |
| **Pagination** | `utils/pagination.js` — cursor + page helpers used across all list endpoints |
| **Legacy field migration** | Order pre-validate hook normalises legacy payment_method values |

---

## 9. Infrastructure & Deployment

```
Production stack
  ├── EC2 (Amazon Linux 2023)
  │   ├── Node.js 22 + PM2 (cluster mode ×2, auto-restart)
  │   └── Nginx 1.28 (reverse proxy: api.auradime.com → :5000)
  ├── MongoDB Atlas (shared cluster, eu-north-1)
  ├── Redis Upstash (TLS, serverless)
  ├── AWS S3 eu-north-1 (media storage, bucket: aura-market-frontend)
  ├── Next.js on Vercel (auto-deploy from main branch)
  ├── Firebase (FCM for Android push)
  └── Titan SMTP (transactional email, support@auradime.com)

Deploy flow (backend)
  git push → EC2: git pull → npm install → pm2 restart --update-env
  verify:  curl http://localhost:5000/api/health

Deploy flow (frontend)
  git push → Vercel auto-builds → deploys to auradime.com

Build pipeline (mobile APK)
  next build → next export → capacitor sync android → gradle assembleRelease → .apk
```

**Required environment variables** (server refuses to start if missing):
- `MONGODB_URI`
- `JWT_SECRET`
- `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
- `PAYUNIT_WEBHOOK_SECRET`
- `EVERSEND_WEBHOOK_SECRET`

**Optional (PawaPay gateway):**
- `PAWAPAY_API_TOKEN` — Bearer token (gateway disabled when absent)
- `PAWAPAY_SANDBOX_MODE` — `true` for sandbox environment
- `PAWAPAY_WEBHOOK_PUBLIC_KEY` — ECDSA P-256 PEM for full RFC-9421 signature verification
- `PAWAPAY_ENFORCE_IP_ALLOWLIST` — `true` to restrict callbacks to PawaPay egress IPs

**Production guards:**
- `ENABLE_DEBUG_ROUTES=true` is blocked in `NODE_ENV=production` — server exits immediately.

---

## 10. Security Controls

| Control | Implementation |
|---------|---------------|
| JWT authentication | `jsonwebtoken`, 1460-day tokens + `token_version` invalidation |
| OTP brute-force protection | `attempts` + `cooldown_until` on AuthOtp |
| Rate limiting | `express-rate-limit` + Redis — 4 tiers: api / strict / public / video |
| Password hashing | `bcryptjs` (cost factor 12) |
| Input sanitisation | `express-mongo-sanitize` + custom control-char stripper |
| Prototype pollution guard | Key blocklist (`__proto__`, `prototype`, `constructor`) on all inputs |
| CORS | Whitelist-only origins; `*.auradime.com` wildcard; private IPs allowed |
| Security headers | `helmet` + custom (`Cross-Origin-Resource-Policy: cross-origin`) |
| Role-based access | Middleware guards on every protected route |
| KYC gating | Vendors must pass KYC before listing products |
| Subscription gating | Vendors/logistics require active subscription |
| Audit logging | `utils/auditTrail.js` — all admin actions persisted to AuditLog |
| Webhook verification | Content-Digest + ECDSA (PawaPay) / HMAC-SHA512 (Eversend) / HMAC-SHA256 (PayUnit) |
| Debug route guard | `ENABLE_DEBUG_ROUTES=true` blocked in production at startup |

---

## 11. Test Suite

```
backend/tests/
├── integration/    # 39 files — full HTTP round-trip tests per domain
├── concurrency/    # Race condition tests (wallet, escrow, orders)
├── unit/           # Pure logic + property-based tests (fast-check)
├── factories/      # Test data builders (15 factories)
├── helpers/        # Auth tokens, money assertions, gateway mocks, time helpers
├── setup/          # App bootstrap, DB seeding, Redis mock
└── globalSetup.js  # MongoDB memory server lifecycle

Coverage: 525+ tests across 42+ files (vitest + supertest)
Run:      cd backend && npm test

Notable test files:
  - tests/unit/money.property.test.js   — 10 fast-check properties for financial math
  - tests/integration/webhooks.test.js  — PawaPay, Eversend, PayUnit webhook security + idempotency
```

---

## 12. Operations & Admin Scripts

### 12.1 Financial Invariant Checks (`jobs/invariants.js`)

30 read-only MongoDB queries that verify data integrity. Run on-demand or scheduled nightly:

```
node scripts/run-invariants.js
```

Key invariants:
- **INV-01** Ledger sum matches `user.wallet_balance`
- **INV-03** Every paid order has ≥1 completed Transaction
- **INV-04** `order.total_amount == subtotal + shipping_fee + collection_fee`
- **INV-12** Full-refund dispute → `order.payment_status == refunded`
- **INV-15** All completed withdrawals have `balance_deducted = true`
- **INV-21** No negative wallet balance

### 12.2 Migration / Fix Scripts

| Script | Purpose |
|--------|---------|
| `scripts/cancel-stale-payout-txns.js` | Cancel orphan pending payout txns left by refund disputes (idempotent, `--dry-run` safe) |
| `scripts/reconcile-wallet-balances.js` | Recompute wallet balances from ledger and credit missing amounts (`--dry-run` safe) |
| `scripts/run-invariants.js` | Run all 30 invariant checks and print report |
