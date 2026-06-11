const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const {
  getMySubscription,
  initializeSubscription,
  getAdminOverview,
  createPlan,
  updatePlan,
  updateRoleRequirements,
  activateUserSubscription,
  updateUserSubscription,
} = require('../controllers/subscription.controller');

router.use(protect);

router.get('/me', getMySubscription);
router.post('/initialize', initializeSubscription);

router.use('/admin', restrictTo('admin'));
router.get('/admin/overview', getAdminOverview);
router.post('/admin/plans', createPlan);
router.patch('/admin/plans/:id', updatePlan);
router.patch('/admin/requirements', updateRoleRequirements);
router.post('/admin/subscriptions/activate', activateUserSubscription);
router.patch('/admin/subscriptions/:id', updateUserSubscription);

module.exports = router;
