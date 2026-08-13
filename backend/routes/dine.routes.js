/**
 * routes/dine.routes.js
 * Auradime — Public Dine Page Routes
 *
 *   GET /api/dine?zone_id=                 — district-scoped restaurant + meal feed
 *   GET /api/dine/restaurant/:vendor_id    — full restaurant menu (detail page)
 */

const express = require('express');
const router = express.Router();
const { getDinePage, getRestaurantMenu } = require('../controllers/restaurant.controller');

router.get('/',                       getDinePage);
router.get('/restaurant/:vendor_id',  getRestaurantMenu);

module.exports = router;
