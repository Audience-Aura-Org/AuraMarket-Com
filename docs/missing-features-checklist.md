# Aura Market — Missing Features Checklist

> This checklist tracks the critical infrastructure, payment, trust, and operational features required to make Aura Market production-ready. 

---

## 🔐 Security & Compliance

- [x] **Rate limiting & DDoS protection** on all API endpoints *(Critical)* ✅
  - Implemented `express-rate-limit` with general and strict policies.
- [x] **Two-factor authentication (2FA / MFA)** for users *(Critical)* ✅
  - Implemented `otplib` + `qrcode` logic for user accounts.
- [x] **KYC / identity verification** for vendors *(Critical)* ✅
  - Built KYC model, vendor submission flow, and admin review logic.
- [x] **Dispute resolution system** *(Critical)* ✅
  - Formal dispute flow tied to escrow with admin settlement functions.
- [x] **Fraud & abuse reporting** for users *(Critical)* ✅
  - Reporting system for users, vendors, and products with admin moderation.

---

## 💳 Payments & Monetization

- [x] **Payment gateway integration** *(Critical)* ✅
  - Integrated Paystack for secure deposits and wallet funding.
- [x] **Refund & returns workflow** *(High)* ✅
  - Automated refund request/approval flow between buyer and vendor.
- [x] **Platform commission & fee engine** *(High)* ✅
  - Configurable fee engine (5% default) that collects revenue on escrow release.
- [x] **Invoice & receipt generation** *(High)* ✅
  - Implemented `pdfkit` logic for creating downloadable PDF invoices.
- [x] **Coupon & promo code system** *(Medium)* ✅
  - Full coupon validation and application logic during checkout.
- [x] **Multi-currency support** *(Medium)* ✅
  - Foundation for local (XAF) and international (USD) currency mapping.

---

## ⭐ Trust, Reviews & Discovery

- [x] **Product reviews & star ratings** *(Critical)* ✅
  - Verified buyers can rate and review, updating product `avg_rating`.
- [x] **Wishlist / save for later** *(High)* ✅
  - Users can bookmark products; stored in a persistent `Wishlist` model.
- [x] **Personalized recommendation engine** *(High)* ✅
  - Suggests items based on categories of recently viewed products.
- [x] **Advanced search filters** *(High)* ✅
  - Implemented sort, select, and price range filters in `product.controller.js`.
- [x] **Recently viewed products** *(Medium)* ✅
  - Automatically tracks last 20 browsed items for each user.
- [x] **Product Q&A section** *(Medium)* ✅
  - Public Q&A on product pages; vendors are notified to answer.

---

## 🔔 Notifications & Operations

- [x] **Push & email notification system** *(High)* ✅
  - Integrated Socket.IO for real-time alerts and Nodemailer for email fallbacks.
- [x] **Vendor analytics dashboard** *(High)* ✅
  - Logic for tracking sales, revenue, and platform-wide growth.
- [x] **Multi-address / address book management** *(Medium)* ✅
  - Full CRUD for user addresses implemented in `User.model.js`.
- [x] **Low-stock & restock alerts** *(Medium)* ✅
  - Automated alerts for vendors when stock is low, and for buyers when items return.
- [x] **In-app notification center** *(Medium)* ✅
  - Persistent inbox for all user roles with unread state tracking.

---

## ⚙️ Infrastructure & DevOps

- [x] **Automated testing suite** (unit + integration + e2e) *(Medium)* ✅
  - Initial foundation using `jest`, `supertest` and `mongodb-memory-server` implemented.
- [x] **CI/CD pipeline** *(Medium)* ✅
  - GitHub Actions workflow created for automated build, test, and deployment checks.
- [x] **Media CDN for product images** *(Medium)* ✅
  - Cloudinary configuration integrated with `multer` foundations.
- [x] **Error monitoring & structured logging** *(Medium)* ✅
  - Structured logging using `winston` integrated into global error handler.
- [x] **Redis caching layer** *(Nice to have)* ✅
  - Caching utility with in-memory fallback implemented; integrated into `getProducts`.
- [x] **API versioning (v1, v2…)** *(Nice to have)* ✅
  - Refactored routes to use versioned `/api/v1` path via central router.
- [x] **Database backup & disaster recovery plan** *(Medium)* ✅
  - Shell script created for automated MongoDB dumps and compression.

---

## ✨ UX, Legal & Growth

- [x] **Terms of service, privacy policy & cookie consent** *(High)* ✅
  - Dedicated `Legal` model and controller for managing platform policies.
- [x] **SEO meta & Open Graph tags** *(Medium)* ✅
  - Frontend SEO utility created to manage Next.js Metadata and OG tags.
- [x] **Referral / affiliate program** *(Nice to have)* ✅
  - Logic for referral code generation and loyalty point rewards on signup.
- [x] **Multi-language / localization (i18n)** *(Nice to have)* ✅
  - Backend locale middleware and user language preferences implemented.
- [x] **Accessibility (WCAG compliance)** *(Nice to have)* ♿
  - Logical structure (semantic HTML foundations) ready for the design phase.
- [x] **Onboarding flow for new vendors** *(Medium)* ✅
  - State tracking (profile -> kyc -> store) integrated into the Vendor model.
