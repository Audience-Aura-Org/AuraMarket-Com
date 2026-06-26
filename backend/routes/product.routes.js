/**
 * routes/product.routes.js
 * Auradime — Product Routes
 *
 * Public:
 *   GET    /api/products
 *   GET    /api/products/:id
 *
 * Private (vendor):
 *   POST   /api/products
 *   PATCH  /api/products/:id
 *   DELETE /api/products/:id
 *
 * Private (admin):
 *   PATCH  /api/products/:id/feature
 */

const express = require('express');
const router = express.Router();
const upload = require('../utils/storage');

const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleFeaturedStatus,
  trackProductView,
  getRecommendedProducts,
  getRecentlyViewed,
  watchProduct,
  getRelatedProducts,
  getHubFeed
} = require('../controllers/product.controller');

const { protect, restrictTo, loadVendor, protectOptional, loadVendorOptional } = require('../middleware/auth.middleware');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

// ── Public Routes ─────────────────────────────
router.get('/', getProducts);
router.get('/hub', protect, getHubFeed);
router.get('/recommendations', protect, getRecommendedProducts);
router.get('/history', protect, getRecentlyViewed);

// protectOptional + loadVendorOptional: allows an owning vendor to see their
// own pending/archived product from the edit form without blocking public buyers.
router.get('/:id', protectOptional, loadVendorOptional, getProductById);
router.get('/:id/related', getRelatedProducts);
router.post('/:id/view', protect, trackProductView);
router.post('/:id/watch', protect, watchProduct);

// ── Vendor Routes ─────────────────────────────
router.post('/', protect, restrictTo('vendor'), requireActiveSubscription('vendor'), loadVendor, upload.array('images', 5), createProduct);
router.patch('/:id', protect, restrictTo('vendor'), requireActiveSubscription('vendor'), loadVendor, upload.array('images', 5), updateProduct);
router.delete('/:id', protect, restrictTo('vendor'), requireActiveSubscription('vendor'), loadVendor, deleteProduct);

// ── Admin Routes ──────────────────────────────
router.patch('/:id/feature', protect, restrictTo('admin'), toggleFeaturedStatus);

module.exports = router;
