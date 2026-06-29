/**
 * routes/escrow.routes.js
 * Auradime — Escrow Control Routes
 *
 * Secure pipelines managing the middleman Vault logic between
 * buyer payments and Vendor payouts. Explicit role partitions.
 * Vendors and logistics users can act as buyers (hold/release).
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

// ── Buyer Initiations ─────────────────────────────────────────────────────
// Vendors and logistics can also act as buyers, so they can hold/release funds
router.post('/hold', restrictTo('customer', 'vendor', 'logistics'), holdFunds);

// Can only be fired when Buyer hits 'Delivery Confirmed'
router.post('/release/:orderId', restrictTo('customer', 'vendor', 'logistics', 'admin'), releaseFunds);

// ── Vendor / Admin Initiations ───────────────
// Vendor confirms they have delivered (acting as seller, not buyer)
router.post('/confirm-delivery/:orderId', restrictTo('vendor'), vendorConfirmRelease);

// Any party can deny release → Dispute
router.post('/deny/:orderId', denyEscrow);

// Occurs when Vendor cancels the Order / Admins settle a dispute
router.post('/refund/:orderId', restrictTo('vendor', 'admin'), refundFunds);

module.exports = router;
