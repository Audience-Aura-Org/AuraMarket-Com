const mongoose = require('mongoose');

/**
 * models/UserActivity.model.js
 * Aura Market — Tracking user interactions for discovery personalization
 */
const UserActivitySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      index: true
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      index: true
    },
    category: {
      type: String,
      trim: true,
      index: true
    },
    action_type: {
      type: String,
      enum: ['view', 'search', 'wishlist', 'purchase', 'cart_add', 'vendor_visit'],
      required: true,
      index: true
    },
    search_query: {
      type: String,
      trim: true
    },
    metadata: {
      time_spent: Number, // for 'view' actions
      platform: String,
      device: String
    }
  },
  {
    timestamps: { createdAt: 'timestamp', updatedAt: false }
  }
);

// Index for getting recent user interests
UserActivitySchema.index({ user_id: 1, timestamp: -1 });
UserActivitySchema.index({ product_id: 1, action_type: 1 });

module.exports = mongoose.model('UserActivity', UserActivitySchema);
