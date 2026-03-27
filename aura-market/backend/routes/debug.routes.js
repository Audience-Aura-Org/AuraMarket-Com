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

const { transporter } = require('../utils/notifier');
const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER } = require('../config/env');

// GET /api/v1/debug/smtp-test
// Diagnoses SMTP connection issues
router.get('/smtp-test', protect, restrictTo('admin'), async (req, res) => {
  try {
    const start = Date.now();
    await transporter.verify();
    const duration = Date.now() - start;
    
    return res.status(200).json({ 
      success: true, 
      message: 'SMTP is correctly configured and reachable.',
      config: {
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        user: EMAIL_USER ? `${EMAIL_USER.substring(0, 3)}...` : 'not set'
      },
      duration: `${duration}ms`
    });
  } catch (err) {
    return res.status(500).json({ 
      success: false, 
      error: err.message,
      code: err.code,
      command: err.command,
      config: {
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        user: EMAIL_USER ? `${EMAIL_USER.substring(0, 3)}...` : 'not set'
      }
    });
  }
});

module.exports = router;
