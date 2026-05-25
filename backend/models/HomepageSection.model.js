/**
 * models/HomepageSection.model.js
 * Auradime — Modular Homepage Sections
 */

const mongoose = require('mongoose');

const HomepageSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'hero', 
        'categories', 
        'featured_products', 
        'trending', 
        'promo_banner', 
        'stores', 
        'collection', 
        'recommendations', 
        'footer_promo'
      ],
    },
    order: {
      type: Number,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    config: {
      // Flexible object for section-specific settings
      // e.g., grid vs carousel, autoplay speed, item counts
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    data: [
      {
        // For 'hero', 'promo_banner', 'footer_promo'
        image_url: String,
        link_to: String,
        headline: String,
        subtext: String,
        cta_text: String,
        
        // For 'featured_products', 'collection', 'trending'
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        },
        
        // For 'categories'
        category_name: String,

        // For 'stores'
        vendor_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor'
        },

        display_order: { type: Number, default: 0 }
      }
    ],
    // Scheduling
    scheduled_start: Date,
    scheduled_end: Date,
  },
  {
    timestamps: true,
  }
);

// Index for efficient ordering
HomepageSectionSchema.index({ order: 1, is_active: 1 });

module.exports = mongoose.model('HomepageSection', HomepageSectionSchema);
