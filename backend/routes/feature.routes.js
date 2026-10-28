const express = require('express');
const PlatformSettings = require('../models/PlatformSettings.model');
const { readFlags } = require('../utils/featureFlags');

const router = express.Router();

/** GET /features — rollout flags only (no other platform settings). */
router.get('/', async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();
    res.json({ success: true, data: { features: readFlags(settings) } });
  } catch (err) { next(err); }
});

module.exports = router;
