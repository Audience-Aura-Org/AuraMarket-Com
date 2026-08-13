/**
 * models/LogisticsCompany.model.js
 * Auradime — Logistics Company Profile Schema
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
        // zone_id added in Phase 1 migration — backfilled by 05_zone_firm_pricing.js
        // After Phase 1 verification, zone_id becomes the primary key and 'quartier'
        // string field is kept only for human readability / admin display.
        zone_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'LogisticZone',
          default: null,
        },
      }
    ],
    supported_pickup_regions: [
      {
        type: String, // Legacy string field; keep during Phase 1 transition
      }
    ],
    // Phase 1: zone_id-based pickup coverage — replaces supported_pickup_regions
    // Empty array = pickup-agnostic (firm picks up from anywhere in its service area)
    supported_pickup_zone_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LogisticZone',
      }
    ],
    logo: {
      type: String,
      default: null,
    },
    banner: {
      type: String,
      default: null,
    },
    // Background job [B §2.8] — computed daily from delivered Shipment records.
    // null until at least one completed delivery exists for this firm.
    // Used to rank eligible firms on speed for food delivery (lower = faster).
    avg_delivery_minutes: {
      type: Number,
      default: null,
    },
    avg_delivery_minutes_updated_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('LogisticsCompany', LogisticsCompanySchema);
