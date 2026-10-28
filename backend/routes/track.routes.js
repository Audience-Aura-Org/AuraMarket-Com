const express = require('express');
const { protectOptional } = require('../middleware/auth.middleware');
const { trackingLimiter } = require('../middleware/rateLimiter');
const { trackByLink } = require('../controllers/agencyPackage.controller');

const router = express.Router();
router.get('/:token', trackingLimiter, protectOptional, trackByLink);

module.exports = router;
