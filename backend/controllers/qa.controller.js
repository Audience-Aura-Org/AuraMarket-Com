const Question = require('../models/Question.model');
const Product = require('../models/Product.model');
const Vendor = require('../models/Vendor.model');
const { sendNotification } = require('../utils/notifier');

/**
 * controllers/qa.controller.js
 * Logic for product questions and answers.
 */

// @route   POST /api/qa/ask
// @desc    Ask a question about a product
// @access  Private
const askQuestion = async (req, res, next) => {
  try {
    const { product_id, question_text } = req.body;

    const question = await Question.create({
      product_id,
      user_id: req.user._id,
      question_text
    });

    // Notify Vendor
    const product = await Product.findById(product_id);
    const vendor = await Vendor.findById(product.vendor_id);
    
    await sendNotification(req.app, vendor.user_id, {
      title: 'New Product Question',
      message: `A buyer has a question about "${product.name}".`,
      type: 'system_alert'
    });

    res.status(201).json({ success: true, data: { question } });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/qa/answer/:id
// @desc    Answer a product question
// @access  Private (Vendor)
const answerQuestion = async (req, res, next) => {
  try {
    const { answer_text } = req.body;
    const question = await Question.findById(req.params.id);

    if (!question) return res.status(404).json({ success: false, message: 'Question not found.' });

    // Verify vendor owns the product
    const product = await Product.findById(question.product_id);
    const vendor = await Vendor.findOne({ user_id: req.user._id });

    if (!vendor || product.vendor_id.toString() !== vendor._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    question.answer_text = answer_text;
    question.answered_by = req.user._id;
    question.answered_at = new Date();
    await question.save();

    // Notify Asker
    await sendNotification(req.app, question.user_id, {
      title: 'Question Answered',
      message: `The vendor has answered your question about "${product.name}".`,
      type: 'system_alert'
    });

    res.status(200).json({ success: true, message: 'Answer posted.', data: { question } });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/qa/product/:productId
// @desc    Get all public Q&A for a product
// @access  Public
const getProductQA = async (req, res, next) => {
  try {
    const questions = await Question.find({ product_id: req.params.productId, is_public: true })
      .populate('user_id', 'name avatar')
      .populate('answered_by', 'name role')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: questions.length, data: { questions } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  askQuestion,
  answerQuestion,
  getProductQA
};
