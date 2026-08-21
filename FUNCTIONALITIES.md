# AuraMarket (Auradime) — Complete Feature & Functionality Reference

> Roles: **customer** · **vendor** · **logistics** · **admin**
> All features below are fully implemented unless marked `[planned]`.

---

## 1. Authentication & Identity

### 1.1 OTP-based Login (default)
- User enters email → receives a 6-digit OTP via email
- OTP is bcrypt-hashed in `AuthOtp` collection and expires after 1 hour (TTL index)
- Brute-force protection: `attempts` counter + `cooldown_until` enforces back-off
- Rate window: `send_count` / `send_window_start` limits resend spam
- On successful verification → JWT access token issued + `verified_at` recorded

### 1.2 Password-based Login (optional)
- Traditional email + password flow
- Passwords hashed with bcryptjs (cost 12) via Mongoose pre-save hook
- `comparePassword()` instance method used for verification

### 1.3 Two-Factor Authentication (2FA)
- TOTP via `otplib`; secret stored encrypted in `User.two_factor_secret`
- Enabled/disabled per user via settings

### 1.4 Token Management
- Short-lived JWT signed with `JWT_SECRET`
- `token_version` field on User; incrementing it invalidates all existing tokens (global logout)
- Password reset: `reset_password_token` + `reset_password_expires` with email delivery

### 1.5 OAuth / Social Login
- `auth_provider` field supports future extension (currently `email_otp` | `password`)

### 1.6 Role System
- Four platform roles: `customer`, `vendor`, `logistics`, `admin`
- Role guards enforced at middleware level on every protected route

---

## 2. User Management

### 2.1 Profile
- Name, email, phone, avatar (S3 URL)
- Personal branding: logo + banner (for vendor-mode users)
- Multi-address book: label, street, city, region, quartier, isDefault flag

### 2.2 Preferences
- `preferred_currency`: XAF · USD · EUR · NGN · GHS
- `preferred_language`: en · fr · sw · ha
- `liked_categories`: used to personalise discovery feed (set during onboarding)

### 2.3 Onboarding Flow
- First-login wizard sets location, liked categories, delivery area
- `onboarded` flag gates the wizard; `onboarding_location` stores city + quartier

### 2.4 Referral Programme
- Each user gets a unique `referral_code` (format: `AURA-xxxxxx`)
- `referred_by` links referrer chain; referral rewards tracked via `loyalty_points`

### 2.5 Loyalty Points
- `loyalty_points` balance earned through purchases and referrals
- Redeemable at checkout (future: configurable conversion rate)

### 2.6 Verification Status
- `unverified` → `pending` → `verified` | `rejected` | `held`
- `held` used when account is flagged for review without full suspension

### 2.7 Account Deletion (GDPR)
- `/account-deletion` page; data purge workflow

### 2.8 Presence Tracking
- `is_online` / `last_seen` updated on socket connect/disconnect

---

## 3. Vendor Management

### 3.1 Vendor Onboarding (4-step wizard)
1. **profile** — store name, description, phone, pickup address
2. **kyc** — document upload (see §3.2)
3. **store_setup** — logo, banner, categories, delivery time, minimum order
4. **complete** — `is_onboarded = true`; store goes live

### 3.2 KYC Verification
- Supported documents: national ID, passport, driver's licence, utility bill
- Upload: front image (required), back image (optional), selfie holding ID
- Admin reviews → `approved` | `rejected` with feedback note
- KYC gates product listing

### 3.3 Store Profile
- Logo, banner (S3-hosted, WebP-optimised)
- Category list, delivery time string, minimum order amount
- `is_active` toggle (admin or vendor can deactivate)
- Commission rate override per store (overrides platform default)

### 3.4 Vendor Dashboard Metrics
- `total_sales`, `total_revenue` counters on Vendor document
- `rating` (aggregate of product reviews), `follower_count`
- `average_response_time` shown to buyers in chat

### 3.5 Vendor Stories (Status)
- Vendor posts image / video / text stories (WhatsApp-style)
- Expire automatically after 24 hours (TTL index on `expires_at`)
- Linked product card embedded in story
- Viewers list, reaction emoji (heart default), like count
- Segmented multi-clip video support (`segment_start`, `segment_end`, `segment_index`)
- S3 lifecycle policy auto-deletes media after expiry

### 3.6 Subscription Requirement
- Vendors must hold an active `UserSubscription` to list products
- Grace period configurable per role in `PlatformSettings`
- Status states: `pending → active → grace → limited → expired`

---

## 4. Product Catalogue

### 4.1 Product CRUD
- Name (≤150 chars), description (≤2000), long_description, specifications
- Price, compare-at price, sale price, `on_sale` flag
- Multiple images (S3), each with optional alt text
- Category (string), tags (lowercase array) — both full-text indexed
- Stock quantity, featured flag

### 4.2 Product Status Workflow
`draft` → `pending` (admin review) → `active` | `suspended`
`active` → `archived` (vendor deactivates)

### 4.3 Product Variants
- `has_variants` flag enables the variant system
- `variant_types[]`: define axes (Size, Color, etc.) with options + optional metadata (hex colours)
- `sku_variants[]`: price, sale_price, compare_at_price, stock, sku, image per combination
- Variant selection persisted in cart and order items

### 4.4 Discovery Metrics
Each product tracks: `view_count`, `purchase_count`, `wishlist_count`, `cart_additions`
Used by the discovery engine for "trending" and "popular" surfaces.

### 4.5 Full-text Search
MongoDB text index on `name`, `description`, `tags`
Route: `GET /api/products?q=keyword`

### 4.6 Filtering & Sorting
Filter by: category, vendor, status, price range, on_sale, featured
Sort by: newest, price asc/desc, rating, purchase_count, view_count

### 4.7 Categories
- Hierarchical: parent_id links sub-categories to parents
- Slug for SEO-friendly URLs
- Icon field (icon name or URL)
- `order` for manual homepage sorting
- Admin can activate/deactivate

---

## 5. Shopping Cart

- One cart per user (upsert pattern)
- Items: product reference + quantity + optional variant selection
- Cart persists across sessions (server-side, not localStorage)
- `cart_additions` counter incremented on every add (used for discovery)

---

## 6. Checkout & Order Placement

### 6.1 Multi-vendor Checkout
- A single basket with products from multiple vendors creates one **Order per vendor**
- Each order independently tracked through its own status machine

### 6.2 Pricing Breakdown per Order
- `subtotal` (line items)
- `shipping_fee` (from logistics zone pricing or vendor flat rate)
- `collection_fee` (platform fee for managed pickup)
- `total_amount` (sum)

### 6.3 Coupon / Promo Code
- Applied at checkout, validated by `Coupon.isValid(orderAmount)`
- Supports percentage or fixed discount, min order threshold, max discount cap
- Vendor-scoped or platform-wide
- `used_count` / `max_uses` enforces usage limits

### 6.4 Delivery Address
- Buyer selects from saved addresses or enters inline
- Address embedded on order: street, city, region, quartier, country, phone, email
- `delivery_description` for additional instructions

### 6.5 Shipping Method
- `vendor_managed` — vendor arranges their own delivery
- `logistics_partner` — platform-registered logistics company assigned

---

## 7. Order Management

### 7.1 Order Status Machine
```
placed → processing → shipped → delivered → completed
       ↘ cancelled
       ↘ refund_pending → refunded
```

### 7.2 Customer View
- Order history with full item breakdown
- Real-time status updates via Socket.io + push notification
- "Confirm delivery" action triggers escrow release

### 7.3 Vendor View
- New order alert (Socket.io + push)
- Accept → update to `processing`
- Mark as shipped → update to `shipped` + optional tracking number
- Cancel order (before processing)

### 7.4 Order Tracking
- `tracking_number` field (vendor-provided or logistics-generated)
- Full shipment ticket with logs if logistics_partner used (see §8)

---

## 8. Logistics & Shipment

### 8.1 Logistics Company Registration
- Linked to a User with `role = logistics`
- Profile: company name, contact, service regions, vehicle types (motorcycle/car/van/truck)
- Logo + banner
- Admin verifies (`is_verified`) before the company can receive jobs

### 8.2 Zone & Quartier Management
- `LogisticZone` provides geographic hierarchy: **region → quartier**
- Each logistics company sets `quartier_prices[]` (per-neighbourhood delivery fee)
- `supported_pickup_regions[]` lists where they can collect from vendors

### 8.3 Shipment Ticket Lifecycle
```
pending → assigned → picked_up → in_transit → out_for_delivery → delivered
                                                               ↘ failed
                   ↘ cancelled
```
- `tracking_code` format: `AURA-xxxxxx`
- `shipment_logs[]` records every status change with timestamp + note + actor
- `estimated_delivery` date set by logistics company
- Proof of delivery: image URL, note, receiver name, timestamp
- Failure reasons: unreachable | wrong address | other

### 8.4 Logistics Dashboard
- View all assigned shipments filtered by status
- Update shipment status + upload proof of delivery

### 8.5 Logistics Fee Settlement
- On delivery confirmation, `Escrow.logistics_settled` flag prevents double-payment
- Shipping fee credited to logistics company's wallet balance

---

## 9. Payment System

### 9.1 Payment Methods
| Method | Description |
|--------|-------------|
| **Wallet** | Deducted from `User.wallet_balance` instantly |
| **Eversend** | Mobile money across Africa (MTN, Orange, Airtel, etc.) |
| **Flutterwave** | Multi-currency card & mobile money |
| **PayUnit** | Local Cameroon payment aggregator |
| **Pay on delivery** | Order placed; payment collected physically |

### 9.2 Wallet System
- Each user has a `wallet_balance` on the User document
- Top up via any payment gateway
- Spend on orders, subscriptions
- Transaction ledger: `Transaction` collection tracks every credit/debit
- Transaction types: deposit · withdrawal · payment · refund · escrow_release · payout · subscription

### 9.3 Webhook Flow
```
Gateway fires webhook
  → verify signature
  → find/create Transaction (reference is unique)
  → credit wallet / mark order paid
  → emit Socket.io + create Notification
```

### 9.4 Withdrawal (Vendor Payout)
- Request: amount (min 500 XAF), currency, method (momo/bank/eversend), recipient details
- Status flow: `pending → approved → completed | failed`
- Admin reviews queue → triggers payout via Eversend or PayUnit
- Balance reserved on submission; restored if rejected/failed
- `WithdrawalRequest` stores full audit: reviewed_by, reviewed_at, rejection reason

---

## 10. Escrow System

### 10.1 How It Works
1. Buyer pays → funds held in Escrow (`status = held`)
2. Vendor ships → Escrow stays held
3. Buyer confirms delivery → Escrow released to vendor (`released_by = customer`)
4. **If buyer does nothing after delivery**: 6-hour auto-release timer (`auto_release_at`)
5. `escrowWorker` background job fires → releases funds (`released_by = auto`, `auto_released = true`)
6. Admin can force-release or force-refund at any time (`released_by = admin`)

### 10.2 Dispute Path
- Buyer or vendor opens a `Dispute` before auto-release window closes
- Escrow status → `disputed`
- Admin investigates → chooses resolution: full_refund | release_payment | partial_refund | return_and_refund
- AuditLog records the resolution

### 10.3 Logistics Fee Settlement
- When shipment is delivered, logistics fee is credited from escrow first
- `logistics_settled` flag prevents double-credit

---

## 11. Dispute Resolution

- Initiator (buyer or vendor) opens dispute with reason + description + evidence images
- Reasons: item_not_received · item_not_as_described · faulty_item · unauthorized_transaction · other
- Status: `pending → investigating → resolved | cancelled`
- Admin posts resolution type and notes
- `/dispute-policy` page documents the SLA and process

---

## 12. Refund System

- Buyer submits `RefundRequest` against a specific order
- Vendor can add feedback; admin can override
- Status: `pending → approved | rejected`
- On approval: order `order_status → refunded`, escrow `status → refunded`, wallet credited

---

## 13. Real-time Chat (DM)

### 13.1 Messages
- Bidirectional DMs between any two users (customer ↔ vendor, customer ↔ logistics)
- Text messages, image attachments (S3-hosted)
- **Product Card** sharing: `product_reference` renders a buy-now card inside the chat

### 13.2 Delivery & Read Receipts
- `delivered_status` / `delivered_at` set when recipient has an active socket
- `read_status` set when recipient opens the conversation

### 13.3 Soft Delete
- `deleted_for[]` array allows per-user message deletion (only hidden for that user)
- `deleted_everyone = true` removes message for all parties

### 13.4 Idempotency
- `client_id` (client-generated UUID) prevents duplicate messages on network retry

### 13.5 Real-time
- Socket.io `new_message` event delivers instantly
- Fallback: REST `GET /api/chat/history` for inbox

---

## 14. Product Reviews & Q&A

### 14.1 Reviews
- Verified-purchase only: `order_id` required (prevents fake reviews)
- Rating 1–5, text comment (≤500 chars), optional review photos
- One review per user/product/order triplet (unique index)
- Vendor rating auto-recalculated from product ratings

### 14.2 Product Q&A
- Any user can post a question on a product page
- Vendor (or admin) can post a public answer
- `is_public` flag hides sensitive Q&A from storefront
- Vendor notified of new questions via notification

---

## 15. Notifications

### 15.1 In-app Notifications
- Stored in `Notification` collection per recipient
- Types: order_status · order_update · payment_received · wallet_update · chat_alert · message · system_alert · vendor_update · promo
- `is_read` flag; batch mark-all-read endpoint

### 15.2 Push Notifications
- **Web Push** (VAPID): service worker receives push even when app is closed
- **Firebase FCM**: Android APK (via Capacitor plugin)
- `PushSubscription` stores endpoint + keys (Web) or FCM token (Android)
- One subscription per device/endpoint per user

### 15.3 Email Notifications
- Sent via Nodemailer (Titan SMTP) or Resend
- `EmailLog` records every outgoing email for audit/debug

### 15.4 WhatsApp-style Push Logic
- Push always fired except when recipient is actively viewing the specific chat
- Prevents notification spam for live conversations

---

## 16. Social Features

### 16.1 Follow / Unfollow Vendors
- `Follow` collection (user_id + vendor_id, unique)
- `Vendor.follower_count` cache updated on follow/unfollow
- Followed vendors appear in discovery feed

### 16.2 Wishlist
- One wishlist per user; stores array of Product ObjectIds
- `Product.wishlist_count` incremented/decremented
- Used by discovery engine to surface popular products

### 16.3 Stock Watch (Back-in-stock Alerts)
- User watches an out-of-stock product
- When vendor updates stock > 0, push/email notification sent to all watchers

### 16.4 Abuse Reporting
- Report target types: user · vendor · product · message
- Reasons: scam_fraud · prohibited_item · offensive_content · counterfeit · harassment · other
- Admin review queue; actions: reviewed | action_taken | dismissed

---

## 17. Discovery & Personalisation

### 17.1 Discovery Feed
- `GET /api/discovery` returns personalised product grid
- Signals used: `UserActivity` (views, searches, purchases), `liked_categories` from onboarding, recently followed vendors

### 17.2 Recently Viewed
- Last ~20 viewed products per user tracked in `RecentlyViewed`
- Shown as a "Continue browsing" row on homepage and product pages

### 17.3 Trending Products
- Products sorted by `purchase_count DESC, view_count DESC` within a time window
- Surfaced in HomepageSection of type `trending`

### 17.4 User Activity Tracking
- Events logged: view · search · wishlist · purchase · cart_add · vendor_visit
- Metadata: time_spent, platform, device
- Powers the personalisation ML model (future) and current rule-based ranking

---

## 18. Homepage CMS

### 18.1 Legacy Homepage
- `Homepage` document (singleton, version = "v1")
- Hero banners with image, link, display order, active flag
- Featured products list with display order

### 18.2 Modular Section System (current)
- `HomepageSection` documents, each typed and ordered
- Section types: hero · categories · featured_products · trending · promo_banner · stores · collection · recommendations · footer_promo
- Each section has flexible `config` map (grid vs carousel, autoplay, item count)
- `data[]` array carries the actual items (banners, product refs, vendor refs, category refs)
- Scheduling: `scheduled_start` / `scheduled_end` for time-gated campaigns

### 18.3 Admin CMS Controls
- Admin creates, reorders, activates/deactivates sections
- Changes reflected on homepage immediately (Redis cache invalidated)

---

## 19. Subscription Plans

### 19.1 Plan Management (Admin)
- Create plans with name, slug, price, currency, billing_cycle (one_time/monthly/yearly)
- `duration_days` for fixed-term plans
- `roles[]` restricts which user types can purchase
- `features[]` flexible JSON array for feature flags
- `contact_required` for enterprise/custom plans

### 19.2 User Subscription Lifecycle
```
pending → active (payment confirmed)
active  → grace  (expired, grace period active)
grace   → limited (grace expired, restricted access)
limited → expired (after restriction period)
active  → cancelled (manual cancel)
```

### 19.3 Subscription Source
Wallet · Eversend · PayUnit · manual (admin grant) · admin

### 19.4 Subscription History
Full action log embedded on each UserSubscription (who did what and when)

---

## 20. Platform Administration

### 20.1 Financial Settings (PlatformSettings — singleton)
- Commission: type (percentage/amount), value
- Escrow fee: type, value
- Withdrawal fee (flat)
- Minimum withdrawal amount
- Platform wallet balance (accumulated commissions)
- Subscription required per role, grace days per role

### 20.2 Currency Management
- Add/edit currencies with ISO code, symbol, rate-to-base (XAF is base)
- Rates used for display conversion (checkout always transacts in XAF)

### 20.3 Legal Content Management
- CRUD for Terms of Service, Privacy Policy, Cookie Policy, Vendor Agreement
- Versioned with `version` string; `is_active` serves current version
- Content is HTML or Markdown, rendered on corresponding policy pages

### 20.4 KYC Review Queue
- Admin sees pending KYC submissions with uploaded documents
- Approve → sets vendor `verified = true`; Reject → sends feedback

### 20.5 Withdrawal Review Queue
- Admin reviews `pending` withdrawal requests
- Approve → triggers Eversend/PayUnit payout API
- Reject → restores user balance + sends reason

### 20.6 Dispute Management
- List disputes by status; view evidence
- Post admin_notes; select resolution_type; resolve

### 20.7 Report Management
- Review flagged content; take action (warn, suspend, ban); dismiss

### 20.8 Vendor Management
- Activate/suspend vendor accounts
- Override commission rate per store
- Manually trigger escrow release or refund

### 20.9 Audit Log
- Every admin or vendor data mutation recorded:
  - `user_id`, `action`, `target_type`, `target_id`
  - `changes.old` / `changes.new` (before/after snapshot)
  - `metadata.ip`, `user_agent`, `resource_url`
- Immutable (no update/delete routes for AuditLog)

---

## 21. Progressive Web App (PWA)

- `manifest.json` with icons, theme colour, display mode
- Service Worker caches shell + static assets; serves offline page
- `/install` page with platform-specific install instructions
- `/offline` page shown when network unavailable
- Web Push subscription managed via `PushSubscription` model

---

## 22. Android App (Capacitor)

- Built from the same Next.js codebase
- Build pipeline: `next export → capacitor sync → gradle assembleRelease`
- FCM push notifications via `@capacitor/push-notifications`
- Deep links handled by Capacitor
- Released as `auradime-release.apk`

---

## 23. Security & Compliance

| Feature | Detail |
|---------|--------|
| OTP brute-force protection | Attempts counter + exponential cooldown |
| Rate limiting | Per-IP + per-route, configurable via env |
| Input sanitisation | express-mongo-sanitize (NoSQL injection), xss-clean |
| CORS | Whitelist-only origins |
| Security headers | Helmet (CSP, HSTS, X-Frame-Options, etc.) |
| Password hashing | bcryptjs, cost factor 12 |
| JWT token invalidation | token_version field global logout |
| KYC identity check | Document + selfie verification before trading |
| Escrow protection | Funds held until confirmed delivery |
| Dispute resolution | Formal admin-mediated process |
| Prohibited items list | `/prohibited-items` policy page |
| GDPR account deletion | `/account-deletion` with data purge |
| Audit trail | AuditLog for all admin/vendor mutations |

---

## 24. Email Notifications (Triggered)

| Trigger | Recipient |
|---------|----------|
| OTP send | User |
| Order placed | Customer + Vendor |
| Order status change | Customer |
| Payment received | Vendor |
| KYC reviewed | Vendor |
| Withdrawal approved/rejected | Vendor/User |
| Dispute opened | Both parties + Admin |
| Dispute resolved | Both parties |
| Refund processed | Customer |
| Subscription activated/expired | User |
| New message (offline) | Recipient |

---

## 25. Vendor-Specific Pages & Flows

| Page/Flow | Description |
|-----------|------------|
| `/vendor` | Vendor dashboard (orders, revenue, products) |
| `/vendor-policy` | Seller terms and platform rules |
| `/subscribe` | Subscription plan selection and payment |
| Vendor onboarding wizard | 4-step guided setup |
| Product create/edit | Full product form with variant builder |
| Order management | Accept, ship, cancel orders |
| Withdrawal request | Payout request form |
| Status creation | Story upload (image/video/text) |
| Store customisation | Banner, logo, categories, delivery info |

---

## 26. Customer-Specific Pages & Flows

| Page/Flow | Description |
|-----------|------------|
| `/` (homepage) | Dynamic CMS-driven landing page |
| `/products` | Product grid with search + filters |
| `/discovery` | Personalised product feed |
| `/stores` | Vendor store directory |
| `/brands` | Brand / vendor listing |
| `/collections` | Curated product collections |
| `/cart` | Shopping cart with coupon input |
| `/checkout` | Address, shipping, payment selection |
| `/orders` | Order history + tracking |
| `/messages` | Chat inbox |
| `/wallet` | Balance, top-up, transaction history |
| `/wishlist` | Saved products |
| `/profile` | Account settings |
| `/notifications` | Notification centre |
| `/referral` | Referral programme dashboard |
| `/signature-drops` | Exclusive limited-release products |
| `/status` | Vendor story feed (WhatsApp-style) |

---

## 27. Help & Legal Pages

| Page | Content |
|------|---------|
| `/help` / `/help-center` | FAQ and support resources |
| `/contact` | Contact form |
| `/chat` | Live support chat |
| `/terms-of-service` | ToS (served from Legal collection) |
| `/privacy-policy` | Privacy policy |
| `/refund-policy` | Refund rules and SLA |
| `/dispute-policy` | Dispute process documentation |
| `/vendor-policy` | Vendor rules |
| `/logistics-policy` | Logistics company terms |
| `/prohibited-items` | Banned product categories |
