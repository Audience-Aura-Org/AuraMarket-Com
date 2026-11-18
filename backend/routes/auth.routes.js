const express = require('express');
const router = express.Router();

const {
  sendOtp,
  verifyOtp,
  logout,
  deleteAccount,
  getMe,
  getUser,
  updateProfile,
  getAdminInfo,
  createGuestSession,
  claimGuestSession,
} = require('../controllers/auth.controller');
const { guestSessionLimiter } = require('../middleware/rateLimiter');

const { protect, protectOptional, blockGuests } = require('../middleware/auth.middleware');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/guest', guestSessionLimiter, createGuestSession);
router.post('/guest/claim', protect, blockGuests, claimGuestSession);
router.post('/logout', protectOptional, logout);

router.get('/me', protect, getMe);
router.get('/admin-info', protect, getAdminInfo);
router.get('/users/:id', protect, getUser);
router.patch('/update-profile', protect, blockGuests, updateProfile);
router.post('/delete-account', protect, blockGuests, deleteAccount);

module.exports = router;
