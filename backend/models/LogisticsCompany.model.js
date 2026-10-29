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
    // What riders earn per completed delivery: a percentage of the delivery fee or a
    // fixed amount. Null until the agency sets it (earnings are then not shown).
    rider_pay: {
      mode: { type: String, enum: ['percent', 'fixed'] },
      value: { type: Number, min: 0 },
    },
    // How the agency prices deliveries. 'district' (default) uses quartier_prices;
    // 'distance' charges base + per_km on the road distance from pickup to drop-off,
    // within min/max and rounded up to round_to. Cross-city trips use a fixed price
    // for the city pair when one is set, else the cross_city per-km rate.
    pricing: {
      mode: { type: String, enum: ['district', 'distance'], default: 'district' },
      base_fee: { type: Number, min: 0, default: 500 },
      per_km: { type: Number, min: 0, default: 150 },
      min_fee: { type: Number, min: 0, default: 500 },
      max_fee: { type: Number, min: 0, default: 0 }, // 0 = no cap
      round_to: { type: Number, min: 1, default: 50 },
      cross_city: {
        enabled: { type: Boolean, default: false },
        base_fee: { type: Number, min: 0, default: 2000 },
        per_km: { type: Number, min: 0, default: 50 },
        min_fee: { type: Number, min: 0, default: 2000 },
        max_fee: { type: Number, min: 0, default: 0 },
        city_pairs: [{
          _id: false,
          from_city: { type: String, trim: true, required: true },
          to_city: { type: String, trim: true, required: true },
          price: { type: Number, min: 0, required: true },
        }],
      },
    },
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
