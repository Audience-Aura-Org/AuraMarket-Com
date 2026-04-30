const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  // Paystack
  initializePayment,
  verifyPayment,
  handleWebhook,
  // Eversend
  eversendRequestOTP,
  eversendInitialize,
  eversendVerify,
  eversendWebhook,
} = require('../controllers/payment.controller');

// ── Webhooks — PUBLIC, must come before protect middleware ───────────────────
// Eversend: use express.raw() so we get the raw body for HMAC verification
router.post(
  '/eversend/webhook',
  express.raw({ type: 'application/json' }),
  eversendWebhook
);

// Paystack webhook (legacy)
router.post('/webhook', handleWebhook);

// ── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);

// Paystack
router.post('/initialize', initializePayment);
router.get('/verify/:reference', verifyPayment);

// Eversend
router.post('/eversend/otp', eversendRequestOTP);
router.post('/eversend/initialize', eversendInitialize);
router.get('/eversend/verify/:reference', eversendVerify);

module.exports = router;
