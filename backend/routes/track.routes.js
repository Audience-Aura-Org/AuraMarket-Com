const express = require('express');
const { protectOptional } = require('../middleware/auth.middleware');
const { trackingLimiter, liveTrackingLimiter } = require('../middleware/rateLimiter');
const { liveByLink } = require('../controllers/liveTracking.controller');
const { trackByLink } = require('../controllers/agencyPackage.controller');

const router = express.Router();
router.get('/:token/live', liveTrackingLimiter, liveByLink);
router.get('/:token', trackingLimiter, protectOptional, trackByLink);

module.exports = router;
