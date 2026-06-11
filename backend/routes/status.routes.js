const express = require('express');
const router = express.Router();
const { protect, protectOptional } = require('../middleware/auth.middleware');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');
const {
  createStatus,
  getActiveStatuses,
  reactToStatus,
  viewStatus,
  getMyStatuses,
  getStatusById,
  deleteStatus
} = require('../controllers/status.controller');

router.get('/', protectOptional, getActiveStatuses);
router.get('/story/:id', protectOptional, getStatusById);
router.post('/:id/view', protectOptional, viewStatus);

router.use(protect); // Protect all write/private status routes
router.use(requireActiveSubscription());

router.route('/')
  .post(createStatus);

router.get('/my-statuses', getMyStatuses);

router.route('/:id')
  .delete(deleteStatus);

router.post('/:id/react', reactToStatus);

module.exports = router;
