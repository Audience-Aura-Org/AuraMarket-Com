/**
 * routes/order.routes.js
 * Auradime — Order Routes
 *
 * All routes are strictly protected by JWT.
 * Route splitting maps explicit vendor vs. customer operational scope.
 */

const express = require('express');
const router = express.Router();

const {
  createOrder,
  getCustomerOrders,
  getVendorOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  requestRefund,
  approveRefund,
  getInvoice,
  payDirectly,
  createOrdersFromCart,
} = require('../controllers/order.controller');


const { protect, restrictTo, loadVendor } = require('../middleware/auth.middleware');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

// All order routes require authentication
router.use(protect);

// ── Customer Routes ───────────────────────────
router.post('/', restrictTo('customer'), createOrder);
router.post('/cart-split', restrictTo('customer'), createOrdersFromCart);
router.get('/my-orders', restrictTo('customer', 'vendor'), getCustomerOrders);

router.post('/:id/refund', restrictTo('customer'), requestRefund);
router.post('/:id/cancel', restrictTo('customer'), cancelOrder);
router.post('/:id/pay-direct', restrictTo('customer'), payDirectly);


// ── Vendor Routes ─────────────────────────────
router.get('/vendor-orders', restrictTo('vendor'), requireActiveSubscription('vendor'), loadVendor, getVendorOrders);
router.patch('/:id/status', restrictTo('vendor', 'admin'), requireActiveSubscription(), loadVendor, updateOrderStatus);
router.patch('/:id/approve-refund', restrictTo('vendor'), requireActiveSubscription('vendor'), loadVendor, approveRefund);

// ── Shared Endpoint ───────────────────────────
// Accessible by customer tracking their shipment OR vendor viewing their ticket
router.get('/:id', getOrderById);
router.get('/:id/invoice', getInvoice);

module.exports = router;
