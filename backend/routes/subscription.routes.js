const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const {
  getMySubscription,
  initializeSubscription,
  getAdminOverview,
  createPlan,
  updatePlan,
  deletePlan,
  updateRoleRequirements,
  activateUserSubscription,
  updateUserSubscription,
  deleteUserSubscription,
} = require('../controllers/subscription.controller');

router.use(protect);

router.get('/me', getMySubscription);
router.post('/initialize', initializeSubscription);

router.use('/admin', restrictTo('admin'));
router.get('/admin/overview', getAdminOverview);
router.post('/admin/plans', createPlan);
router.patch('/admin/plans/:id', updatePlan);
router.delete('/admin/plans/:id', deletePlan);
router.patch('/admin/requirements', updateRoleRequirements);
router.post('/admin/subscriptions/activate', activateUserSubscription);
router.patch('/admin/subscriptions/:id', updateUserSubscription);
router.delete('/admin/subscriptions/:id', deleteUserSubscription);

module.exports = router;
