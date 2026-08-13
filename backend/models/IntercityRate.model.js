/**
 * models/IntercityRate.model.js
 * Auradime — Phase 4 Step 1: Cross-City (Intercity) Shipping Rate Card
 *
 * Admin-managed flat rates for city-to-city shipments of small parcels.
 * Rates are looked up at order placement and locked in as `transit_fee` on the Order.
 *
 * Design decisions (from Phase 4 plan):
 *   - Flat rate, small parcels only. Oversize parcels are blocked platform-wide.
 *   - No matching row = route not served. Surface this as an explicit "unavailable" to the buyer.
 *   - Seed 5 routes, not 50 — validate against real orders before expanding.
 *   - `default_pickup_point_id` is the agency counter used unless the buyer/vendor chooses another.
 *   - `transit_hours_min/max` is informational only — not used for auto-release timing.
 *   - Cache under Redis key `intercity:rates:v1` and invalidate on write.
 *   - Open decisions (locked before build, see plan):
 *       Transit-loss liability, advance timing, arrival confirmation owner.
 */

const mongoose = require('mongoose');

const IntercityRateSchema = new mongoose.Schema(
  {
    // City-level LogisticZone refs (type: 'city')
    origin_city_zone_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LogisticZone',
      required: [true, 'origin_city_zone_id is required'],
      index: true,
    },
    destination_city_zone_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LogisticZone',
      required: [true, 'destination_city_zone_id is required'],
      index: true,
    },

    // Flat rate in XAF — small parcels only. Oversize: blocked.
    price: {
      type: Number,
      required: [true, 'price is required'],
      min: [0, 'price cannot be negative'],
    },

    // Default pickup counter for this route (may be overridden at checkout)
    default_pickup_point_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PickupPoint',
      default: null,
    },

    // Estimated transit time range in hours (informational, not contractual)
    transit_hours_min: {
      type: Number,
      min: 0,
      default: null,
    },
    transit_hours_max: {
      type: Number,
      min: 0,
      default: null,
    },

    // Carrying agency name (e.g. "Général Voyages", "Buca Express") — free text,
    // because Cameroon doesn't have a single dominant last-mile network yet.
    // Phase 5 may normalise this into a carrier enum or separate collection.
    agency_name: {
      type: String,
      trim: true,
      default: null,
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

// Ensure each city pair only has one active rate at a time
IntercityRateSchema.index(
  { origin_city_zone_id: 1, destination_city_zone_id: 1 },
  { unique: true }
);
IntercityRateSchema.index({ is_active: 1 });

module.exports = mongoose.model('IntercityRate', IntercityRateSchema);
