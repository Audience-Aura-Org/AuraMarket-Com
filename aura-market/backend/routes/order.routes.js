/**
 * routes/order.routes.js
 * Aura Market — Order Routes
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
  requestRefund,
  approveRefund,
  getInvoice,
  payDirectly,
  createOrdersFromCart,
} = require('../controllers/order.controller');


const { protect, restrictTo } = require('../middleware/auth.middleware');

// All order routes require authentication
router.use(protect);

// ── Customer Routes ───────────────────────────
router.post('/', restrictTo('customer'), createOrder);
router.post('/cart-split', restrictTo('customer'), createOrdersFromCart);
router.get('/my-orders', restrictTo('customer'), getCustomerOrders);

router.post('/:id/refund', restrictTo('customer'), requestRefund);
router.post('/:id/pay-direct', restrictTo('customer'), payDirectly);


// ── Vendor Routes ─────────────────────────────
router.get('/vendor-orders', restrictTo('vendor'), getVendorOrders);
router.patch('/:id/status', restrictTo('vendor', 'admin'), updateOrderStatus);
router.patch('/:id/approve-refund', restrictTo('vendor'), approveRefund);

// ── Shared Endpoint ───────────────────────────
// Accessible by customer tracking their shipment OR vendor viewing their ticket
router.get('/:id', getOrderById);
router.get('/:id/invoice', getInvoice);

module.exports = router;
