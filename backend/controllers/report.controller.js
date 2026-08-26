const Report = require('../models/Report.model');

/**
 * controllers/report.controller.js
 * Handles submission of user reports.
 */

// @route   POST /api/reports
// @desc    Submit a report against a user, product, or vendor
// @access  Private
const submitReport = async (req, res, next) => {
  try {
    const { target_id, target_type, reason, description } = req.body;
    const allowedTargetTypes = new Set(['user', 'product', 'vendor', 'message']);
    const allowedReasons = new Set(['scam_fraud', 'prohibited_item', 'offensive_content', 'counterfeit', 'harassment', 'other']);
    if (!target_id || !allowedTargetTypes.has(target_type) || !allowedReasons.has(reason) || !String(description || '').trim()) {
      return res.status(400).json({ success: false, message: 'A target, valid target type, reason, and description are required.' });
    }

    const report = await Report.create({
      reporter_id: req.user._id,
      target_id,
      target_type,
      reason: String(reason).trim(),
      description: String(description).trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Our team will review it shortly.',
      data: { report }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { submitReport };
