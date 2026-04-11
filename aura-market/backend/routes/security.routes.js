const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  generate2FA,
  enable2FA,
  disable2FA
} = require('../controllers/security.controller');

// All security routes require authentication
router.use(protect);

router.get('/2fa/generate', generate2FA);
router.post('/2fa/enable', enable2FA);
router.post('/2fa/disable', disable2FA);

module.exports = router;
