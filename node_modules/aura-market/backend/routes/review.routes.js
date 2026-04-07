const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { 
  submitReview, 
  getProductReviews, 
  getAllReviews, 
  deleteReview 
} = require('../controllers/review.controller');

// Public
router.get('/product/:id', getProductReviews);

// Protected (Customer)
router.post('/', protect, submitReview);

// Admin Only
router.get('/admin', protect, restrictTo('admin'), getAllReviews);
router.delete('/:id', protect, restrictTo('admin'), deleteReview);

module.exports = router;
