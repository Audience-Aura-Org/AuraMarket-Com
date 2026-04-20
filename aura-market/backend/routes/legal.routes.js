const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { getLegalDocument, updateLegalDocument } = require('../controllers/legal.controller');

// Public
router.get('/:type', getLegalDocument);

// Admin Only
router.post('/', protect, restrictTo('admin'), updateLegalDocument);

module.exports = router;
