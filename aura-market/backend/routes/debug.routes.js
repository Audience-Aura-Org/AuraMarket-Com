const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const Vendor = require('../models/Vendor.model');

// GET /api/v1/debug/vendor-mapping
// Returns the authenticated user id and associated vendor profile (if any).
router.get('/vendor-mapping', protect, async (req, res, next) => {
  try {
    const user = req.user;
    const vendor = await Vendor.findOne({ user_id: user._id });
    return res.status(200).json({ success: true, data: { user, vendor } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/debug/vendors-list
// Admin-only: list all vendor records with their user_id values to help detect mismatches
router.get('/vendors-list', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const vendors = await Vendor.find({}).select('user_id store_name createdAt updatedAt').lean();
    return res.status(200).json({ success: true, count: vendors.length, data: { vendors } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
