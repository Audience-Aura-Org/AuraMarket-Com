const mongoose = require('mongoose');

/**
 * models/Follow.model.js
 * Tracks users following vendors.
 */
const FollowSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate follows
FollowSchema.index({ user_id: 1, vendor_id: 1 }, { unique: true });

module.exports = mongoose.model('Follow', FollowSchema);
