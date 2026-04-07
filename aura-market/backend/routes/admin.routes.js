/**
 * routes/admin.routes.js
 * Aura Market — Dedicated Admin Maps
 *
 * Public access strictly for pulling layouts. Secure access mapped exclusively
 * to the Platform Administrators managing UI Banners and verification states explicitly.
 */

const express = require('express');
const router = express.Router();

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
  getPendingVendors,
  getPendingProducts,
  reviewProduct,
  getAllUsers,
  updateUserStatus,
  updateUserAdmin,
  getAllVendors,
  updateVendorStatus,
  fetchAdminShipments,
  updateAdminShipment,
  getAdminLogisticsFirms,
  getLogisticsEarningsReport,
  toggleLogisticsVerified,
  updateLogisticsFirm,
  addLogisticZone,
  getAdvancedAnalytics,
  getEmailLogs,
  getAllProducts
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

// ── Secure Admin Controls ─────────────────────
// Every function thereafter explicitly halts if the User.role !== 'admin'
router.use(protect);
router.use(restrictTo('admin'));

// Layout Updates
router.patch('/homepage/banners', updateBanners);
router.patch('/homepage/featured', setFeaturedProducts);

// Global Account Mods
router.patch('/vendors/:id/verify', toggleVendorVerified);
router.get('/analytics', getPlatformAnalytics);

// KYC Moderation
router.get('/kyc/pending', getPendingKYC);
router.patch('/kyc/:id/review', reviewKYC);

// Logistics Monitoring
router.get('/logistics/shipments', fetchAdminShipments);
router.patch('/logistics/shipments/:id', updateAdminShipment);
router.get('/logistics/firms', getAdminLogisticsFirms);
router.get('/logistics/earnings', getLogisticsEarningsReport);
router.patch('/logistics/firms/:id/verify', toggleLogisticsVerified);
router.patch('/logistics/firms/:id', updateLogisticsFirm);
router.post('/logistics/zones', addLogisticZone);


// Advanced Analytics
router.get('/analytics/advanced', getAdvancedAnalytics);

// Escrow Monitoring
router.get('/escrow/logs', getEscrowLogs);

// Dispute Management
router.get('/disputes', getAdminDisputes);
router.patch('/disputes/:id/resolve', resolveDispute);

// Abuse Reporting
router.get('/reports', getPendingReports);
router.patch('/reports/:id/resolve', resolveReport);

// Platform Settings
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);

// Email Monitoring
router.get('/notifications/email-logs', getEmailLogs);

// Audit Logging
router.get('/audit', getAuditLogs);

// Queue Moderation
router.get('/vendors/pending', getPendingVendors);
router.get('/products/pending', getPendingProducts);
router.patch('/products/:id/review', reviewProduct);

// All Orders (admin view)
router.get('/orders', getAllOrders);
router.patch('/orders/:id', updateOrderAdmin);

// User & Entity Management
router.get('/users', getAllUsers);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id', updateUserAdmin);
router.get('/vendors', getAllVendors);
router.patch('/vendors/:id/status', updateVendorStatus);
router.get('/products', getAllProducts);

module.exports = router;
