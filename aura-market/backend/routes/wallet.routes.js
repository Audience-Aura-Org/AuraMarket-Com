/**
 * routes/wallet.routes.js
 * Aura Market — Wallet APIs
 *
 * User Routes (Private):
 *   GET    /api/wallet
 *   GET    /api/wallet/transactions
 *   POST   /api/wallet/deposit
 *   POST   /api/wallet/withdraw
 *   POST   /api/wallet/pay-order
 *
 * Admin Routes:
 *   PATCH  /api/wallet/admin/withdrawals/:id
 */

const express = require('express');
const router = express.Router();

const {
  getWalletBalance,
  getTransactionHistory,
  initiateDeposit,
  requestWithdrawal,
  processWithdrawal,
  payOrderWithWallet,
} = require('../controllers/wallet.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// All Wallet routes require authentication
router.use(protect);

// ── General Customer / Vendor ─────────────────
router.get('/', getWalletBalance);
router.get('/transactions', getTransactionHistory);
router.post('/deposit', initiateDeposit);
router.post('/withdraw', requestWithdrawal);
router.post('/pay-order', payOrderWithWallet); // Direct Wallet Payment checkout

// ── Admin Tools ───────────────────────────────
router.get('/admin/withdrawals', restrictTo('admin'), getPendingWithdrawals);
router.patch('/admin/withdrawals/:id', restrictTo('admin'), processWithdrawal);

module.exports = router;
