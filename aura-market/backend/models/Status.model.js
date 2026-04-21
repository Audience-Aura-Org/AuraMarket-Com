/**
 * models/Status.model.js
 * Aura Market — Vendor Stories (Status)
 * 
 * Temporary updates (24h) posted by vendors to drive engagement.
 */

const mongoose = require('mongoose');

const StatusSchema = new mongoose.Schema(
  {
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['image', 'video', 'text'],
      required: true
    },
    content_url: {
      type: String, // URL to media
    },
    text_content: {
      type: String, // For text-type statuses
      maxlength: [1000, 'Status text cannot exceed 1000 characters']
    },
    linked_product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [200, 'Caption cannot exceed 200 characters']
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    },
    views_count: {
      type: Number,
      default: 0,
      index: true
    },
    viewer_ids: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ],
    reactions: [
      {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        type: { type: String, default: 'heart' },
        created_at: { type: Date, default: Date.now }
      }
    ],
    // Cache count for easier sorting in the Status tab
    likes_count: {
      type: Number,
      default: 0,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-save to update likes_count
StatusSchema.pre('save', function() {
  if (this.isModified('reactions')) {
    this.likes_count = this.reactions?.length || 0;
  }
});

// Index for finding active statuses quickly
StatusSchema.index({ expires_at: 1, vendor_id: 1 });

module.exports = mongoose.model('Status', StatusSchema);
