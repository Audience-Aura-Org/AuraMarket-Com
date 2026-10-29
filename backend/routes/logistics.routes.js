/**
 * routes/logistics.routes.js
 * Auradime — Logistics Router Maps
 */

const express = require('express');
const router = express.Router();

const {
  onboardLogistics,
  getFirmShipments,
  getFirmAnalytics,
  getFirmShipmentById,
  getVendorShipments,
  modifyShipmentStatus,
  getPublicLogisticsFirms,
  getZones,
  getSearchCompatibleFirms,
  getProfile,
  updateProfile,
  updatePricing
} = require('../controllers/logistics.controller');


const { protect, restrictTo } = require('../middleware/auth.middleware');

// ── Public Discovery ──────────────────────────
router.get('/', getPublicLogisticsFirms);
router.get('/zones', getZones);
router.get('/compatible-firms', getSearchCompatibleFirms);

router.use(protect);

// ── Shared / Smart Routing ────────────────────
router.get('/shipments', (req, res, next) => {
  if (req.user.role === 'logistics') return getFirmShipments(req, res, next);
  if (req.user.role === 'vendor') return getVendorShipments(req, res, next);
  return res.status(403).json({ success: false, message: 'Unauthorized role for general shipment access.' });
});

// ── Vendor Actions ────────────────────────────
router.get('/shipments/vendor', restrictTo('vendor', 'admin'), getVendorShipments);

// ── Logistics Firm Dashboard ──
router.post('/onboard', onboardLogistics);
router.get('/shipments/firm', restrictTo('logistics', 'admin'), getFirmShipments);
router.get('/analytics', restrictTo('logistics'), getFirmAnalytics);
router.get('/shipments/:id', restrictTo('logistics', 'admin'), getFirmShipmentById);
router.get('/profile', restrictTo('logistics', 'admin'), getProfile);
router.patch('/profile', restrictTo('logistics', 'admin'), updateProfile);
router.patch('/pricing', restrictTo('logistics', 'admin'), updatePricing);

// ── Rider management (own agency only) ──
const { listRiders, inviteRider, updateRider, recordCashHandover } = require('../controllers/rider.controller');
router.get('/riders', restrictTo('logistics'), listRiders);
router.post('/riders/invite', restrictTo('logistics'), inviteRider);
router.patch('/riders/:riderId', restrictTo('logistics'), updateRider);
router.post('/riders/:riderId/cash-handovers', restrictTo('logistics'), recordCashHandover);
const riderEarnings = require('../controllers/riderEarnings.controller');
router.get('/rider-pay', restrictTo('logistics'), riderEarnings.getRiderPay);
router.patch('/rider-pay', restrictTo('logistics'), riderEarnings.setRiderPay);
router.post('/riders/:riderId/payouts', restrictTo('logistics'), riderEarnings.recordRiderPayout);
router.get('/riders/report', restrictTo('logistics'), require('../controllers/logisticsReport.controller').riderReport);

// ── Agency packages & shareable tracking links ──
const { createPackage, createTrackingLink } = require('../controllers/agencyPackage.controller');
router.post('/packages', restrictTo('logistics'), createPackage);
router.post('/shipments/:id/tracking-link', restrictTo('logistics'), createTrackingLink);


// Drivers map statuses dynamically e.g. "transit", "delivered"
// Ending a delivery here also closes any rider assignment and frees the rider.
const { withAssignmentSync, getAssignment, assignRider, cancelAssignment } = require('../controllers/dispatch.controller');
router.patch('/shipments/:id/status', restrictTo('logistics', 'admin'), withAssignmentSync(modifyShipmentStatus));

// ── Rider assignment (own shipments) ──
router.get('/shipments/:id/assignment', restrictTo('logistics'), getAssignment);
router.post('/shipments/:id/assign', restrictTo('logistics'), assignRider);
router.post('/shipments/:id/assignment/cancel', restrictTo('logistics'), cancelAssignment);


module.exports = router;
