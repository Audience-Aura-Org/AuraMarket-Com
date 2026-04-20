const Legal = require('../models/Legal.model');

/**
 * controllers/legal.controller.js
 * Logic for fetching and managing legal documents.
 */

// @route   GET /api/v1/legal/:type
// @desc    Get the active version of a legal document
// @access  Public
const getLegalDocument = async (req, res, next) => {
  try {
    const doc = await Legal.findOne({ type: req.params.type, is_active: true });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }
    res.status(200).json({ success: true, data: { doc } });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/v1/legal
// @desc    Create or update a legal document (Admin only)
// @access  Private (Admin)
const updateLegalDocument = async (req, res, next) => {
  try {
    const { type, content, version } = req.body;

    // Set existing active doc of this type to inactive
    await Legal.updateMany({ type }, { is_active: false });

    const doc = await Legal.create({
      type,
      content,
      version,
      last_updated_by: req.user._id,
      is_active: true
    });

    res.status(201).json({ success: true, message: 'Legal document updated.', data: { doc } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLegalDocument,
  updateLegalDocument
};
