/**
 * models/PickupPoint.model.js
 * Auradime — Phase 4 Step 2: Intercity Agency Pickup Points
 *
 * Each row is one physical agency counter where vendors drop parcels.
 * Multiple rows per city are expected — "Général Voyages Douala" may be
 * four different counters (Deido, Bonanjo, Bonabéri, Bepanda).
 *
 * Expect 50–150 rows once the top-5 routes are seeded.
 *
 * `district_zone_id` enables last-mile fee lookup:
 *   When a parcel arrives at this counter, the last-mile fee is priced
 *   from this counter's district to the buyer's delivery address.
 */

const mongoose = require('mongoose');

const PickupPointSchema = new mongoose.Schema(
  {
    // Agency brand (e.g. "Général Voyages", "Buca Express")
    agency_name: {
      type: String,
      required: [true, 'agency_name is required'],
      trim: true,
    },

    // Specific branch identifier (e.g. "Douala Deido", "Yaoundé Nlongkak")
    branch_name: {
      type: String,
      required: [true, 'branch_name is required'],
      trim: true,
    },

    // City-level zone — used to filter pickup points by city on checkout
    city_zone_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LogisticZone',
      required: [true, 'city_zone_id is required'],
      index: true,
    },

    // District-level zone — used for last-mile fee lookup after arrival
    district_zone_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LogisticZone',
      default: null,
    },

    // Human-readable address (shown to vendor during dispatch)
    street_address: {
      type: String,
      trim: true,
      default: null,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
    },

    // Optional GPS coordinates — future pin-drop feature
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
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

PickupPointSchema.index({ city_zone_id: 1, is_active: 1 });
PickupPointSchema.index({ agency_name: 1, branch_name: 1 }, { unique: true });

module.exports = mongoose.model('PickupPoint', PickupPointSchema);
