# Step 12 — Web Pages (Discovery) ✅

**Status:** In Progress
**Date Completed (Discovery):** 2026-03-13

---

## Overview
This step focuses on building the core pages of the Aura Market web platform. We started with the **Discovery / Home Page**, which serves as the entry point for users to explore products and vendors.

---

## Files Created / Modified

| File | Description |
|------|-------------|
| `web/services/api.js` | Axios instance configured for backend connectivity. Includes a request interceptor to attach JWT tokens to every request automatically. |
| `web/components/ProductCard.js` | A reusable, glassmorphism-styled component for displaying individual products. Includes price, rating, vendor name, and quick actions (Chat/Cart). |
| `web/app/page.js` | Transformed the static landing page into a dynamic Discovery Feed. Fetches admin-curated featured products and trending products from the backend APIs. |
| `web/components/layout/TopNav.js` | Global navigation bar with search and notification hooks. |
| `web/components/layout/BottomNav.js` | Mobile-exclusive navigation bar that dynamically changes based on the user's role (Customer, Vendor, Admin, Logistics). |

---

## Technical Details

### 1. Dynamic Discovery Logic
The Home page now acts as a "Discovery Feed":
- **Featured Section:** Queries `/api/admin/homepage` to retrieve the list of products explicitly hand-picked by the platform administrators.
- **Trending Section:** Queries `/api/products` with sorting and limiting parameters to show the newest/most relevant items.
- **Loading States:** Implemented skeleton-style loading placeholders to maintain a premium feel while data is being fetched.

### 2. Role-Based Navigation
The `BottomNav` component (visible on mobile) is built to be role-aware. 
- **Customer:** Discovery, Cart, Messages, Profile.
- **Vendor:** Discovery, Cart, My Store, Account.
- **Admin:** Discovery, Cart, Admin Panel, Account.
- **Logistics:** Discovery, Cart, Deliveries, Account.

### 3. Store Page
The Store Page (`web/app/stores/[id]/page.js`) provides a high-fidelity brand presence for vendors.
- **Visuals:** Implements thick glassmorphism panels for store info, floating over a full-width brand banner.
- **Dynamic Content:** Fetches specific vendor data and their associated product catalog in real-time.
- **Verification:** Automatically displays "Verified Vendor" badges based on backend verification status.
- **Filters:** Includes a premium UI for category selection and grid/list view toggling.

---

## Next Sub-Steps within Step 12
👉 **Product Page:** Create Product page with images carousel, description, price, stock, buy now button, chat vendor button.
👉 **Cart Page:** Create Cart page with product list, total amount, checkout button, payment selection.
...and more as per roadmap.
