const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  createStatus,
  getActiveStatuses,
  reactToStatus,
  viewStatus,
  getMyStatuses,
  deleteStatus
} = require('../controllers/status.controller');

router.use(protect); // Protect all status routes

router.route('/')
  .get(getActiveStatuses)
  .post(createStatus);

router.get('/my-statuses', getMyStatuses);

router.route('/:id')
  .delete(deleteStatus);

router.post('/:id/react', reactToStatus);
router.post('/:id/view', viewStatus);

module.exports = router;
