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
} = require('../controllers/auth.controller');

const { protect, protectOptional } = require('../middleware/auth.middleware');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/logout', protectOptional, logout);

router.get('/me', protect, getMe);
router.get('/admin-info', protect, getAdminInfo);
router.get('/users/:id', protect, getUser);
router.patch('/update-profile', protect, updateProfile);
router.post('/delete-account', protect, deleteAccount);

module.exports = router;
