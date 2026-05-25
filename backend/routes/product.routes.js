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

const { protect, restrictTo, loadVendor } = require('../middleware/auth.middleware');

// ── Public Routes ─────────────────────────────
router.get('/', getProducts);
router.get('/hub', protect, getHubFeed); // Added hub feed route
router.get('/recommendations', protect, getRecommendedProducts);
router.get('/history', protect, getRecentlyViewed);
router.get('/:id', getProductById);
router.get('/:id/related', getRelatedProducts);
router.post('/:id/view', protect, trackProductView);
router.post('/:id/watch', protect, watchProduct);

// ── Vendor Routes ─────────────────────────────
router.post('/', protect, restrictTo('vendor'), loadVendor, upload.array('images', 5), createProduct);
router.patch('/:id', protect, restrictTo('vendor'), loadVendor, upload.array('images', 5), updateProduct);
router.delete('/:id', protect, restrictTo('vendor'), loadVendor, deleteProduct);

// ── Admin Routes ──────────────────────────────
router.patch('/:id/feature', protect, restrictTo('admin'), toggleFeaturedStatus);

module.exports = router;
