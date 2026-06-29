/**
 * routes/order.routes.js
 * Auradime — Order Routes
 *
 * All routes are strictly protected by JWT.
 * Vendors and logistics users can make purchases as buyers from other stores.
 * Vendor seller/management routes remain vendor-only.
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

// ── Buyer Routes (customer + vendor + logistics can all purchase) ──────────
// Vendors can buy from OTHER stores; logistics agents can shop for personal use.
router.post('/', restrictTo('customer', 'vendor', 'logistics'), createOrder);
router.post('/cart-split', restrictTo('customer', 'vendor', 'logistics'), createOrdersFromCart);
router.get('/my-orders', restrictTo('customer', 'vendor', 'logistics'), getCustomerOrders);

router.post('/:id/refund', restrictTo('customer', 'vendor', 'logistics'), requestRefund);
router.post('/:id/cancel', restrictTo('customer', 'vendor', 'logistics'), cancelOrder);
router.post('/:id/pay-direct', restrictTo('customer', 'vendor', 'logistics'), payDirectly);

// ── Vendor Seller Routes ───────────────────────────────────────────────────
router.get('/vendor-orders', restrictTo('vendor'), requireActiveSubscription('vendor'), loadVendor, getVendorOrders);
router.patch('/:id/status', restrictTo('vendor', 'admin'), requireActiveSubscription(), loadVendor, updateOrderStatus);
router.patch('/:id/approve-refund', restrictTo('vendor'), requireActiveSubscription('vendor'), loadVendor, approveRefund);

// ── Shared Endpoints ───────────────────────────────────────────────────────
// Accessible by any authenticated party viewing their order/invoice
router.get('/:id', getOrderById);
router.get('/:id/invoice', getInvoice);

module.exports = router;
