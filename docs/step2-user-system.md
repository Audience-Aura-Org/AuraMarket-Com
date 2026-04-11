# Step 2 — User System ✅

**Status:** Complete  
**Date Completed:** 2026-03-13

---

## Overview
This step implements the core User Authentication system for Aura Market. It introduces the robust User schema, JWT-based logic, password hashing, referring logic, and Role-Based Access Control logic (`restrictTo`).

---

## Files Created / Modified

| File | Description |
|------|-------------|
| `backend/models/User.model.js` | Extensible User schema with all requested fields, password hashing pre-save hook, and password verification tests. |
| `backend/controllers/auth.controller.js` | Contains `register`, `login`, `getMe`, `updateProfile` and `changePassword` handlers. |
| `backend/middleware/auth.middleware.js` | Contains the `protect` middleware to ensure valid JWT transmission, and `restrictTo` to manage user roles gracefully. |
| `backend/routes/auth.routes.js` | Connects auth endpoints to respective controller functions. |
| `backend/server.js` | Modified to mount the `/api/auth` prefix to the `auth.routes` handlers. |

---

## Technical Details 

### 1. User Model Schema
* **Basic Fields:** `name`, `email` (unique), `password`, `phone`.
* **Platform Logic:** `role` (customer, vendor, logistics, admin), `wallet_balance`, `verification_status`, `is_active`.
* **Extensions:** Allows generating user referral codes during creation automatically. Stores avatar/addresses. Re-configured hashing to comfortably support the latest Express 5 syntax and `bcryptjs`.

### 2. Authentication Logic
* Uses `bcryptjs` and salts for proper hashing. Passwords are set explicitly NOT to appear during basic querying `select: false`.
* Successful login outputs a JWT Bearer Token, returning JSON response omitting sensitive fields.
* Register route strictly filters `admin` registrations (defaults them strictly to `customer` to defend against malicious inserts during setup).

### 3. Middleware Structure
* `protect(req, res, next)`: Validates JWT signature to guarantee integrity + ensures the user payload hasn't since been marked as deactivated. Adds `user` securely onto HTTP Request. 
* `restrictTo(...roles)`: Allows precise API scoping per task. Example: `router.post('/banner', protect, restrictTo('admin'), controller)`

---

## Verification
- ✅ **API Registration Tested:** Reached `201 Created` via `Invoke-RestMethod` and confirmed DB insertion natively via Node query.
- ✅ Routing successfully uncommented inside `server.js` and functional.
- ✅ `bcryptjs` hook bugs solved proactively for `Mongoose 8` structure.

---

## Next Step
👉 [Step 3 — Vendor & Store System](./step3-vendor-store.md) (Expected next.)
