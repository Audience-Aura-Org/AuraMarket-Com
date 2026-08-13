/**
 * models/Vendor.model.js
 * Auradime — Vendor Profile
 *
 * Links directly to the User model. Holds vendor-specific metrics
 * like verification status, overall rating, and subscription details.
 */

const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vendor must be linked to a User'],
      unique: true, // A user can only have one vendor profile
    },
    store_name: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      maxlength: [100, 'Store name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be below 0'],
      max: [5, 'Rating cannot exceed 5'],
    },
    verified: {
      type: Boolean,
      default: false, // Standard vendors are unverified by default
    },
    subscription_plan: {
      type: String,
      trim: true,
      default: null,
    },
    total_sales: {
      type: Number,
      default: 0,
    },
    total_revenue: {
      type: Number,
      default: 0,
    },
    follower_count: {
      type: Number,
      default: 0,
    },
    onboarding_step: {
      type: String,
      enum: ['profile', 'kyc', 'store_setup', 'complete'],
      default: 'profile'
    },
    is_onboarded: {
      type: Boolean,
      default: false
    },
    pickup_address: {
      street: String,
      address_description: String,
      city: String,
      district: String,
      region: String,
      quartier: String,
      // zone_id added in Phase 1 migration — backfilled by 04_zone_vendor_pickup.js
      // Points to the district-level LogisticZone (vendors confirmed to store
      // their city = district name). String fields kept for rollback / display.
      zone_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LogisticZone',
        default: null,
      },
    },
    phone: {
      type: String,
      required: [true, 'Vendor phone number is required for logistics'],
    },
    average_response_time: {
      type: String,
      default: '⚡ < 5m', // e.g., "15m", "1h", "⚡ < 5m"
    },
    // Discriminator added in Phase 3 — no restaurant/digital fields live here.
    // All type-specific data goes in RestaurantProfile (1:1 with vendor_id).
    vendor_type: {
      type: String,
      enum: ['retail', 'restaurant', 'digital'],
      default: 'retail',
    },

    // Phase 3 Step 5b — cancellation-rate hold
    // When the cancellation/refund rate monitor finds a high cancel rate, it sets
    // cancel_rate_hold = true. New food orders for this vendor then settle on delivery
    // (same as the new-restaurant hold) until admin clears the flag or the rate recovers.
    // cancel_rate_hold_override = true disables the monitor's auto-flip for this vendor.
    cancel_rate_hold: {
      type: Boolean,
      default: false,
    },
    cancel_rate_hold_since: {
      type: Date,
      default: null,
    },
    cancel_rate_hold_override: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual populate for the store
VendorSchema.virtual('store', {
  ref: 'Store',
  localField: '_id',
  foreignField: 'vendor_id',
  justOne: true,
});

// Ensure virtuals are included when converting to JSON/Object
VendorSchema.set('toObject', { virtuals: true });
VendorSchema.set('toJSON', { virtuals: true });
VendorSchema.index({ store_name: 'text', description: 'text' });
VendorSchema.index({ verified: 1, is_onboarded: 1, createdAt: -1 });
VendorSchema.index({ rating: -1, follower_count: -1 });

module.exports = mongoose.model('Vendor', VendorSchema);
