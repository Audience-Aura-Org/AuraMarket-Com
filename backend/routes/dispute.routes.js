/**
 * routes/dispute.routes.js
 * Auradime — Dispute Routes
 */

const express = require('express');
const router = express.Router();
const { createDispute, getAdminDisputes, getCustomerDisputes } = require('../controllers/dispute.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { loadManagerScope } = require('../middleware/managerScope.middleware');

// Protect all routes
router.use(protect);

// Customer routes
router.post('/', createDispute);
router.get('/customer', getCustomerDisputes);

// Admin routes
router.get('/admin', restrictTo('admin', 'manager'), loadManagerScope, getAdminDisputes);

module.exports = router;
