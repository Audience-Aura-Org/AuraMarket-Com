const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  initializePayment,
  verifyPayment,
  handleWebhook
} = require('../controllers/payment.controller');

// Webhook must be public and come BEFORE protect middleware
router.post('/webhook', handleWebhook);

router.use(protect);

router.post('/initialize', initializePayment);
router.get('/verify/:reference', verifyPayment);

module.exports = router;
