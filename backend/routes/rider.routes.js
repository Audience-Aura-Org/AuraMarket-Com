const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { getMyRiderProfile, acceptInvite, declineInvite, setAvailability } = require('../controllers/rider.controller');

const router = express.Router();
router.use(protect);

router.get('/me', getMyRiderProfile);
router.post('/me/accept', acceptInvite);
router.post('/me/decline', declineInvite);
router.patch('/me/availability', setAvailability);

module.exports = router;
