/**
 * models/Vendor.model.js
 * Aura Market — Vendor Profile
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
      enum: ['free', 'premium', 'elite'],
      default: 'free',
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
      city: String,
      region: String,
      quartier: String, // Neighborhood for routing
    },
    phone: {
      type: String,
      required: [true, 'Vendor phone number is required for logistics'],
    },
    average_response_time: {
      type: String,
      default: '⚡ < 5m', // e.g., "15m", "1h", "⚡ < 5m"
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

module.exports = mongoose.model('Vendor', VendorSchema);
