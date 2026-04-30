const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { getWishlist, toggleWishlist } = require('../controllers/wishlist.controller');

router.use(protect);

router.get('/', getWishlist);
router.post('/toggle/:productId', toggleWishlist);

module.exports = router;
