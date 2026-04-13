const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  askQuestion,
  answerQuestion,
  getProductQA
} = require('../controllers/qa.controller');

// Public
router.get('/product/:productId', getProductQA);

// Protected
router.post('/ask', protect, askQuestion);
router.patch('/answer/:id', protect, answerQuestion);

module.exports = router;
