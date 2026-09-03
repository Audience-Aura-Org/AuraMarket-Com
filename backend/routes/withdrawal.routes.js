/**
 * routes/withdrawal.routes.js
 * Auradime — Withdrawal Request Routes
 *
 * User/Vendor:
 *   POST  /api/withdrawals           → Submit withdrawal request
 *   GET   /api/withdrawals/mine      → Get own withdrawal history
 *
 * Admin:
 *   GET   /api/withdrawals/admin     → All withdrawals (filterable)
 *   POST  /api/withdrawals/admin/:id/approve  → Approve + trigger Eversend payout
 *   POST  /api/withdrawals/admin/:id/reject   → Reject with reason
 *   POST  /api/withdrawals/admin/:id/recheck  → Sync Eversend status
 */

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');

const {
  submitWithdrawal,
  getMyWithdrawals,
  userRecheckWithdrawal,
  adminGetAllWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminRecheckWithdrawal,
  adminCompleteManualWithdrawal,
} = require('../controllers/withdrawal.controller');

// ── All authenticated users ───────────────────
router.use(protect);
router.post('/', submitWithdrawal);
router.get('/mine', getMyWithdrawals);
router.get('/mine/:id/recheck', userRecheckWithdrawal);

// ── Admin only ────────────────────────────────
router.get('/admin', restrictTo('admin'), adminGetAllWithdrawals);
router.post('/admin/:id/approve', restrictTo('admin'), adminApproveWithdrawal);
router.post('/admin/:id/reject',  restrictTo('admin'), adminRejectWithdrawal);
router.post('/admin/:id/recheck', restrictTo('admin'), adminRecheckWithdrawal);
router.post('/admin/:id/complete', restrictTo('admin'), adminCompleteManualWithdrawal);

module.exports = router;
