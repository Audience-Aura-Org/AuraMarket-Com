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

// NOTE: createStatus now handles subscription validation internally (see controller)
// This allows for better error messaging and mobile debugging
router.route('/')
  .post(createStatus);

router.get('/my-statuses', getMyStatuses);

// Apply subscription requirement only to delete and react operations
router.use(requireActiveSubscription());

router.route('/:id')
  .delete(deleteStatus);

router.post('/:id/react', reactToStatus);

module.exports = router;
