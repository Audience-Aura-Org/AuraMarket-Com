const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  // Gateway registry
  listGateways,
  // Paystack
  initializePayment,
  verifyPayment,
  handleWebhook,
  // Eversend
  eversendGetWallets,
  eversendInitialize,
  eversendVerify,
  eversendRecheck,
  eversendRecover,
  eversendWebhook,
  eversendGetBeneficiaries,
  eversendCreateBeneficiary,
  eversendDeleteBeneficiary,
  eversendGetTransactions,
  eversendPayoutBeneficiary,
  // MeSomb
  mesombInitialize,
  mesombWebhook,
  mesombVerify,
} = require('../controllers/payment.controller');

// ── Webhooks — PUBLIC (must come BEFORE protect middleware) ──────────────────
router.post('/webhook', handleWebhook);
router.post('/eversend/webhook', eversendWebhook);
router.post('/mesomb/webhook', mesombWebhook);

// ── Protected routes ─────────────────────────────────────────────────────────
router.use(protect);

// Gateway Registry — checkout UI reads this to know which methods are available
router.get('/gateways', listGateways);

// Paystack
router.post('/initialize', initializePayment);
router.get('/verify/:reference', verifyPayment);

// MeSomb
router.post('/mesomb/initialize', mesombInitialize);
router.get('/mesomb/verify/:reference', mesombVerify);

// Eversend
router.get('/eversend/wallets', eversendGetWallets);
router.post('/eversend/initialize', eversendInitialize);
router.get('/eversend/verify/:reference', eversendVerify);
router.get('/eversend/recheck/:reference', eversendRecheck);
// Admin: manually recover a payment the gateway confirmed but our DB missed
router.post('/eversend/recover/:reference', eversendRecover);

// Beneficiaries
router.get('/eversend/beneficiaries', eversendGetBeneficiaries);
router.post('/eversend/beneficiaries', eversendCreateBeneficiary);
router.delete('/eversend/beneficiaries/:id', eversendDeleteBeneficiary);

// History
router.get('/eversend/transactions', eversendGetTransactions);

// Payouts
router.post('/eversend/payout/beneficiary', eversendPayoutBeneficiary);

module.exports = router;
