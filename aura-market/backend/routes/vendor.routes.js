/**
 * routes/vendor.routes.js
 * Aura Market — Vendor Routes
 *
 * Public:
 *   GET    /api/vendors
 */

const express = require('express');
const router = express.Router();

const {
  onboardVendor,
  getVendorProfile,
  updateStore,
  updateVendorProfile,
  getPublicStores,
  getStore,
  submitKYC,
  followVendor,
  unfollowVendor,
  getFollowers,
  getFollowing,
  checkFollowStatus,
  getVendorAnalytics
} = require('../controllers/vendor.controller');

const {
  getVendorProducts,
} = require('../controllers/product.controller');

const {
  getVendorOrders,
} = require('../controllers/order.controller');

const {
  getVendorDisputes
} = require('../controllers/dispute.controller');

const {
  getVendorReviews
} = require('../controllers/review.controller');

const { protect, restrictTo, loadVendor } = require('../middleware/auth.middleware');

// ── Public Routes ─────────────────────────────
router.get('/', getPublicStores);
router.get('/stores/:id', getStore);

// Follow/Unfollow (Any Authenticated User)
router.get('/following', protect, getFollowing);
router.get('/:id/follow-status', protect, checkFollowStatus);
router.post('/:id/follow', protect, followVendor);
router.delete('/:id/follow', protect, unfollowVendor);

// ── Private Vendor-only Routes ────────────────
// Any route following this point requires JWT + 'vendor' role
router.use(protect);
router.use(restrictTo('vendor'));

// Onboarding must happen BEFORE loadVendor check
router.post('/onboard', onboardVendor);

// Universal Vendor Data loader
router.use(loadVendor);

router.get('/me', getVendorProfile);
router.patch('/profile', updateVendorProfile);
router.patch('/store', updateStore);
router.post('/kyc', submitKYC);

// Operation-based subroutes
router.get('/products', getVendorProducts);
router.get('/orders', getVendorOrders);
router.get('/disputes', getVendorDisputes);
router.get('/reviews', getVendorReviews);
router.get('/analytics', getVendorAnalytics);
router.get('/:id/followers', getFollowers);

module.exports = router;
