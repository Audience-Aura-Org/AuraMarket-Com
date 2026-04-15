const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { validateCoupon, createCoupon } = require('../controllers/coupon.controller');

router.use(protect);

router.post('/validate', validateCoupon);
router.post('/', createCoupon);

module.exports = router;
