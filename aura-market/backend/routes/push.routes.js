const express = require('express');
const router = express.Router();
const { subscribe, unsubscribe } = require('../controllers/push.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/subscribe', protect, subscribe);
router.post('/unsubscribe', protect, unsubscribe);

module.exports = router;
