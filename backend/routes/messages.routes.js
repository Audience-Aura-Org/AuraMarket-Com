/**
 * routes/messages.routes.js
 * Auradime — Shipment & Order Messages Routes
 */

const express = require('express');
const router = express.Router();
const { protect, protectOptional } = require('../middleware/auth.middleware');
const { actAs } = require('../middleware/delegate.middleware');
const {
  getShipmentMessages,
  sendShipmentMessage,
  getLogisticsMessages,
  getMyShipmentThreads,
  markShipmentThreadRead,
} = require('../controllers/messages.controller');
const {
  getOrderMessages,
  sendOrderMessage,
  getMyOrderThreads,
  markOrderThreadRead,
} = require('../controllers/orderMessages.controller');

// ── SHIPMENT MESSAGES (for tracking page) ──────────────────────────
router.get('/shipment/:shipmentId', getShipmentMessages);
router.post('/shipment/:shipmentId', protectOptional, sendShipmentMessage);

// ── ORDER MESSAGES (buyer/vendor/logistics thread) ─────────────────
router.get('/order/:orderId', protect, actAs, getOrderMessages);
router.post('/order/:orderId', protect, actAs, sendOrderMessage);
router.get('/order-threads/mine', protect, actAs, getMyOrderThreads);
router.patch('/order/:orderId/read', protect, actAs, markOrderThreadRead);

// ── MY SHIPMENT THREADS (P2P deliveries in chat/messages) ──────────
router.get('/shipment-threads/mine', protect, actAs, getMyShipmentThreads);
router.patch('/shipment/:shipmentId/read', protect, actAs, markShipmentThreadRead);

// ── LOGISTICS ROUTES ────────────────────────────────────────────────
router.get('/logistics/all', protectOptional, getLogisticsMessages);

module.exports = router;
