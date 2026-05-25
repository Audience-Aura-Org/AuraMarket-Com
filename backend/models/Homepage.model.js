/**
 * models/Homepage.model.js
 * Auradime — Homepage Configurations
 *
 * Stores dynamic layouts directly controllable by Administrators.
 * e.g., Top hero banners, explicit ordering of "Featured Products".
 */

const mongoose = require('mongoose');

const HomepageSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      default: 'v1',
      unique: true, // Typically, we just update the 'v1' document constantly, or store drafts.
    },
    hero_banners: [
      {
        image_url: { type: String, required: true },
        link_to: { type: String }, // e.g., "/categories/electronics" or "/stores/123"
        is_active: { type: Boolean, default: true },
        display_order: { type: Number, default: 0 },
      },
    ],
    featured_products: [
      {
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        display_order: { type: Number, default: 0 },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Homepage', HomepageSchema);
