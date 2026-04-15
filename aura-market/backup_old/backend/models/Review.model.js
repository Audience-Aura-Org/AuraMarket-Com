const mongoose = require('mongoose');

/**
 * models/Review.model.js
 * Aura Market — Product Reviews & Ratings
 */
const ReviewSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true // verified buyer only
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true,
      maxlength: 500
    },
    images: [String] // Optional review photos
  },
  {
    timestamps: true
  }
);

// Prevent multiple reviews for the same order/item pair from the same user
ReviewSchema.index({ user_id: 1, product_id: 1, order_id: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);
