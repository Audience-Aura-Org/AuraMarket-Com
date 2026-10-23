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
const { loadManagerScope } = require('../middleware/managerScope.middleware');
const { walletWriteLimiter } = require('../middleware/rateLimiter');

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
router.post('/', walletWriteLimiter, submitWithdrawal);
router.get('/mine', getMyWithdrawals);
router.get('/mine/:id/recheck', userRecheckWithdrawal);

// ── Admin + Manager ──────────────────────────
const adminWithdrawals = express.Router();
adminWithdrawals.use(restrictTo('admin'), loadManagerScope);
adminWithdrawals.get('/', adminGetAllWithdrawals);
const automation = require('../controllers/withdrawalAutomation.controller');
adminWithdrawals.get('/automation', automation.getPolicy);
adminWithdrawals.patch('/automation', automation.setPolicy);
adminWithdrawals.post('/:id/approve', adminApproveWithdrawal);
adminWithdrawals.post('/:id/reject',  adminRejectWithdrawal);
adminWithdrawals.post('/:id/recheck', adminRecheckWithdrawal);
adminWithdrawals.post('/:id/complete', adminCompleteManualWithdrawal);
router.use('/admin', adminWithdrawals);

module.exports = router;
