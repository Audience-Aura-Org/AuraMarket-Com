const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { verifyWebhook, getMyWhatsApp, updateMyWhatsApp } = require('../controllers/whatsapp.controller');

const router = express.Router();
// Meta's verification handshake (the signed POST is mounted in server.js with a raw body).
router.get('/webhook', verifyWebhook);
router.get('/me', protect, getMyWhatsApp);
router.put('/me', protect, updateMyWhatsApp);

module.exports = router;
