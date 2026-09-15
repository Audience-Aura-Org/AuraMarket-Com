/**
 * routes/messages.routes.js
 * Auradime — Shipment & Order Messages Routes
 */

const express = require('express');
const router = express.Router();
const { protect, protectOptional } = require('../middleware/auth.middleware');
const {
  getShipmentMessages,
  sendShipmentMessage,
  getLogisticsMessages,
} = require('../controllers/messages.controller');
const {
  getOrderMessages,
  sendOrderMessage,
  getMyOrderThreads,
} = require('../controllers/orderMessages.controller');

// ── SHIPMENT MESSAGES (for tracking page) ──────────────────────────
router.get('/shipment/:shipmentId', getShipmentMessages);
router.post('/shipment/:shipmentId', protectOptional, sendShipmentMessage);

// ── ORDER MESSAGES (buyer/vendor/logistics thread) ─────────────────
router.get('/order/:orderId', protect, getOrderMessages);
router.post('/order/:orderId', protect, sendOrderMessage);
router.get('/order-threads/mine', protect, getMyOrderThreads);

// ── LOGISTICS ROUTES ────────────────────────────────────────────────
router.get('/logistics/all', protectOptional, getLogisticsMessages);

module.exports = router;
