/**
 * routes/admin.routes.js
 * Auradime — Admin & Manager Route Maps
 *
 * Public access strictly for pulling layouts. Secure access mapped to
 * Platform Administrators and Operations Managers.
 *
 * Routes are split into two groups:
 *   1. Shared (admin + manager) — day-to-day operations
 *   2. Admin-only — financial operations, destructive actions, platform settings
 */

const express = require('express');
const router = express.Router();
const upload = require('../utils/storage');

const {
  getHomepageLayout,
  updateBanners,
  setFeaturedProducts,
  toggleVendorVerified,
  getPlatformAnalytics,
  getPendingKYC,
  reviewKYC,
  getPendingReports,
  resolveReport,
  getSettings,
  updateSettings,
  getAllOrders,
  updateOrderAdmin,
  imposeEscrow,
  getPendingVendors,
  getPendingProducts,
  reviewProduct,
  updateProductAdmin,
  getAllUsers,
  updateUserStatus,
  updateUserAdmin,
  getAllVendors,
  updateVendorStatus,
  updateVendorMedia,
  updateVendorStoreSettings,
  fetchAdminShipments,
  updateAdminShipment,
  getAdminLogisticsFirms,
  getLogisticsEarningsReport,
  toggleLogisticsVerified,
  updateLogisticsFirm,
  addLogisticZone,
  getAdvancedAnalytics,
  getEmailLogs,
  getAllProducts,
  deleteUser,
  bulkDeleteUsers,
  bulkDeleteProducts,
  getAllTransactions,
  updateTransactionStatus,
  fulfillOrderFromTransaction,
  syncWithEversend,
  syncGatewayTransactions,
  getQueueStats,
  setCancelRateHoldOverride,
  fetchAdminP2PShipments,
  listIntercityRates,
  createIntercityRate,
  updateIntercityRate,
  deleteIntercityRate,
  listPickupPoints,
  createPickupPoint,
  updatePickupPoint,
  deletePickupPoint,
  listZones,
  createZone,
  updateZone,
  deleteZone,
  backfillUserNames,
  // Treasury & Vendor Balance
  adminDirectPayout,
  recheckTreasuryPayouts,
  getAdminDirectPayoutHistory,
  getGatewayBalances,
  searchVendorsForBalance,
  adminAdjustVendorBalance,
  getAdminBalanceAdjustmentHistory,
  getVendorTransactionHistory,
  // Manager management
  promoteToManager,
  demoteManager,
} = require('../controllers/admin.controller');

const { getAuditLogs } = require('../controllers/audit.controller');


const {
  getAdminDisputes,
  resolveDispute
} = require('../controllers/dispute.controller');

const { getEscrowLogs } = require('../controllers/escrow.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// ── Public Access (Config fetches) ────────────
router.get('/homepage', getHomepageLayout); // App boot sequence

// ── Authentication Gate ──────────────────────
router.use(protect);

// ════════════════════════════════════════════════════════════════════
// GROUP 1: SHARED ACCESS (admin + manager)
// Day-to-day operational routes accessible by both roles.
// ════════════════════════════════════════════════════════════════════
const shared = express.Router();
shared.use(restrictTo('admin', 'manager'));

// Layout Updates
shared.patch('/homepage/banners', updateBanners);
shared.patch('/homepage/featured', setFeaturedProducts);

// Vendor Management
shared.patch('/vendors/:id/verify', toggleVendorVerified);
shared.get('/vendors/pending', getPendingVendors);
shared.get('/vendors', getAllVendors);
shared.patch('/vendors/:id/media', updateVendorMedia);
shared.patch('/vendors/:id/store-settings', updateVendorStoreSettings);
shared.patch('/vendors/:id/status', updateVendorStatus);
shared.patch('/vendors/:id/cancel-rate-hold', setCancelRateHoldOverride);

// Analytics
shared.get('/analytics', getPlatformAnalytics);
shared.get('/analytics/advanced', getAdvancedAnalytics);

// KYC Moderation
shared.get('/kyc/pending', getPendingKYC);
shared.patch('/kyc/:id/review', reviewKYC);

// Logistics Monitoring
shared.get('/logistics/shipments', fetchAdminShipments);
shared.patch('/logistics/shipments/:id', updateAdminShipment);
shared.get('/logistics/firms', getAdminLogisticsFirms);
shared.get('/logistics/earnings', getLogisticsEarningsReport);
shared.patch('/logistics/firms/:id/verify', toggleLogisticsVerified);
shared.patch('/logistics/firms/:id', updateLogisticsFirm);
shared.post('/logistics/zones', addLogisticZone);

// Escrow Monitoring (read-only)
shared.get('/escrow/logs', getEscrowLogs);

// Dispute Management
shared.get('/disputes', getAdminDisputes);
shared.patch('/disputes/:id/resolve', resolveDispute);

// Abuse Reporting
shared.get('/reports', getPendingReports);
shared.patch('/reports/:id/resolve', resolveReport);

// P2P Management
shared.get('/p2p/shipments', fetchAdminP2PShipments);

// Email Monitoring
shared.get('/notifications/email-logs', getEmailLogs);

// Audit Logging
shared.get('/audit', getAuditLogs);

// Queue Monitoring
shared.get('/queues', getQueueStats);

// Transactions (read-only for managers — write routes in admin-only below)
shared.get('/transactions', getAllTransactions);

// Product Management
shared.get('/products/pending', getPendingProducts);
shared.patch('/products/:id/review', reviewProduct);
shared.get('/products', getAllProducts);
shared.patch('/products/:id', upload.array('images', 5), updateProductAdmin);

// Orders
shared.get('/orders', getAllOrders);
shared.patch('/orders/:id', updateOrderAdmin);
shared.post('/orders/:id/impose-escrow', imposeEscrow);

// User Management (view + update, no delete)
shared.get('/users', getAllUsers);
shared.patch('/users/:id/status', updateUserStatus);
shared.patch('/users/:id', updateUserAdmin);

// Intercity Rates & Pickup Points
shared.get('/intercity/rates', listIntercityRates);
shared.post('/intercity/rates', createIntercityRate);
shared.patch('/intercity/rates/:id', updateIntercityRate);
shared.delete('/intercity/rates/:id', deleteIntercityRate);
shared.get('/intercity/pickup-points', listPickupPoints);
shared.post('/intercity/pickup-points', createPickupPoint);
shared.patch('/intercity/pickup-points/:id', updatePickupPoint);
shared.delete('/intercity/pickup-points/:id', deletePickupPoint);

// Zone CRUD
shared.get('/zones', listZones);
shared.post('/zones', createZone);
shared.patch('/zones/:id', updateZone);
shared.delete('/zones/:id', deleteZone);

// User Name Backfill
shared.post('/backfill-user-names', backfillUserNames);

// Platform Settings (read-only for managers)
shared.get('/settings', getSettings);

router.use(shared);

// ════════════════════════════════════════════════════════════════════
// GROUP 2: SHARED OPERATIONAL CONTROL (admin + manager)
// User management, financial operations, and treasury.
// ════════════════════════════════════════════════════════════════════
const operational = express.Router();
operational.use(restrictTo('admin', 'manager'));

// Destructive User/Product Operations
operational.delete('/users/:id', deleteUser);
operational.post('/users/bulk-delete', bulkDeleteUsers);
operational.post('/products/bulk-delete', bulkDeleteProducts);

// Transaction Mutations
operational.patch('/transactions/:id', updateTransactionStatus);
operational.patch('/transactions/manual-fix/:id', updateTransactionStatus);
operational.post('/transactions/sync-eversend', syncWithEversend);
operational.post('/transactions/sync-gateways', syncGatewayTransactions);
operational.post('/transactions/:transactionId/fulfill', fulfillOrderFromTransaction);

// Treasury: Direct Payouts
operational.post('/treasury/payout', adminDirectPayout);
operational.post('/treasury/recheck', recheckTreasuryPayouts);
operational.get('/treasury/history', getAdminDirectPayoutHistory);
operational.get('/treasury/gateway-balances', getGatewayBalances);

// Vendor Balance Management
operational.get('/vendor-balance/search', searchVendorsForBalance);
operational.post('/vendor-balance/adjust', adminAdjustVendorBalance);
operational.get('/vendor-balance/history', getAdminBalanceAdjustmentHistory);
operational.get('/vendor-balance/transactions/:userId', getVendorTransactionHistory);

router.use(operational);

// ════════════════════════════════════════════════════════════════════
// GROUP 3: ADMIN-ONLY ACCESS
// Platform settings and manager promotion/demotion.
// ════════════════════════════════════════════════════════════════════
const adminOnly = express.Router();
adminOnly.use(restrictTo('admin'));

// Platform Settings (write)
adminOnly.patch('/settings', updateSettings);

// Manager Promotion / Demotion
adminOnly.post('/managers/:userId/promote', promoteToManager);
adminOnly.post('/managers/:userId/demote', demoteManager);

router.use(adminOnly);

module.exports = router;
