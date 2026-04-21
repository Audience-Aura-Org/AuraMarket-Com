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

router.get('/', getActiveStatuses);
router.post('/:id/view', viewStatus);

router.use(protect); // Protect all write/private status routes

router.route('/')
  .post(createStatus);

router.get('/my-statuses', getMyStatuses);

router.route('/:id')
  .delete(deleteStatus);

router.post('/:id/react', reactToStatus);

module.exports = router;
