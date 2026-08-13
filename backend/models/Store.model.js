/**
 * models/Store.model.js
 * Auradime — Store Details
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
    categories: [
      {
        type: String,
        trim: true,
      },
    ],
    commission_rate: {
      type: Number,
      default: null,
      min: [0, 'Commission rate cannot be below 0'],
      max: [100, 'Commission rate cannot exceed 100'],
    },
    delivery_time: {
      type: String,
      trim: true,
      maxlength: [80, 'Delivery time cannot exceed 80 characters'],
      default: null,
    },
    // Numeric range replacing the legacy free-text delivery_time string.
    // delivery_time_days_min = best-case, delivery_time_days_max = worst-case (in days).
    delivery_time_days_min: {
      type: Number,
      default: null,
      min: [0, 'Min delivery days cannot be below 0'],
    },
    delivery_time_days_max: {
      type: Number,
      default: null,
      min: [0, 'Max delivery days cannot be below 0'],
    },
    // Phase 4 Step 6: order subtotal threshold above which the vendor waives
    // the intercity transit fee. Null = no free-shipping offer.
    free_shipping_threshold: {
      type: Number,
      default: null,
      min: [0, 'Free-shipping threshold cannot be below 0'],
    },
    minimum_order_amount: {
      type: Number,
      default: null,
      min: [0, 'Minimum order amount cannot be below 0'],
    },
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
StoreSchema.index({ is_active: 1, updatedAt: -1 });
StoreSchema.index({ vendor_id: 1, is_active: 1 });

module.exports = mongoose.model('Store', StoreSchema);
