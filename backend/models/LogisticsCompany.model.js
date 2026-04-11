/**
 * models/LogisticsCompany.model.js
 * Aura Market — Logistics Company Profile Schema
 *
 * Linked directly to a User schema with the role 'logistics'. 
 * Defines the corporate profile, service regions, and general capacities.
 */

const mongoose = require('mongoose');

const LogisticsCompanySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    company_name: {
      type: String,
      required: [true, 'Logistics company name is required'],
      trim: true,
    },
    contact_email: {
      type: String,
      required: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    contact_phone: {
      type: String,
      required: true,
    },
    service_regions: [
      {
        type: String,
        trim: true, // e.g., ['Douala', 'Yaounde', 'Bamenda']
      },
    ],
    vehicle_types: [
      {
        type: String,
        enum: ['motorcycle', 'car', 'van', 'truck'],
      },
    ],
    is_verified: {
      type: Boolean,
      default: false, // Must be approved by an Admin
    },
    rating: {
      type: Number,
      default: 0,
    },
    total_deliveries: {
      type: Number,
      default: 0,
    },
    // New fields for the updated logistics system
    quartier_prices: [
      {
        quartier: { type: String, required: true },
        price: { type: Number, required: true },
      }
    ],
    supported_pickup_regions: [
      {
        type: String, // Regions/Cities where the company can pick up from vendors
      }
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('LogisticsCompany', LogisticsCompanySchema);
