/**
 * routes/auth.routes.js
 * Auradime — Authentication Routes
 *
 * Public:
 *   POST   /api/auth/register
 *   POST   /api/auth/login
 *
 * Private (JWT required):
 *   GET    /api/auth/me
 *   PATCH  /api/auth/update-profile
 *   PATCH  /api/auth/change-password
 */

const express = require('express');
const router = express.Router();

const {
  register,
  login,
  verify2FALogin,
  getMe,
  getUser,
  updateProfile,
  changePassword,
  getAdminInfo,
} = require('../controllers/auth.controller');

const { protect } = require('../middleware/auth.middleware');

// ── Public Routes ─────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.post('/verify-2fa', verify2FALogin);

// ── Private Routes (JWT required) ─────────────
router.get('/me', protect, getMe);
router.get('/admin-info', protect, getAdminInfo);
router.get('/users/:id', protect, getUser);
router.patch('/update-profile', protect, updateProfile);
router.patch('/change-password', protect, changePassword);

module.exports = router;
