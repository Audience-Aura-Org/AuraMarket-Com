/**
 * routes/wallet.routes.js
 * Aura Dime — Wallet APIs
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
  getAllWithdrawals,
  payOrderWithWallet,
  getEscrowTransactions,
  getPlatformFinancialStats,
} = require('../controllers/wallet.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// All Wallet routes require authentication
router.use(protect);

// ── General Customer / Vendor ─────────────────
router.get('/', getWalletBalance);
router.get('/transactions', getTransactionHistory);
router.get('/escrow', restrictTo('vendor'), getEscrowTransactions); // Vendor only
router.post('/deposit', initiateDeposit);
router.post('/withdraw', requestWithdrawal);
router.post('/pay-order', payOrderWithWallet); // Direct Wallet Payment checkout

// ── Admin Tools ───────────────────────────────
router.get('/admin/stats', restrictTo('admin'), getPlatformFinancialStats);
router.get('/admin/withdrawals', restrictTo('admin'), getAllWithdrawals);
router.patch('/admin/withdrawals/:id', restrictTo('admin'), processWithdrawal);

module.exports = router;
