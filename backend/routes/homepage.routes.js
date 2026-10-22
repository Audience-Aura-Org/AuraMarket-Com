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
router.get('/admin/sections', protect, restrictTo('admin'), getAdminSections);
router.post('/admin/sections', protect, restrictTo('admin'), createSection);
router.patch('/admin/sections/reorder', protect, restrictTo('admin'), reorderSections);
router.patch('/admin/sections/:id', protect, restrictTo('admin'), updateSection);
router.delete('/admin/sections/:id', protect, restrictTo('admin'), deleteSection);

module.exports = router;
