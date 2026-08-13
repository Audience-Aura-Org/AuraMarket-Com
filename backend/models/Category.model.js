const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      type: String, // Icon name or URL
    },
    order: {
      type: Number,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },

    // Phase 3-D: Surface discriminator.
    // 'retail'     — appears on retail product browse / search only
    // 'restaurant' — appears on /dine page only (cuisine types + meal categories)
    // 'both'       — appears on both surfaces
    applies_to: {
      type: String,
      enum: ['retail', 'restaurant', 'both'],
      default: 'retail',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Slug generation middleware could be added here or in the controller

module.exports = mongoose.model('Category', CategorySchema);
