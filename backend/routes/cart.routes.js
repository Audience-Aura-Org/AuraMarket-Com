const express = require('express');
const router = express.Router();
const { addToCart, getCart, removeFromCart, updateCartQuantity, clearCart } = require('../controllers/cart.controller');
const { protect } = require('../middleware/auth.middleware');

// All cart operations require authentication
router.get('/', protect, getCart);
router.post('/', protect, addToCart);
router.patch('/item', protect, updateCartQuantity);
router.delete('/item', protect, removeFromCart);
router.delete('/clear', protect, clearCart);

module.exports = router;
