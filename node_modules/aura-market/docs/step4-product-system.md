# Step 4 — Product System ✅

**Status:** Complete  
**Date Completed:** 2026-03-13

---

## Overview
This step implements the Product catalog system. Vendors can manage their inventory, while the public can query, search, and parse products effectively. An admin-exclusive endpoint to highlight "featured" products for the homepage has also been created.

---

## Files Created / Modified

| File | Description |
|------|-------------|
| `backend/models/Product.model.js` | Schema for products. Features extensive fields (`images`, `tags`, `category`, `stock`), statuses (`active`, `draft`, `archived`), and full-text indexes to power fast searching natively in MongoDB. |
| `backend/controllers/product.controller.js` | Handlers for: `createProduct`, `getProducts` (complex querying & pagination), `getProductById`, `updateProduct`, `deleteProduct` (soft delete/archive), and `toggleFeaturedStatus`. |
| `backend/routes/product.routes.js` | Maps RESTful routing endpoints securely using built-in authentication layers per role (Public, Vendor, Admin). |
| `backend/server.js` | Route configuration `app.use('/api/products')` mounted and active. |

---

## Technical Details

### 1. Complex Querying (API/Discovery Optimization)
The `getProducts` endpoint is a backbone for the Web/Mobile Discovery Feed.
It features native support for:
* **Pagination:** Usage: `?page=1&limit=20` to reduce payload sizes drastically limit bandwidth.
* **Full-Text Search:** Usage: `?search=shoes`. Utilizing MongoDB `$text`, the server matches against tags, names, and descriptions instantly.
* **Operators & Sorting:** Usage: `?price[gte]=1500&sort=-createdAt`. Built dynamically so frontends don't need distinct endpoints per page.

### 2. Authorization Boundaries
* **Vendors** are strictly guarded to *only* modify objects containing their respective `vendor_id`. A vendor attempting to `PATCH` a competitor's product is immediately thrown a `403 Forbidden` response.
* **Featured Abuse Prevention:** The `featured` boolean is an Admin-only property. If a Vendor tries to sneak `{"featured": true}` into their creation or update payload, the controller simply strips it away seamlessly.

### 3. Soft Deletion
When `DELETE /api/products/:id` is invoked, the database entry is **not** `.remove()`'d. Instead, `status` changes from `'active'` to `'archived'`.
Why? *Order Integrity*. If a user bought a product yesterday and the vendor "deletes" it today, the User's Order History needs the product payload to remain intact in the database so the receipt renders.

---

## Next Step
👉 [Step 5 — Order System](./step5-order-system.md) (Expected next.)
