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
  processWithdrawal,
  getAllWithdrawals,
  payOrderWithWallet,
  getEscrowTransactions,
  getPlatformFinancialStats,
} = require('../controllers/wallet.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');
const { loadManagerScope } = require('../middleware/managerScope.middleware');
const { walletWriteLimiter } = require('../middleware/rateLimiter');

// All Wallet routes require authentication
router.use(protect);

// ── General Customer / Vendor ─────────────────
router.get('/', getWalletBalance);
router.get('/transactions', getTransactionHistory);
router.get('/escrow', restrictTo('vendor', 'logistics'), getEscrowTransactions);
router.post('/deposit', walletWriteLimiter, initiateDeposit);
// Retired: it debited the balance but created no WithdrawalRequest, so the
// payout never reached the admin queue (/withdrawals/admin). Withdrawals go
// through POST /withdrawals. Kept as 410 so old clients fail without moving money.
router.post('/withdraw', walletWriteLimiter, (req, res) => res.status(410).json({
  success: false,
  code: 'ENDPOINT_RETIRED',
  message: 'Withdrawals are submitted at POST /api/v1/withdrawals. Please update the app.',
}));
router.post('/pay-order', walletWriteLimiter, payOrderWithWallet); // Direct Wallet Payment checkout

// ── Admin + Manager Tools ────────────────────
const adminWallet = express.Router();
adminWallet.use(restrictTo('admin'), loadManagerScope);
adminWallet.get('/stats', getPlatformFinancialStats);
adminWallet.get('/withdrawals', getAllWithdrawals);
adminWallet.patch('/withdrawals/:id', processWithdrawal);
router.use('/admin', adminWallet);

module.exports = router;
