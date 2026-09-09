/**
 * routes/p2p.routes.js
 * Auradime — P2P Pickup & Delivery Routes
 */

const express = require('express');
const router = express.Router();
const { protect, protectOptional } = require('../middleware/auth.middleware');
const { strictLimiter } = require('../middleware/rateLimiter');
const {
  getP2PQuote,
  createP2PShipment,
  getMyDeliveries,
  getGuestDeliveries,
  trackP2PShipment,
  cancelP2PShipment,
  sendPodOtp,
  verifyPodOtp,
  lookupUser,
} = require('../controllers/p2p.controller');

// ── Public / Guest-friendly ────────────────────────────────────────────
router.post('/quote', protectOptional, getP2PQuote);
router.post('/book', strictLimiter, protectOptional, createP2PShipment);
router.get('/track/:trackingCode', trackP2PShipment);
router.get('/guest/:sessionId', getGuestDeliveries);

// ── Authenticated ──────────────────────────────────────────────────────
router.get('/my-deliveries', protect, getMyDeliveries);
router.post('/:id/cancel', protectOptional, cancelP2PShipment);

// ── User lookup (for other-party search) ───────────────────────────────
router.get('/lookup', strictLimiter, protect, lookupUser);

// ── POD OTP (logistics role) ───────────────────────────────────────────
router.post('/:id/pod-otp/send', protect, sendPodOtp);
router.post('/:id/pod-otp/verify', protect, verifyPodOtp);

module.exports = router;
