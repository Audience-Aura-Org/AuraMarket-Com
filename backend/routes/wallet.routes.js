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
const { loadManagerScope } = require('../middleware/managerScope.middleware');

// All Wallet routes require authentication
router.use(protect);

// ── General Customer / Vendor ─────────────────
router.get('/', getWalletBalance);
router.get('/transactions', getTransactionHistory);
router.get('/escrow', restrictTo('vendor', 'logistics'), getEscrowTransactions);
router.post('/deposit', initiateDeposit);
router.post('/withdraw', requestWithdrawal);
router.post('/pay-order', payOrderWithWallet); // Direct Wallet Payment checkout

// ── Admin + Manager Tools ────────────────────
const adminWallet = express.Router();
adminWallet.use(restrictTo('admin', 'manager'), loadManagerScope);
adminWallet.get('/stats', getPlatformFinancialStats);
adminWallet.get('/withdrawals', getAllWithdrawals);
adminWallet.patch('/withdrawals/:id', processWithdrawal);
router.use('/admin', adminWallet);

module.exports = router;
