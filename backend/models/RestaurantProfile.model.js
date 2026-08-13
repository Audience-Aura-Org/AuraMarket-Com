/**
 * models/RestaurantProfile.model.js
 * Auradime — Restaurant Profile (Phase 3 Step 2)
 *
 * 1:1 with Vendor (linked via vendor_id). Created when a vendor upgrades to
 * vendor_type = 'restaurant'. No restaurant fields live on Vendor itself.
 *
 * Key design decisions (from the plan):
 * - service_zones[] is embedded (bounded 5-15 districts, always read with the profile)
 * - service_zones can only contain districts whose ancestor city = city_zone_id (pre-save hook)
 * - opening_hours is 7 rows (one per weekday), not a sparse list, so gaps are explicit
 * - timezone defaults to Africa/Douala (UTC+1, no DST — platform default)
 * - cuisine_types[] references Category by ObjectId — not strings (avoids the Product.category mistake)
 */

const mongoose = require('mongoose');

// ── Opening hours sub-document ────────────────────────────────────────────────
// One row per day (0 = Sunday … 6 = Saturday, matching JS Date.getDay()).
const openingHoursSchema = new mongoose.Schema(
  {
    day:      { type: Number, required: true, min: 0, max: 6 }, // 0=Sun, 1=Mon … 6=Sat
    opens:    { type: String, default: '08:00' }, // HH:MM local time (Africa/Douala)
    closes:   { type: String, default: '22:00' },
    is_closed: { type: Boolean, default: false },
  },
  { _id: false }
);

// ── Service zone sub-document ─────────────────────────────────────────────────
// Each entry scopes the restaurant to one district-level LogisticZone.
// min_order_amount overrides Store.minimum_order_amount for that district.
const serviceZoneSchema = new mongoose.Schema(
  {
    zone_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LogisticZone',
      required: true,
    },
    min_order_amount: {
      type: Number,
      default: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const RestaurantProfileSchema = new mongoose.Schema(
  {
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      unique: true,
    },

    // City-level zone this restaurant operates from.
    // service_zones[] must only reference districts that descend from this city.
    city_zone_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LogisticZone',
      required: true,
    },

    // Cuisine types — ObjectId refs to Category (never plain strings)
    cuisine_types: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],

    // 7-row schedule. Front-end should seed all 7 on profile creation.
    opening_hours: {
      type: [openingHoursSchema],
      default: () =>
        [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, opens: '08:00', closes: '22:00', is_closed: false })),
    },

    timezone: {
      type: String,
      default: 'Africa/Douala', // UTC+1, no DST
    },

    // Average kitchen-to-ready time. Distinct from booking_option.lead_time_minutes
    // (which is the customer-facing pre-order lead time).
    prep_time_minutes: {
      type: Number,
      default: 20,
      min: 1,
    },

    // Whether the restaurant accepts scheduled/pre-orders
    accepts_scheduled: {
      type: Boolean,
      default: false,
    },

    // Toggled by the restaurant owner to pause incoming orders
    is_accepting_orders: {
      type: Boolean,
      default: true,
    },

    // Districts this restaurant delivers to. Embedded — bounded size (5–15).
    service_zones: {
      type: [serviceZoneSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// ── Pre-save: validate that every service_zone district belongs to city_zone_id ──
RestaurantProfileSchema.pre('save', async function () {
  if (!this.isModified('service_zones') && !this.isModified('city_zone_id')) return;
  if (!this.service_zones.length) return;

  const LogisticZone = mongoose.model('LogisticZone');
  const zoneIds = this.service_zones.map(sz => sz.zone_id);

  const zones = await LogisticZone.find({ _id: { $in: zoneIds } })
    .select('ancestors parent_id type')
    .lean();

  const cityId = this.city_zone_id.toString();
  for (const zone of zones) {
    const ancestorStrings = (zone.ancestors || []).map(a => a.toString());
    const parentId = zone.parent_id?.toString();
    // Accepts district zones (parent_id = city) and quartier zones (city in ancestors)
    const belongsToCity = ancestorStrings.includes(cityId) || parentId === cityId;
    if (!belongsToCity) {
      throw new Error(
        `service_zone ${zone._id} does not belong to city ${cityId}. ` +
        `Only districts within the restaurant's city are allowed.`
      );
    }
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────
RestaurantProfileSchema.index({ 'service_zones.zone_id': 1, is_accepting_orders: 1 });
RestaurantProfileSchema.index({ city_zone_id: 1, is_accepting_orders: 1 });

module.exports = mongoose.model('RestaurantProfile', RestaurantProfileSchema);
