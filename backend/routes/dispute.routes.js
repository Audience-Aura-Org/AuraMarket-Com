/**
 * routes/dispute.routes.js
 * Aura Market — Dispute Routes
 */

const express = require('express');
const router = express.Router();
const { createDispute, getAdminDisputes, getCustomerDisputes } = require('../controllers/dispute.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// Protect all routes
router.use(protect);

// Customer routes
router.post('/', createDispute);
router.get('/customer', getCustomerDisputes);

// Admin routes
router.get('/admin', restrictTo('admin'), getAdminDisputes);

module.exports = router;
