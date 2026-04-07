const mongoose = require('mongoose');

/**
 * models/Question.model.js
 * Aura Market — Product Q&A
 */
const QuestionSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    question_text: {
      type: String,
      required: true,
      maxlength: 300
    },
    answer_text: {
      type: String,
      default: null,
      maxlength: 500
    },
    answered_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    answered_at: {
      type: Date,
      default: null
    },
    is_public: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Question', QuestionSchema);
