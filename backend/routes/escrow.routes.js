/**
 * routes/escrow.routes.js
 * Aura Market — Escrow Control Routes
 *
 * Secure pipelines managing the middleman Vault logic between
 * Customer payments and Vendor payouts. Explicit role partitions.
 */

const express = require('express');
const router = express.Router();

const {
  holdFunds,
  releaseFunds,
  vendorConfirmRelease,
  denyEscrow,
  refundFunds,
  getEscrowLogs,
} = require('../controllers/escrow.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// All Escrow endpoints require an authorized identity
router.use(protect);

// ── Admin Monitoring ──────────────────────────
router.get('/logs', restrictTo('admin'), getEscrowLogs);

// ── Buyer Initiations ────────────────────────
// Starts the hold phase
router.post('/hold', restrictTo('customer'), holdFunds);

// Can only be fired when Customer hits 'Delivery Confirmed'
router.post('/release/:orderId', restrictTo('customer', 'admin'), releaseFunds);

// ── Vendor / Admin Initiations ───────────────
// Vendor confirms they have delivered
router.post('/confirm-delivery/:orderId', restrictTo('vendor'), vendorConfirmRelease);

// Customer or Vendor denies release → Dispute
router.post('/deny/:orderId', denyEscrow);

// Occurs when Vendor cancels the Order / Admins settle a dispute
router.post('/refund/:orderId', restrictTo('vendor', 'admin'), refundFunds);

module.exports = router;
