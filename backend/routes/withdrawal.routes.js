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
const { actAs } = require('../middleware/delegate.middleware');
const { loadManagerScope } = require('../middleware/managerScope.middleware');

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
// actAs lets managers work as a user via X-Act-As header
router.use(protect);
router.use(actAs);
router.post('/', submitWithdrawal);
router.get('/mine', getMyWithdrawals);
router.get('/mine/:id/recheck', userRecheckWithdrawal);

// ── Admin + Manager ──────────────────────────
const adminWithdrawals = express.Router();
adminWithdrawals.use(restrictTo('admin', 'manager'), loadManagerScope);
adminWithdrawals.get('/', adminGetAllWithdrawals);
adminWithdrawals.post('/:id/approve', adminApproveWithdrawal);
adminWithdrawals.post('/:id/reject',  adminRejectWithdrawal);
adminWithdrawals.post('/:id/recheck', adminRecheckWithdrawal);
adminWithdrawals.post('/:id/complete', adminCompleteManualWithdrawal);
router.use('/admin', adminWithdrawals);

module.exports = router;
