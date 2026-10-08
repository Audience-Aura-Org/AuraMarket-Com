/**
 * routes/dispute.routes.js
 * Auradime — Dispute Routes
 */

const express = require('express');
const router = express.Router();
const { createDispute, getAdminDisputes, getCustomerDisputes } = require('../controllers/dispute.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { actAs } = require('../middleware/delegate.middleware');
const { loadManagerScope } = require('../middleware/managerScope.middleware');

// Protect all routes
// actAs lets managers work as a user via X-Act-As header
router.use(protect);
router.use(actAs);

// Customer routes
router.post('/', createDispute);
router.get('/customer', getCustomerDisputes);

// Admin routes
router.get('/admin', restrictTo('admin', 'manager'), loadManagerScope, getAdminDisputes);

module.exports = router;
