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
│                    Express.js API Server                     │
│                    (Node.js 22+, PM2)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  REST API   │  │  Socket.io   │  │  Background Jobs │    │
│  │  (33 routes)│  │  (real-time) │  │  (Bull queues)   │    │
│  └──────┬──────┘  └──────┬───────┘  └──────────────────┘    │
└─────────┼────────────────┼─────────────────────────────────-─┘
          │                │
   ┌──────▼──────┐  ┌──────▼──────┐
   │  MongoDB    │  │    Redis    │
   │  (Mongoose) │  │  (ioredis)  │
   └─────────────┘  └─────────────┘
          │
   ┌──────▼──────────────────────────────────────┐
   │  External Services                          │
   │  AWS S3 · Flutterwave · Eversend · PayUnit   │
   │  PayUnit · Firebase FCM · Nodemailer/Resend │
   └─────────────────────────────────────────────┘
```

---

## 1. Frontend — `web/`

### 1.1 Framework & Routing

| Concern | Technology |
|---------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript / JavaScript |
| Styling | Tailwind CSS 4 |
| Animations | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts |

**App Router structure** (`web/app/`):
- Each directory is a route segment.
- `layout.tsx` wraps shared chrome (nav, footer, providers).
- `page.tsx` is the route entry point.
- `loading.tsx` / `error.tsx` provide suspense + error boundaries per route.

### 1.2 State Management

```
┌─────────────────────────────────────────┐
│  Zustand stores (web/context/ or hooks) │
│  ├── authStore    – JWT, user object    │
│  ├── cartStore    – cart items count    │
│  └── notifStore   – unread badge        │
└─────────────────────────────────────────┘
         │  consumed by
┌────────▼────────────────────────────────┐
│  React Context (web/context/)           │
│  └── SocketContext – single WS instance │
└─────────────────────────────────────────┘
```

### 1.3 Data Fetching

- **Axios** with a shared instance (`web/lib/api.ts`) that injects the JWT from storage on every request.
- Server Components fetch data directly where SEO matters (product listings, store pages).
- Client Components use SWR-style hooks or Zustand for interactive data.

### 1.4 Real-time (Client)

- `socket.io-client` connects on auth.
- A single `SocketContext` instance is shared across the component tree.
- Events: `new_message`, `notification`, `order_update`, `typing`, `status_update`.

### 1.5 Mobile / PWA

| Target | Mechanism |
|--------|-----------|
| Android APK | Capacitor wraps the Next.js build |
| iOS (future) | Capacitor (same code) |
| PWA | next-pwa + Web App Manifest + Service Worker |
| Push (web) | Web Push API (VAPID) |
| Push (Android) | Firebase Cloud Messaging (FCM) via Capacitor plugin |

---

## 2. Backend — `backend/`

### 2.1 Framework & Structure

```
backend/
├── server.js              # Entry point: Express + Socket.io bootstrap
├── config/
│   ├── database.js        # Mongoose connection (pool: 2–25, heartbeat 10s)
│   ├── redis.js           # ioredis client + Socket.io Redis adapter
│   └── env.js             # Zod-validated environment schema
├── middleware/
│   ├── auth.js            # JWT verification, role guards
│   ├── rateLimiter.js     # express-rate-limit + Redis store
│   ├── cors.js            # CORS whitelist
│   └── security.js        # Helmet, sanitization
├── routes/                # 33 route files (see §2.3)
├── controllers/           # Business logic, one file per domain
├── services/
│   ├── escrowWorker.js    # Auto-release escrow after 6 h window
│   ├── paymentService.js  # Gateway abstraction layer
│   ├── emailService.js    # Nodemailer / Resend wrapper
│   └── pushService.js     # Web Push + FCM dispatcher
├── sockets/
│   └── chat.js            # Socket.io event handlers
├── models/                # 39 Mongoose schemas (see schema.prisma)
└── uploads/               # Multer temp storage before S3 upload
```

### 2.2 Request Lifecycle

```
Client request
  → CORS check
  → Helmet security headers
  → Rate limit check (Redis counter)
  → Body parser (JSON / multipart)
  → Route matched
  → Auth middleware (JWT decode + role check)
  → Controller
      → Mongoose query
      → Business logic
      → External service call (optional)
  → JSON response
  → Winston request log
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
  - Access token: short-lived JWT (signed with JWT_SECRET)
  - token_version field on User invalidates all tokens on logout/password change
  - Optional 2FA: TOTP via otplib
```

### 2.5 Real-time — Socket.io

```
Transport: WebSocket (fallback: polling)
Adapter:   socket.io-adapter-redis  →  multi-instance safe

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

---

## 3. Database — MongoDB

### 3.1 Connection

- **Driver**: Mongoose 9 (promise-based)
- **Pool**: min 2 / max 25 connections
- **DNS**: Google 8.8.8.8 for SRV resolution
- **Heartbeat**: 10 s interval

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

## 4. Cache — Redis

| Usage | Key pattern | TTL |
|-------|------------|-----|
| Rate limit counters | `rl:{ip}:{route}` | Per-window |
| Socket.io pub/sub adapter | Internal | — |
| Session / token blocklist | `blocklist:{token}` | Token expiry |
| Product search cache | `search:{query}:{page}` | 5 min |
| Homepage config | `homepage:v1` | 10 min |

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

---

## 6. Payment Architecture

```
Customer pays
  │
  ├─ Wallet balance?         → direct debit from User.wallet_balance
  ├─ Eversend (mobile money)  → Eversend API → webhook → verify → fulfill
  ├─ Flutterwave              → Flutterwave checkout → webhook → verify → fulfill
  ├─ PayUnit (local CM)       → PayUnit API → webhook → verify → fulfill
  └─ Pay on delivery          → order placed, payment collected physically

On success
  └─ If escrow_enabled = true:
       Escrow.status = "held"
       Funds locked until:
         a) Customer confirms delivery  → release to vendor
         b) 6-hour auto-release window → escrowWorker releases
         c) Admin force-release or refund
```

### 6.1 Commission & Fee Flow

```
Order total_amount
  - platform commission (PlatformSettings.commission_value %)
  - escrow fee (PlatformSettings.escrow_fee_value %)
  - logistics fee (Shipment.price, credited to logistics company)
  = net payout to vendor
```

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
| **Sparse unique indexes** | `User.referral_code`, `AuthOtp`, `PushSubscription` |
| **Soft delete** | `is_active` flag on Store, Category, Coupon, LogisticZone |
| **Audit trail** | AuditLog records old/new values on every admin mutation |
| **Legacy field migration** | Order pre-validate hook normalises legacy payment_method values |

---

## 9. Infrastructure & Deployment

```
Production stack
  ├── Node.js 22 + PM2 (cluster mode, auto-restart)
  ├── MongoDB Atlas (or self-hosted replica set)
  ├── Redis (Upstash or self-hosted)
  ├── AWS S3 (media storage)
  ├── Next.js on Vercel (or self-hosted)
  ├── Firebase (FCM for mobile push)
  └── SMTP via Titan / Resend (transactional email)

Build pipeline (mobile)
  next build → next export → capacitor sync android → gradle assembleRelease → .apk
```

---

## 10. Security Controls

| Control | Implementation |
|---------|---------------|
| JWT authentication | `jsonwebtoken`, short-lived access tokens |
| OTP brute-force protection | `attempts` + `cooldown_until` on AuthOtp |
| Rate limiting | `express-rate-limit` + Redis (per IP + per route) |
| Password hashing | `bcryptjs` (cost factor 12) |
| Input sanitisation | `express-mongo-sanitize`, `xss-clean` |
| CORS | Whitelist-only origins |
| Security headers | `helmet` |
| Role-based access | Middleware guards on every protected route |
| KYC gating | Vendors must pass KYC before listing products |
| Subscription gating | Vendors/logistics require active subscription |
| Audit logging | All admin actions persisted to AuditLog |
