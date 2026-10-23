const express = require('express');
const router = express.Router();
const { getPreferences, updatePreferences } = require('../controllers/notificationPreferences.controller');

const { protect } = require('../middleware/auth.middleware');
router.get('/notification-preferences', protect, getPreferences);
router.patch('/notification-preferences', protect, updatePreferences);
const { updateMe, submitKYC, getFollowedVendors, getMe, completeOnboarding } = require('../controllers/users.controller');
 
 // Private — update current user
 router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.post('/kyc', protect, submitKYC);
router.get('/followed-vendors', protect, getFollowedVendors);
router.patch('/onboarding', protect, completeOnboarding);
 
 module.exports = router;
