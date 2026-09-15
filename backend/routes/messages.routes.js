/**
 * routes/messages.routes.js
 * Auradime — Shipment Messages Routes
 */

const express = require('express');
const router = express.Router();
const { protectOptional } = require('../middleware/auth');
const {
  getShipmentMessages,
  sendShipmentMessage,
  getLogisticsMessages,
} = require('../controllers/messages.controller');

// ── PUBLIC ROUTES (for tracking page) ──────────────────────────────
router.get('/shipment/:shipmentId', getShipmentMessages);
router.post('/shipment/:shipmentId', protectOptional, sendShipmentMessage);

// ── LOGISTICS ROUTES ────────────────────────────────────────────────
router.get('/logistics/all', protectOptional, getLogisticsMessages);

module.exports = router;
