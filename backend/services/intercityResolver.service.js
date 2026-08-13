/**
 * services/intercityResolver.service.js
 * Auradime — Phase 4 Step 4: Intercity Delivery Resolver
 *
 * Single server-side function that resolves whether an order requires intercity shipping,
 * computes the transit fee, and returns everything checkout needs.
 *
 * All three surfaces call this function — product page (display), cart (display), and
 * order placement (authoritative). Any drift between surfaces shows up as a price change
 * at checkout and is caught before money moves.
 *
 * Resolver logic (from Phase 4 plan §Step 4):
 *   1. Resolve origin_city  from Vendor.pickup_address.zone_id → ancestors → city node
 *   2. Resolve dest_city    from buyer's Address.zone_id → ancestors → city node
 *   3. If origin_city === dest_city → local route, transit_fee: 0, use existing last-mile
 *   4. If any item parcel_class === 'oversize' → blocked, surface reason
 *   5. Lookup IntercityRate(origin_city, dest_city, is_active: true) — no row → route not served
 *   6. Resolve pickup_point from rate.default_pickup_point_id
 *   7. Resolve last_mile_fee from existing zone pricing (pickup_point.district_zone_id → address zone)
 *   8. Return eligible last-mile firms for buyer selection at checkout
 *   9. If Store.free_shipping_threshold and subtotal ≥ threshold → transit_fee = 0, waived = true
 *
 * Returns:
 * {
 *   is_intercity:         boolean,
 *   transit_fee:          number,     // 0 for local routes
 *   transit_fee_waived:   boolean,
 *   transit_rate_id:      ObjectId|null,
 *   agency_name:          string|null,
 *   pickup_point:         PickupPoint|null,
 *   estimated_transit_hours: { min, max }|null,
 *   eligible_last_mile_firms: LogisticsCompany[],
 *   last_mile_fee_estimate:   number|null,
 *   blocked:              boolean,
 *   blocked_reason:       string|null,   // 'oversize' | 'route_not_served' | 'origin_unknown' | 'dest_unknown'
 * }
 *
 * Feature flag: INTERCITY_ENABLED env var must be 'true' or this returns local-only result.
 */

const mongoose = require('mongoose');
const LogisticZone  = require('../models/LogisticZone.model');
const IntercityRate = require('../models/IntercityRate.model');
const PickupPoint   = require('../models/PickupPoint.model');
const { getCompatibleFirms, calculateShipmentFees } = require('./logistics.service');
const cache = require('../utils/cache');

const INTERCITY_RATES_KEY = 'intercity:rates:v1';
const INTERCITY_CACHE_TTL = 60 * 60; // 1 hour

const isIntercityEnabled = () => String(process.env.INTERCITY_ENABLED || '').toLowerCase() === 'true';

/**
 * Cached lookup for a single IntercityRate by origin+dest city.
 * Cache bust is handled by the admin CRUD handlers in admin.controller.js.
 */
const getCachedRate = async (originCityId, destCityId) => {
  const key = `${INTERCITY_RATES_KEY}:${originCityId}:${destCityId}`;
  const cached = await cache.get(key);
  if (cached) return cached;

  const rate = await IntercityRate.findOne({
    origin_city_zone_id:      originCityId,
    destination_city_zone_id: destCityId,
    is_active:                true,
  }).populate('default_pickup_point_id').lean();

  if (rate) {
    await cache.set(key, rate, INTERCITY_CACHE_TTL);
  }
  return rate;
};

/**
 * Walk zone ancestors to find the city-level zone.
 * LogisticZone.type = 'city' is the level we want.
 * Ancestors array is stored outermost-first (city → district → quartier is the expected order).
 *
 * @param {ObjectId|string|null} zoneId
 * @returns {Promise<ObjectId|null>}
 */
const resolveCityZoneId = async (zoneId) => {
  if (!zoneId) return null;

  const zone = await LogisticZone.findById(zoneId).select('type ancestors').lean();
  if (!zone) return null;

  if (zone.type === 'city') return zone._id;

  // Walk ancestors to find the city node
  if (zone.ancestors?.length) {
    for (const ancestorId of zone.ancestors) {
      const ancestor = await LogisticZone.findById(ancestorId).select('type').lean();
      if (ancestor?.type === 'city') return ancestor._id;
    }
  }

  return null;
};

/**
 * Resolve intercity shipping for a single vendor → buyer zone combination.
 *
 * @param {Object} params
 * @param {ObjectId|string|null} params.vendorZoneId        — Vendor.pickup_address.zone_id (district or city)
 * @param {ObjectId|string|null} params.buyerZoneId         — buyer's delivery Address.zone_id (quartier or district)
 * @param {string}               params.buyerQuartier       — buyer's delivery quartier string (for last-mile firm lookup)
 * @param {ObjectId|string}      params.vendorId            — for firm eligibility check
 * @param {number}               [params.subtotal]          — for free-shipping threshold check
 * @param {ObjectId|string|null} [params.freeShippingThreshold] — Store.free_shipping_threshold
 * @param {{ parcel_class: string }[]} params.items         — order line items
 * @returns {Promise<Object>}  see JSDoc above
 */
const resolveDelivery = async ({
  vendorZoneId,
  buyerZoneId,
  buyerQuartier,
  vendorId,
  subtotal = 0,
  freeShippingThreshold = null,
  items = [],
}) => {
  const RESULT_LOCAL = {
    is_intercity:              false,
    transit_fee:               0,
    transit_fee_waived:        false,
    transit_rate_id:           null,
    agency_name:               null,
    pickup_point:              null,
    estimated_transit_hours:   null,
    eligible_last_mile_firms:  [],
    last_mile_fee_estimate:    null,
    blocked:                   false,
    blocked_reason:            null,
  };

  if (!isIntercityEnabled()) return RESULT_LOCAL;

  // ── Step 1 & 2: Resolve city nodes ──────────────────────────────────────
  const [originCityId, destCityId] = await Promise.all([
    resolveCityZoneId(vendorZoneId),
    resolveCityZoneId(buyerZoneId),
  ]);

  if (!originCityId) {
    return { ...RESULT_LOCAL, blocked: true, blocked_reason: 'origin_unknown' };
  }
  if (!destCityId) {
    return { ...RESULT_LOCAL, blocked: true, blocked_reason: 'dest_unknown' };
  }

  // ── Step 3: Same city → local route ─────────────────────────────────────
  if (originCityId.toString() === destCityId.toString()) {
    return RESULT_LOCAL;
  }

  // ── Step 4: Oversize check ───────────────────────────────────────────────
  const hasOversize = items.some(item => item.parcel_class === 'oversize');
  if (hasOversize) {
    return {
      ...RESULT_LOCAL,
      is_intercity:   true,
      blocked:        true,
      blocked_reason: 'oversize',
    };
  }

  // ── Step 5: Lookup IntercityRate (cached) ────────────────────────────────
  const rate = await getCachedRate(originCityId, destCityId);

  if (!rate) {
    return {
      ...RESULT_LOCAL,
      is_intercity:   true,
      blocked:        true,
      blocked_reason: 'route_not_served',
    };
  }

  // ── Step 6: Pickup point ─────────────────────────────────────────────────
  const pickupPoint = rate.default_pickup_point_id || null;

  // ── Step 7: Last-mile fee estimate ───────────────────────────────────────
  let lastMileFeeEstimate = null;
  let eligibleFirms = [];

  if (buyerQuartier) {
    try {
      eligibleFirms = await getCompatibleFirms(buyerQuartier, [vendorId]);
      if (eligibleFirms.length > 0) {
        const feesResult = await calculateShipmentFees(
          [{ _id: vendorId, pickup_address: {} }],
          buyerQuartier,
          eligibleFirms[0]._id
        );
        lastMileFeeEstimate = feesResult.perShipmentFee;
      }
    } catch (_) {
      // non-fatal — estimate shown as null
    }
  }

  // ── Step 9: Free-shipping threshold ─────────────────────────────────────
  const waived = freeShippingThreshold !== null && subtotal >= freeShippingThreshold;

  return {
    is_intercity:            true,
    transit_fee:             waived ? 0 : rate.price,
    transit_fee_waived:      waived,
    transit_rate_id:         rate._id,
    agency_name:             rate.agency_name || null,
    pickup_point:            pickupPoint,
    estimated_transit_hours: (rate.transit_hours_min != null && rate.transit_hours_max != null)
      ? { min: rate.transit_hours_min, max: rate.transit_hours_max }
      : null,
    eligible_last_mile_firms: eligibleFirms,
    last_mile_fee_estimate:   lastMileFeeEstimate,
    blocked:                 false,
    blocked_reason:          null,
  };
};

module.exports = { resolveDelivery, resolveCityZoneId, isIntercityEnabled };
