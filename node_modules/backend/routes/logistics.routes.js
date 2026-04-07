/**
 * routes/logistics.routes.js
 * Aura Market — Logistics Router Maps
 */

const express = require('express');
const router = express.Router();

const {
  onboardLogistics,
  getFirmShipments,
  getVendorShipments,
  modifyShipmentStatus,
  getPublicLogisticsFirms,
  getZones,
  getSearchCompatibleFirms,
  getProfile,
  updatePricing
} = require('../controllers/logistics.controller');


const { protect, restrictTo } = require('../middleware/auth.middleware');

// ── Public Discovery ──────────────────────────
router.get('/', getPublicLogisticsFirms);
router.get('/zones', getZones);
router.get('/compatible-firms', getSearchCompatibleFirms);

router.use(protect);

// ── Vendor Actions ────────────────────────────
router.get('/shipments/vendor', restrictTo('vendor', 'admin'), getVendorShipments);

// ── Logistics Firm Dashboard ──
router.post('/onboard', onboardLogistics);
router.get('/shipments/firm', restrictTo('logistics', 'admin'), getFirmShipments);
router.get('/profile', restrictTo('logistics', 'admin'), getProfile);
router.patch('/pricing', restrictTo('logistics', 'admin'), updatePricing);


// Drivers map statuses dynamically e.g. "transit", "delivered"
router.patch('/shipments/:id/status', restrictTo('logistics', 'admin'), modifyShipmentStatus);


module.exports = router;
