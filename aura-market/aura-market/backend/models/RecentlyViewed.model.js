const mongoose = require('mongoose');

/**
 * models/RecentlyViewed.model.js
 * Aura Market — Tracking user browsing history for recommendations
 */
const RecentlyViewedSchema = new mongoose.Schema(
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
      required: true
    },
    viewed_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false // already have viewed_at
  }
);

// We only want to keep the last 20 views per user for efficiency
RecentlyViewedSchema.index({ user_id: 1, viewed_at: -1 });

module.exports = mongoose.model('RecentlyViewed', RecentlyViewedSchema);
