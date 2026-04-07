const express = require('express');
const router = express.Router();
const { trackAction } = require('../controllers/tracking.controller');
const { protectOptional } = require('../middleware/auth.middleware');

// Tracking can be anonymous or authenticated
router.post('/', protectOptional, trackAction);

module.exports = router;
