/**
 * routes/homepage.routes.js
 * Auradime — Homepage & Storefront Builder Routes
 */

const express = require('express');
const router = express.Router();

const {
  getHomepage,
  getAdminSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections
} = require('../controllers/homepage.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// ── Public Routes ─────────────────────────────
router.get('/', getHomepage);

// ── Admin Routes ──────────────────────────────
router.get('/admin/sections', protect, restrictTo('admin', 'manager'), getAdminSections);
router.post('/admin/sections', protect, restrictTo('admin', 'manager'), createSection);
router.patch('/admin/sections/reorder', protect, restrictTo('admin', 'manager'), reorderSections);
router.patch('/admin/sections/:id', protect, restrictTo('admin', 'manager'), updateSection);
router.delete('/admin/sections/:id', protect, restrictTo('admin', 'manager'), deleteSection);

module.exports = router;
