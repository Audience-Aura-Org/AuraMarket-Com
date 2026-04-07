# Frontend Infrastructure — "The Plumbing" ✅

**Status:** Infrastructure Complete  
**Date:** 2026-03-13

---

## Overview
As requested, we have shifted away from visual UI/UX development to focus entirely on the **functional infrastructure**. This ensures that the "stitching" of the application—authentication, real-time communication, and financial services—is fully operational and ready to be plugged into your custom designs when they are finalized.

---

## 🛠️ Core Infrastructure Modules

### 1. Global State Management (`hooks/useAuth.js`)
*   **Architecture**: Built using `zustand` with persistent storage.
*   **Capabilities**:
    *   Maintains user session across browser refreshes.
    *   Handles `login`, `register`, and `logout` logic.
    *   Exposes `isAuthenticated` and `user.role` for dynamic UI routing.

### 2. Real-time Gateway (`services/socket.js`)
*   **Architecture**: Singleton class wrapping the `socket.io-client`.
*   **Capabilities**:
    *   Automatic authentication handshake using JWT.
    *   Event listeners for `receive_message` and `read_receipt`.
    *   Centralized `sendMessage` dispatcher.

### 3. Financial Services (`services/wallet.js` & `services/orders.js`)
*   **Infrastructure**: Fully optimized Axios wrappers for backend endpoints.
*   **Capabilities**:
    *   **Wallet**: Fetches balances and history; handles withdrawal requests.
    *   **Checkout**: Orchestrates the 3-step lifecycle: `Create Order` -> `Wallet Payment` -> `Escrow Release`.

### 4. Media & Catalog (`services/upload.js` & `services/products.js`)
*   **Infrastructure**: Handles binary file streams and complex CRUD.
*   **Capabilities**:
    *   **Image Handling**: Multi-part form uploads for product galleries and store banners.
    *   **Product CRUD**: Full lifecycle management for vendor listings (Create, Read, Update, Archive).

### 5. Identity & Governance (`services/address.js` & `services/admin.js`)
*   **Infrastructure**: Deep user profile mapping and platform-wide analytics.
*   **Capabilities**:
    *   **Address Management**: Multi-address profiles for shipping and billing with default toggling.
    *   **Admin Dashboard**: Platform-wide health stats (Users, Volume, Escrow status) and verification controls.

### 6. Logistics & Alerts (`services/logistics.js` & `services/notifications.js`)
*   **Infrastructure**: Physical asset tracking and real-time user engagement.
*   **Capabilities**:
    *   **Shipment Tracking**: Assigning orders to firms and tracking granular status updates (Picked up, Transit, Delivered).
    *   **Event Notifications**: Real-time push alerts for any platform event (Status shifts, new messages, payment confirmation).

---

## 🔗 Architecture Summary
Your frontend is now "wired up."
*   **API Client**: `services/api.js` (Handles JWT & Base URL).
*   **State Store**: `hooks/useAuth.js` (Handles Identity).
*   **Functional Pipes**: `services/*.js` (Handles Logic).

When you are ready to code the screen designs, you simply need to import these hooks/services to bind the data to your UI components.

---

## Next Step
👉 **Logic Finalization**  
We have now completed the core backend-to-frontend stitching for all major systems. 
The application is functionally ready for UI/UX skinning.

