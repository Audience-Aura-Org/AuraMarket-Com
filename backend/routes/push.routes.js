const express = require('express');
const router = express.Router();
const { getVapidPublicKey, subscribe, unsubscribe, purgeAll } = require('../controllers/push.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', protect, subscribe);
router.post('/unsubscribe', protect, unsubscribe);
router.delete('/purge-all', protect, purgeAll);

module.exports = router;
