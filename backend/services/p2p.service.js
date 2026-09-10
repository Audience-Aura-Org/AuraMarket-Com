/**
 * services/p2p.service.js
 * Auradime — P2P Pickup & Delivery Pricing Service
 *
 * Resolves quotes for P2P shipments using admin-enabled logistics providers'
 * rate cards + weight/category multipliers from PlatformSettings.
 */

const PlatformSettings = require('../models/PlatformSettings.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const LogisticZone = require('../models/LogisticZone.model');

/**
 * Load all designated P2P logistics providers.
 * @returns {Object[]} Array of LogisticsCompany docs (lean)
 */
const getP2PProviders = async () => {
  const settings = await PlatformSettings.getSettings();
  if (!settings.p2p_enabled || !settings.p2p_logistics_provider_ids?.length) return [];
  return LogisticsCompany.find({
    _id: { $in: settings.p2p_logistics_provider_ids },
    is_verified: true,
  }).lean();
};

/**
 * Build the zone hierarchy (quartier → district → city) for price lookup.
 * @param {ObjectId} zoneId - The leaf zone (quartier)
 * @returns {string[]} Array of zone ID strings from leaf to root
 */
const buildZoneHierarchy = async (zoneId) => {
  if (!zoneId) return [];
  const zone = await LogisticZone.findById(zoneId).select('ancestors').lean();
  if (!zone) return [zoneId.toString()];
  // ancestors is ordered root→leaf; we want leaf first for price lookup
  const hierarchy = [zoneId.toString()];
  if (zone.ancestors?.length) {
    hierarchy.push(...zone.ancestors.map(a => a.toString()).reverse());
  }
  return hierarchy;
};

/**
 * Resolve the delivery price from a provider's rate card for a given zone hierarchy.
 * Walks from most specific (quartier) to least specific (city).
 */
const resolveZonePrice = (provider, hierarchyIdStrings) => {
  for (const zoneIdStr of hierarchyIdStrings) {
    const entry = provider.quartier_prices.find(
      p => p.zone_id && p.zone_id.toString() === zoneIdStr
    );
    if (entry) return entry.price;
  }
  return null; // No coverage
};

/**
 * Get P2P delivery quotes from all enabled providers.
 * @param {Object} params
 * @param {ObjectId} params.pickup_zone_id
 * @param {ObjectId} params.dropoff_zone_id
 * @param {string}   params.weight_tier - light|medium|heavy|extra_heavy
 * @returns {{ coverage, reason, quotes: Array }}
 */
const getQuotes = async ({ pickup_zone_id, dropoff_zone_id, weight_tier }) => {
  const settings = await PlatformSettings.getSettings();
  if (!settings.p2p_enabled) {
    return { coverage: false, reason: 'P2P delivery is not currently available', quotes: [] };
  }

  const providers = await getP2PProviders();
  if (!providers.length) {
    return { coverage: false, reason: 'No delivery providers configured', quotes: [] };
  }

  const multipliers = settings.p2p_weight_multipliers || { light: 1, medium: 1.3, heavy: 1.8, extra_heavy: 2.5 };
  const weightMultiplier = multipliers[weight_tier] || 1;
  const commission = settings.p2p_commission_percent || 0;

  // Build hierarchies once, shared across all providers
  const dropoffHierarchy = await buildZoneHierarchy(dropoff_zone_id);
  const pickupHierarchy = pickup_zone_id ? await buildZoneHierarchy(pickup_zone_id) : [];

  const quotes = [];

  for (const provider of providers) {
    // Check pickup coverage (if provider restricts pickup zones)
    if (provider.supported_pickup_zone_ids?.length > 0 && pickup_zone_id) {
      const pickupCovered = provider.supported_pickup_zone_ids.some(
        z => pickupHierarchy.includes(z.toString())
      );
      if (!pickupCovered) continue;
    }

    // Resolve dropoff price from rate card
    const basePrice = resolveZonePrice(provider, dropoffHierarchy);
    if (basePrice === null) continue;

    const price = Math.round(basePrice * weightMultiplier);
    const platformFee = Math.round(price * commission / 100);
    const totalPrice = price + platformFee;

    quotes.push({
      provider_id: provider._id.toString(),
      provider_name: provider.company_name,
      provider_logo: provider.logo || null,
      provider_rating: provider.rating || 0,
      provider_vehicle_types: provider.vehicle_types || [],
      base_price: price,
      platform_fee: platformFee,
      price: totalPrice,
      estimated_delivery_minutes: provider.avg_delivery_minutes || null,
    });
  }

  // Sort by price ascending (cheapest first)
  quotes.sort((a, b) => a.price - b.price);

  return {
    coverage: quotes.length > 0,
    reason: quotes.length === 0 ? 'No delivery providers cover this route' : null,
    quotes,
  };
};

/**
 * Get a quote for a specific provider (used during booking validation).
 * @returns {{ coverage, price, base_price, platform_fee, provider_name, estimated_delivery_minutes }}
 */
const getQuoteForProvider = async ({ provider_id, pickup_zone_id, dropoff_zone_id, weight_tier }) => {
  const settings = await PlatformSettings.getSettings();
  if (!settings.p2p_enabled) {
    return { coverage: false, reason: 'P2P delivery is not currently available' };
  }

  const provider = await LogisticsCompany.findById(provider_id).lean();
  if (!provider || !provider.is_verified) {
    return { coverage: false, reason: 'Selected delivery provider not available' };
  }

  // Verify provider is in the enabled list
  if (!settings.p2p_logistics_provider_ids?.some(id => id.toString() === provider_id.toString())) {
    return { coverage: false, reason: 'Selected provider is not enabled for P2P' };
  }

  const multipliers = settings.p2p_weight_multipliers || { light: 1, medium: 1.3, heavy: 1.8, extra_heavy: 2.5 };
  const weightMultiplier = multipliers[weight_tier] || 1;
  const commission = settings.p2p_commission_percent || 0;

  // Check pickup coverage
  if (provider.supported_pickup_zone_ids?.length > 0 && pickup_zone_id) {
    const pickupHierarchy = await buildZoneHierarchy(pickup_zone_id);
    const pickupCovered = provider.supported_pickup_zone_ids.some(
      z => pickupHierarchy.includes(z.toString())
    );
    if (!pickupCovered) {
      return { coverage: false, reason: 'Pickup location not covered by this provider' };
    }
  }

  const dropoffHierarchy = await buildZoneHierarchy(dropoff_zone_id);
  const basePrice = resolveZonePrice(provider, dropoffHierarchy);
  if (basePrice === null) {
    return { coverage: false, reason: 'Delivery location not covered by this provider' };
  }

  const price = Math.round(basePrice * weightMultiplier);
  const platformFee = Math.round(price * commission / 100);
  const totalPrice = price + platformFee;

  return {
    coverage: true,
    price: totalPrice,
    base_price: price,
    platform_fee: platformFee,
    provider_name: provider.company_name,
    estimated_delivery_minutes: provider.avg_delivery_minutes || null,
  };
};

module.exports = { getP2PProviders, getQuotes, getQuoteForProvider, buildZoneHierarchy };
