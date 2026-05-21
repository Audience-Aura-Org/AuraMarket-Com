/**
 * models/Store.model.js
 * Aura Market — Store Details
 *
 * Linked to the Vendor model. Defines the visual representation
 * of the vendor's enterprise (banner, logo, categories, followers).
 */

const mongoose = require('mongoose');

const StoreSchema = new mongoose.Schema(
  {
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Store must be linked to a Vendor'],
      unique: true, // One store per vendor
    },
    banner: {
      type: String,
      default: null,
    },
    logo: {
      type: String,
      default: null,
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    categories: [
      {
        type: String,
        trim: true,
      },
    ],
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add an index to efficiently query stores by category
StoreSchema.index({ categories: 1 });

module.exports = mongoose.model('Store', StoreSchema);
