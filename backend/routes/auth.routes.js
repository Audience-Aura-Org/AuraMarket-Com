const express = require('express');
const router = express.Router();

const {
  sendOtp,
  verifyOtp,
  deleteAccount,
  getMe,
  getUser,
  updateProfile,
  getAdminInfo,
} = require('../controllers/auth.controller');

const { protect } = require('../middleware/auth.middleware');

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

router.get('/me', protect, getMe);
router.get('/admin-info', protect, getAdminInfo);
router.get('/users/:id', protect, getUser);
router.patch('/update-profile', protect, updateProfile);
router.post('/delete-account', protect, deleteAccount);

module.exports = router;
