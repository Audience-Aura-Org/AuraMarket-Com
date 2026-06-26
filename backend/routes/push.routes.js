const express = require('express');
const router = express.Router();
const { getVapidPublicKey, subscribe, saveNativeToken, removeNativeToken, unsubscribe, purgeAll } = require('../controllers/push.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', protect, subscribe);
router.post('/native-token', protect, saveNativeToken);
router.delete('/native-token', protect, removeNativeToken);
router.post('/unsubscribe', protect, unsubscribe);
router.delete('/unsubscribe', protect, unsubscribe);
router.delete('/purge-all', protect, purgeAll);

module.exports = router;
