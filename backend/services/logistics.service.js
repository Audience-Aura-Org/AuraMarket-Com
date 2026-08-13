/**
 * services/logistics.service.js
 * Auradime — Logistics Module Service
 *
 * Handles tracking generation, firm filtering, and automated shipment splitting.
 *
 * Phase 1 changes:
 *   - getCompatibleFirms: primary matching on zone_id (quartier_prices[].zone_id and
 *     supported_pickup_zone_ids). String-based fallback retained for any price entries
 *     not yet backfilled. Delete string fallback after one full week of zero hits.
 *   - calculateShipmentFees: zone_id-based lookup with ancestor traversal (quartier →
 *     district → city). String fallback retained for same reason.
 *   - HOTFIX-BUG01 (region || city) removed — vendor pickup now reads zone_id directly.
 *     If a vendor has no zone_id yet, falls back to pickup_address.city string.
 */

const Shipment = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const Vendor = require('../models/Vendor.model');
const Order = require('../models/Order.model');
const mongoose = require('mongoose');
const { escapeRegExp } = require('../middleware/security.middleware');

/**
 * Generates a unique tracking code in the format AURA-XXXXXX
 */
const generateTrackingCode = async () => {
  const prefix = 'AURA-';
  let isUnique = false;
  let code;

  while (!isUnique) {
    const random = Math.floor(100000 + Math.random() * 900000); // 6 digits
    code = `${prefix}${random}`;
    const existing = await Shipment.findOne({ tracking_code: code });
    if (!existing) isUnique = true;
  }
  return code;
};

/**
 * Filters logistics companies based on zone_id coverage and vendor pickup zones.
 *
 * Primary matching: zone_id on quartier_prices entries and supported_pickup_zone_ids.
 * String fallback: retained for any entries not yet backfilled by migration 05.
 *
 * @param {string}    quartier     — delivery neighbourhood name (from order shipping_address)
 * @param {ObjectId[]} vendorIds   — vendor documents to check pickup coverage for
 * @param {Object}    [options]
 * @param {ObjectId}  [options.city_zone_id] — when set (food orders), restrict firms to those
 *                    that have at least one quartier_prices entry inside this city. Ensures
 *                    only local-city couriers are offered for food delivery (Phase 3 Step 9).
 */
const getCompatibleFirms = async (quartier, vendorIds, options = {}) => {
  const UserSubscription = require('../models/UserSubscription.model');
  const LogisticZone = require('../models/LogisticZone.model');

  // 1. Load vendors; extract district zone_ids for pickup matching
  const vendors = await Vendor.find({ _id: { $in: vendorIds } });

  const pickupZoneIds = [
    ...new Set(
      vendors
        .map(v => v.pickup_address?.zone_id)
        .filter(Boolean)
        .map(id => id.toString())
    ),
  ].map(id => new mongoose.Types.ObjectId(id));

  // String fallback for vendors not yet backfilled with zone_id
  const pickupCities = [
    ...new Set(vendors.map(v => v.pickup_address?.city).filter(Boolean)),
  ];

  // 2. Resolve target zone and its ancestor chain
  const [targetZone, activeSubUserIds] = await Promise.all([
    LogisticZone.findOne({
      name: new RegExp(`^${escapeRegExp(quartier)}$`, 'i'),
    }).populate('parent_id'),
    UserSubscription.distinct('user_id', {
      role: 'logistics',
      status: 'active',
    }),
  ]);

  // 3. Eligibility: admin-verified OR active logistics subscription
  const eligibilityClause = {
    $or: [
      { is_verified: true },
      { user_id: { $in: activeSubUserIds } },
    ],
  };

  // 4. Delivery zone conditions
  //    Primary: zone_id match on the quartier or any ancestor (district, city)
  //    Fallback: string name match for price entries without zone_id yet
  const deliveryConditions = [];

  if (targetZone) {
    const hierarchyIds = [targetZone._id, ...(targetZone.ancestors || [])];
    deliveryConditions.push({ 'quartier_prices.zone_id': { $in: hierarchyIds } });
  }

  // String fallback (remove after Phase 1 verification week confirms zero hits)
  deliveryConditions.push({
    'quartier_prices.quartier': new RegExp(`^${escapeRegExp(quartier)}$`, 'i'),
  });
  const districtName = targetZone?.parent_id?.name;
  if (districtName) {
    deliveryConditions.push({
      'quartier_prices.quartier': new RegExp(`^${escapeRegExp(districtName)}$`, 'i'),
    });
  }

  // 5. Pickup zone conditions (separate $and — a firm must BOTH deliver AND pick up)
  const andConditions = [eligibilityClause, { $or: deliveryConditions }];

  if (pickupZoneIds.length > 0) {
    // Primary: zone_id-based. Empty supported_pickup_zone_ids = pickup-agnostic.
    andConditions.push({
      $or: [
        { supported_pickup_zone_ids: { $in: pickupZoneIds } },
        { supported_pickup_zone_ids: { $exists: false } },
        { supported_pickup_zone_ids: { $size: 0 } },
      ],
    });
  } else if (pickupCities.length > 0) {
    // String fallback for vendors not yet backfilled (remove after Phase 1 verification)
    andConditions.push({
      $or: [
        { supported_pickup_regions: { $in: pickupCities } },
        { supported_pickup_regions: { $exists: false } },
        { supported_pickup_regions: { $size: 0 } },
      ],
    });
  }
  // If neither zone_ids nor city strings are present, no pickup restriction applied
  // (pickup-agnostic fallback — both current firms have empty pickup restrictions)

  // 6. Food-order city gate (Phase 3 Step 9)
  //    When city_zone_id is provided, only include firms that have at least one
  //    quartier_prices entry in a zone that belongs to that city (ancestors contains city_zone_id).
  //    This ensures a Douala courier is never offered for a Yaoundé food order.
  if (options.city_zone_id) {
    const LogisticZone = require('../models/LogisticZone.model');
    const cityId = new mongoose.Types.ObjectId(options.city_zone_id.toString());
    const cityZoneIds = await LogisticZone.distinct('_id', {
      $or: [
        { _id: cityId },
        { ancestors: cityId },
      ],
    });
    if (cityZoneIds.length > 0) {
      andConditions.push({
        'quartier_prices.zone_id': { $in: cityZoneIds },
      });
    }
  }

  const firms = await LogisticsCompany.find({ $and: andConditions }).populate(
    'user_id',
    'name email avatar branding'
  );

  // Rank: cheapest price first, then fastest (avg_delivery_minutes), then highest rating
  if (firms.length > 1 && targetZone) {
    const hierarchyIds = [targetZone._id.toString(), ...(targetZone.ancestors || []).map(id => id.toString())];
    firms.sort((a, b) => {
      const priceA = resolveZonePrice(a, hierarchyIds, quartier);
      const priceB = resolveZonePrice(b, hierarchyIds, quartier);
      if (priceA !== priceB) return priceA - priceB;
      const speedA = a.avg_delivery_minutes ?? Infinity;
      const speedB = b.avg_delivery_minutes ?? Infinity;
      if (speedA !== speedB) return speedA - speedB;
      return (b.rating || 0) - (a.rating || 0);
    });
  }

  return firms;
};

/**
 * Resolve the effective delivery price for a firm given the target zone hierarchy.
 * Used internally for ranking. Returns Infinity when no price is found.
 */
const resolveZonePrice = (firm, hierarchyIdStrings, quartierfallback) => {
  for (const zoneIdStr of hierarchyIdStrings) {
    const entry = firm.quartier_prices.find(p => p.zone_id && p.zone_id.toString() === zoneIdStr);
    if (entry) return entry.price;
  }
  // String fallback for un-backfilled entries
  const strEntry = firm.quartier_prices.find(p => p.quartier?.toLowerCase() === quartierfallback?.toLowerCase());
  return strEntry ? strEntry.price : Infinity;
};

/**
 * Check whether any eligible logistics firm has delivery coverage in a given city zone.
 * Used in the dine feed to add delivery_available flag per restaurant.
 *
 * @param {ObjectId|string} cityZoneId   — LogisticZone with type 'city'
 * @param {ObjectId[]}      activeSubUserIds — pre-fetched active logistics user ids
 * @returns {Promise<boolean>}
 */
const hasCoverageInCity = async (cityZoneId, activeSubUserIds = null) => {
  const LogisticZone = require('../models/LogisticZone.model');

  if (activeSubUserIds === null) {
    const UserSubscription = require('../models/UserSubscription.model');
    activeSubUserIds = await UserSubscription.distinct('user_id', { role: 'logistics', status: 'active' });
  }

  const cityObjId = new mongoose.Types.ObjectId(cityZoneId.toString());

  // Find all zones in this city (city itself + all descendants) — collect _id and name
  const cityZoneDocs = await LogisticZone.find({
    $or: [{ _id: cityObjId }, { ancestors: cityObjId }],
  }).select('_id name').lean();

  if (cityZoneDocs.length === 0) return false;

  const cityZoneIds = cityZoneDocs.map(z => z._id);
  const cityZoneNames = [...new Set(cityZoneDocs.map(z => z.name).filter(Boolean))];
  const cityName = cityZoneDocs.find(z => z._id.toString() === cityObjId.toString())?.name;

  const eligibilityClause = {
    $or: [
      { is_verified: true },
      { user_id: { $in: activeSubUserIds } },
    ],
  };

  // Coverage: zone_id primary + string quartier name fallback + legacy service_regions
  const coverageOr = [
    { 'quartier_prices.zone_id': { $in: cityZoneIds } },
  ];
  // String fallback for un-backfilled quartier_prices entries (Phase 1 transition)
  if (cityZoneNames.length > 0) {
    coverageOr.push({ 'quartier_prices.quartier': { $in: cityZoneNames } });
  }
  // Legacy fallback: service_regions string array contains the city name
  if (cityName) {
    coverageOr.push({ service_regions: cityName });
  }

  const firm = await LogisticsCompany.findOne({
    $and: [
      eligibilityClause,
      { $or: coverageOr },
    ],
  }).select('_id').lean();

  return firm !== null;
};

/**
 * Calculates shipping fees per vendor and total.
 *
 * Looks up the firm's price entry by zone_id hierarchy (quartier → district → city).
 * String fallback retained for entries not yet backfilled by migration 05.
 *
 * @param {Vendor[]} vendors    — vendor documents in this order
 * @param {string}   quartier   — delivery neighbourhood name
 * @param {ObjectId} logisticsId — LogisticsCompany _id
 */
const calculateShipmentFees = async (vendors, quartier, logisticsId) => {
  const LogisticZone = require('../models/LogisticZone.model');

  const firm = await LogisticsCompany.findById(logisticsId);
  if (!firm) throw new Error('Logistics firm not found');

  // Resolve the target zone and its ancestry for hierarchical price lookup
  const targetZone = await LogisticZone.findOne({
    name: new RegExp(`^${escapeRegExp(quartier)}$`, 'i'),
  }).populate('parent_id');

  let quartierPrice = null;

  // Primary: zone_id match — prefer exact quartier, then any ancestor (district, city)
  if (targetZone) {
    const hierarchyIds = [targetZone._id, ...(targetZone.ancestors || [])];
    // Sort so the most specific (deepest level) match wins first
    for (const zoneId of hierarchyIds) {
      quartierPrice = firm.quartier_prices.find(
        p => p.zone_id && p.zone_id.equals(zoneId)
      ) || null;
      if (quartierPrice) break;
    }
  }

  // String fallback: exact quartier name, then district name
  // (remove after Phase 1 verification confirms zero string-fallback hits in logs)
  if (!quartierPrice) {
    quartierPrice = firm.quartier_prices.find(
      p => p.quartier.toLowerCase() === quartier.toLowerCase()
    ) || null;
  }
  if (!quartierPrice && targetZone?.parent_id?.name) {
    const districtName = targetZone.parent_id.name;
    quartierPrice = firm.quartier_prices.find(
      p => p.quartier.toLowerCase() === districtName.toLowerCase()
    ) || null;
  }

  if (!quartierPrice) {
    throw new Error(`Zone "${quartier}" is not mapped in this firm's pricing matrix.`);
  }

  const perShipmentFee = quartierPrice.price;
  const totalFee = perShipmentFee * vendors.length;

  return { perShipmentFee, totalFee };
};

/**
 * Splits an order into shipments per vendor
 */
const createShipmentsForOrder = async (order, quartier, logisticsId, session = null) => {
  const { _id: orderId, customer_id, products, shipping_address } = order;

  // 1. Group products by vendor
  const productsByVendor = {};
  products.forEach(p => {
    const vId = p.vendor_id || order.vendor_id;
    if (!productsByVendor[vId]) productsByVendor[vId] = [];
    productsByVendor[vId].push(p);
  });

  const vendorIds = Object.keys(productsByVendor);
  const vendors = await Vendor.find({ _id: { $in: vendorIds } }).session(session);

  const { perShipmentFee } = await calculateShipmentFees(vendors, quartier, logisticsId);

  const shipments = [];
  for (const vendor of vendors) {
    const trackingCode = await generateTrackingCode();

    const shipmentData = {
      order_id: orderId,
      vendor_id: vendor._id,
      logistics_id: logisticsId,
      tracking_code: trackingCode,
      status: 'pending',
      price: perShipmentFee,
      pickup_address: {
        ...vendor.pickup_address,
        phone: vendor.phone,
      },
      delivery_address: {
        ...shipping_address,
        quartier: quartier,
      },
      delivery_description: order.delivery_description || '',
      shipment_logs: [{
        status: 'pending',
        timestamp: new Date(),
        note: 'Shipment initialized automatically after order payment.',
      }],
    };

    const [shipment] = await Shipment.create([shipmentData], { session, ordered: true });
    shipments.push(shipment);
  }

  return shipments;
};

module.exports = {
  generateTrackingCode,
  getCompatibleFirms,
  calculateShipmentFees,
  createShipmentsForOrder,
  hasCoverageInCity,
};
