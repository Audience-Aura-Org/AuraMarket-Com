# Aura Market Development Roadmap & Checklist

This document tracks the step-by-step development of Aura Market. Follow the order strictly.

## Phase 1: Backend Development

- [x] **Step 1: Backend Setup** ✅ — [📄 View Details](./step1-backend-setup.md)
  - **Prompt:** Create a Node.js backend project for Aura Market with Express and MongoDB. Include MVC folders: config, models, controllers, routes, middleware, services, sockets. Setup environment variables, database connection, and basic server.js with error handling middleware.
  - **Expected Output:** Base backend project with folders and working server.
  - **Status:** Server running, MongoDB Atlas connected ✅

- [x] **Step 2: User System** ✅ — [📄 View Details](./step2-user-system.md)
  - **Prompt:** Create User model with fields: name, email, password, role (customer, vendor, logistics, admin), phone, wallet_balance, verification_status, created_at. Generate auth controller for register, login, JWT authentication, and role-based middleware.
  - **Expected Output:** User model, auth routes, login/register working.
  - **Status:** Registration and Login APIs successfully tested, roles implemented ✅

- [x] **Step 3: Vendor & Store System** ✅ — [📄 View Details](./step3-vendor-store.md)
  - **Prompt:** Create Vendor model with: user_id, store_name, description, rating, verified, subscription_plan. Create Store model with: vendor_id, banner, logo, followers, categories. Generate controllers and routes for Vendor CRUD and Store management.
  - **Expected Output:** Vendors can register, stores can be created and managed.
  - **Status:** Complete. Vendors separated from Stores conceptually via mongoose virtuals, backed natively by session-based atomicity ✅

- [x] **Step 4: Product System** ✅ — [📄 View Details](./step4-product-system.md)
  - **Prompt:** Create Product model with: vendor_id, name, description, price, images, category, tags, stock, featured, created_at. Generate CRUD API endpoints, search endpoint, and ability to mark featured products.
  - **Expected Output:** Product CRUD API ready; featured products flag working.
  - **Status:** Complete. Advanced text search, pagination, and secure RBAC guarding (Vendor soft-deletes + Admin featured flags) functional ✅

- [x] **Step 5: Order System** ✅ — [📄 View Details](./step5-order-system.md)
  - **Prompt:** Create Order model with: customer_id, vendor_id, products, total_amount, payment_method, shipping_method, order_status, tracking_number. Generate order controller and routes with payment integration (direct or escrow) and order status updates.
  - **Expected Output:** Customers can place orders; order status tracks workflow.
  - **Status:** Complete. Atomic cart checkout securely subtracts inventory natively. Cross-origin route protections enforce strict scoping ✅

- [x] **Step 6: Wallet System** ✅ — [📄 View Details](./step6-wallet-system.md)
  - **Prompt:** Create Wallet and Transaction models. Features: deposit funds, withdraw funds, pay for orders, view transaction history. Include admin approval for withdrawals.
  - **Expected Output:** Wallet management with deposit, withdraw, pay, transaction history.
  - **Status:** Complete. Transactional double-spend protections functioning natively. Admin payout approvals strictly partitioned ✅

- [x] **Step 7: Escrow System** ✅ — [📄 View Details](./step7-escrow-system.md)
  - **Prompt:** Create Escrow service. Flow: customer pays → funds held → vendor ships → delivery confirmed → funds released. Include hold, release, and refund functions.
  - **Expected Output:** Escrow workflow implemented.
  - **Status:** Complete. Strict transactions enforce Hold -> Release loops mapping directly to Wallet schema ledgers natively ✅

- [x] **Step 8: Chat System** ✅ — [📄 View Details](./step8-chat-system.md)
  - **Prompt:** Create realtime chat system using Socket.io. Models: Message with sender_id, receiver_id, text, product_reference, read_status. Features: send/receive messages, product card in chat, read receipts.
  - **Expected Output:** Customers can chat with vendors in real-time and send product cards.
  - **Status:** Complete. Socket.io mapping dynamically to User IDs natively. Advanced Aggregation pulls inbox history directly effectively ✅

- [x] **Step 9: Logistics System** ✅ — [📄 View Details](./step9-logistics-system.md)
  - **Prompt:** Create LogisticsCompany and Shipment models. Features: delivery request, shipment tracking, delivery status updates. Vendors can assign shipments to logistics partners.
  - **Expected Output:** Logistics functionality available.
  - **Status:** Complete. Atomic Order mapping synchronizes status updates explicitly tracking delivery lifecycles cleanly ✅

- [x] **Step 10: Admin Homepage Control** ✅ — [📄 View Details](./step10-admin-system.md)
  - **Prompt:** Create admin API to manage homepage. Features: upload/change homepage banner, select featured products, schedule featured products, reorder display. Include admin dashboard endpoints to approve/reject featured products.
  - **Expected Output:** Admin API functional; frontend can query homepage settings.
  - **Status:** Complete. Singleton pattern implemented explicitly alongside dual-layered `Product` featured flag syncing universally securely mapped ✅

## Phase 2: Web Frontend Development

- [x] **Step 11: Web Frontend Setup** ✅ — [📄 View Details](./step11-web-setup.md)
  - **Prompt:** Create Next.js frontend project for Aura Market. Setup TailwindCSS and Poppins font. Create folder structure: components, pages, hooks, services, styles. Use glassmorphism / liquid glass UI design.
  - **Expected Output:** Next.js project running with custom styling available.
  - **Status:** Complete. Next.js App Router cleanly booted mapping Tailwind v4 specifically wrapping premium Poppins UI layouts securely ✅

- [ ] **Step 12: Web Infrastructure & Logic** — [📄 View Details](./frontend-logic-map.md)
  - [x] **Global State Management:** Implemented Zustand Auth store for persistent sessions and role-based logic. ✅
  - [x] **Service Layers:** Built out functional API wrappers for Wallet, Orders, and Escrow. ✅
  - [x] **Real-time Plumbing:** Connected Socket.IO client for chat functionality. ✅
  - [x] **Logic Integration:** Finalize hooks for Image Uploads, Product management. ✅
  - [x] **Data Hooks:** Finalize Address Management and Admin analytics logic. ✅
  - [x] **Functional Pipes:** Build out Shipping Provider hooks and Notification Service logic. ✅

---

## 🏗️ Pre-Screen Foundation
Before coding the final UI/UX designs, we are addressing the critical infrastructure gaps identified in the [Missing Features Checklist](./missing-features-checklist.md).

---

## Phase 3: Mobile App Development

- [ ] **Step 13: Mobile App Setup**
  - **Prompt:** Create React Native mobile app for Aura Market. Setup bottom tab navigation: Stores, Discovery, Cart, Wallet, Profile. Glassmorphism / liquid glass UI, Poppins font.
  - **Expected Output:** Mobile app scaffold with tab navigation.

- [ ] **Step 14: Mobile Screens**
  - [ ] **Discovery Screen:** Create mobile Discovery screen with product feed, trending products, featured products from admin, buy and chat buttons.
  - [ ] **Store Screen:** Create mobile Store screen with banner, logo, product list, follow button, categories filter.
  - [ ] **Product Screen:** Create mobile Product screen with images, description, price, stock, buy now, chat vendor.
  - [ ] **Cart Screen:** Create mobile Cart screen with checkout flow and payment options.
  - [ ] **Wallet Screen:** Create mobile Wallet screen with balance, deposit, withdraw, transaction history.
  - [ ] **Profile Screen:** Create mobile Profile screen with order history, addresses, settings.
  - [ ] **Chat Screen:** Create mobile Chat screen similar to WhatsApp with product card sharing and payment link.
  - [ ] **Order Tracking Screen:** Create mobile Order Tracking screen with shipment status, tracking number, estimated delivery.

## Summary Checklist

### Backend
1. [ ] Setup
2. [ ] User
3. [ ] Vendor/Store
4. [ ] Product
5. [ ] Order
6. [ ] Wallet
7. [ ] Escrow
8. [ ] Chat
9. [ ] Logistics
10. [ ] Admin Homepage

### Web
1. [ ] Setup
2. [ ] Discovery
3. [ ] Store
4. [ ] Product
5. [ ] Cart
6. [ ] Wallet
7. [ ] Profile
8. [ ] Admin Dashboard

### Mobile
1. [ ] Setup
2. [ ] Tab navigation
3. [ ] Discovery
4. [ ] Store
5. [ ] Product
6. [ ] Cart
7. [ ] Wallet
8. [ ] Profile
9. [ ] Chat
10. [ ] Order Tracking

⚡ **Important:** Execute one prompt at a time in this exact order. Verify each module before moving to the next.
