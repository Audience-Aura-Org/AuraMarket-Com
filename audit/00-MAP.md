# AuraMarket — Codebase Map

**Generated:** 2026-08-19
**Stack:**
- Frontend: Next.js 16.1.6 (App Router), React 19, Tailwind CSS 4, Zustand, Capacitor (Android/iOS)
- Backend: Express 5.2.1, Node.js ≥22
- Data: MongoDB 9 / Mongoose 9.3, Redis (ioredis)
- Realtime: Socket.io 4.8.3 (with Redis adapter)
- Infra: PM2, AWS S3 + CloudFront, Vercel (web), Paystack / Eversend / PayUnit / Flutterwave

---

## Directory Tree

```
AuraMarket/
├── backend/
│   ├── config/             # database.js, env.js, redis.js, s3-lifecycle.json
│   ├── controllers/        # 37 controllers
│   ├── middleware/         # auth, cache, errorHandler, locale, rateLimiter, security, subscription
│   ├── models/             # 43 Mongoose models
│   ├── routes/             # 37 route files + v1.router.js
│   ├── services/           # 22 business-logic/worker services
│   │   └── payment/        # gateway.registry, settle.service, 4 gateways
│   ├── sockets/            # chat.socket.js
│   ├── utils/              # cache, email, invoiceGenerator, logger, media, multer, notifier, platformFees, s3, storage, videoCompression …
│   ├── scripts/            # 40+ ad-hoc scripts (seed, sync, migration)
│   ├── tests/
│   ├── migrations/
│   ├── uploads/
│   └── logs/
├── web/
│   ├── app/                # Next.js App Router pages (100+ pages)
│   ├── components/         # account, admin, auth, common, dine, homepage, hub, layout, logistics, vendor …
│   ├── hooks/              # useAuth, useFetch, useFollow, useHydration, useKeyboardHeight, useNotifications, use-toast, useWalletBalance
│   ├── context/            # ChatContext, LanguageContext, ThemeContext, UploadQueueContext
│   ├── lib/                # formatting, logistics, navigation, native-push, nativeVideoCapture, nativeVideoPlayer, productImageUpload, pwa-helper, statusVideoExport
│   ├── constants/          # statusCategories, statusConfig, statusVideo
│   ├── data/               # legalPolicies.js
│   ├── public/
│   └── android/            # Capacitor Android project
└── audit/                  # This folder
```

---

## Entry Points

| Layer | File |
|-------|------|
| Backend | `backend/server.js` → `backend/index.js` |
| Frontend | `web/app/layout.js` → `web/app/page.js` |
| PM2 | `backend/ecosystem.config.js` |
| Next.js | `web/next.config.js` |

---

## Backend Bootstrap Sequence (`server.js`)

1. Load + validate env (`config/env.js`)
2. Connect MongoDB (`config/database.js`)
3. Verify SMTP
4. Initialise Express + middleware stack
5. Attach Socket.io (with Redis adapter)
6. Start 10+ background workers
7. Mount routes (`routes/v1.router.js`)
8. Attach error / 404 handlers
9. Listen on PORT

---

## Route Files

```
backend/routes/
  v1.router.js            address      admin       auth
  cart                    category     chat        coupon
  debug                   dine         discovery   dispute
  escrow                  homepage     legal       logistics
  notification            order        payment     product
  push                    qa           report      reservation
  restaurant              review       security    status
  subscription            test-routes  tracking    upload
  users                   vendor       wallet      wishlist
  withdrawal
```

---

## Models (43)

User, Vendor, Store, Follow, UserActivity, KYC
Product, Category, Review, Wishlist, RecentlyViewed, StockWatch, Question
Order, Cart, Coupon, Escrow, RefundRequest, Dispute, Report
Transaction, WithdrawalRequest, SubscriptionPlan, UserSubscription
Shipment, LogisticsCompany, LogisticZone, PickupPoint, IntercityRate
RestaurantProfile, Reservation
Message, Notification, PushSubscription
AuthOtp, AuditLog, EmailLog, PlatformSettings, Legal, Homepage, HomepageSection, Status, Currency

---

## Middleware Chain

```
security.middleware.js   → CORS, helmet-like headers
locale.middleware.js     → language detection
rateLimiter.js           → express-rate-limit (+ Redis store)
auth.middleware.js       → JWT verification
cache.middleware.js      → Redis response cache
subscription.middleware.js → plan checks
errorHandler.js          → global error handler
notFound.js              → 404 handler
```

---

## Background Workers

| Service | Trigger | Purpose |
|---------|---------|---------|
| escrowAutoRelease | interval | Auto-release held payments |
| foodAcceptanceTimeout | interval | Cancel unaccepted food orders |
| disputeWindowEnforcement | interval | Close dispute windows |
| cancelRateMonitor | interval | Track vendor cancel rates |
| orphanDetector | interval | Detect stuck orders |
| intercityDispatchTimeout | interval | Intercity order timeouts |
| avgDeliveryMinutes | interval | Rolling delivery stats |
| delayedRiderDispatch | interval | Assign riders with delay |
| intercityArrivalLapse | interval | Intercity arrival checks |
| orderSync | interval | Sync order state |

---

## Payment Gateways

- Paystack (card, mobile money)
- Eversend (multi-currency, mobile money)
- PayUnit (local)
- Flutterwave (card, mobile money)
- Internal Wallet (balance deduction)

---

## Key Environment Variables

```
JWT_SECRET, JWT_EXPIRES_IN
MONGODB_URI, REDIS_URL
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
PAYSTACK_SECRET_KEY, EVERSEND_CLIENT_SECRET, FLUTTERWAVE_SECRET_KEY
VAPID_PRIVATE_KEY, FIREBASE_SERVICE_ACCOUNT_JSON
EMAIL_HOST, EMAIL_USER, EMAIL_PASS
```
