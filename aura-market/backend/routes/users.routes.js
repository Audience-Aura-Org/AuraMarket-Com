const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth.middleware');
const { updateMe, submitKYC, getFollowedVendors, getMe, completeOnboarding } = require('../controllers/users.controller');
 
 // Private — update current user
 router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.post('/kyc', protect, submitKYC);
router.get('/followed-vendors', protect, getFollowedVendors);
router.patch('/onboarding', protect, completeOnboarding);
 
 module.exports = router;
