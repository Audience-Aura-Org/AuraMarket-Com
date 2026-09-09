/**
 * services/p2p.service.js
 * Auradime — P2P Pickup & Delivery Pricing Service
 *
 * Resolves quotes for P2P shipments using the admin-assigned logistics provider's
 * rate card + weight/category multipliers from PlatformSettings.
 */

const PlatformSettings = require('../models/PlatformSettings.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const LogisticZone = require('../models/LogisticZone.model');

/**
 * Load the designated P2P logistics provider.
 * @returns {Object|null} LogisticsCompany doc or null if not configured
 */
const getP2PProvider = async () => {
  const settings = await PlatformSettings.getSettings();
  if (!settings.p2p_enabled || !settings.p2p_logistics_provider_id) return null;
  return LogisticsCompany.findById(settings.p2p_logistics_provider_id).lean();
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
 * Get a P2P delivery quote.
 * @param {Object} params
 * @param {ObjectId} params.pickup_zone_id
 * @param {ObjectId} params.dropoff_zone_id
 * @param {string}   params.weight_tier - light|medium|heavy|extra_heavy
 * @returns {{ price, provider_name, estimated_delivery_minutes, coverage }}
 */
const getQuote = async ({ pickup_zone_id, dropoff_zone_id, weight_tier }) => {
  const settings = await PlatformSettings.getSettings();
  if (!settings.p2p_enabled) {
    return { coverage: false, reason: 'P2P delivery is not currently available' };
  }

  const provider = await getP2PProvider();
  if (!provider) {
    return { coverage: false, reason: 'No delivery provider configured' };
  }

  // Check pickup coverage (if provider restricts pickup zones)
  if (provider.supported_pickup_zone_ids?.length > 0 && pickup_zone_id) {
    const pickupHierarchy = await buildZoneHierarchy(pickup_zone_id);
    const pickupCovered = provider.supported_pickup_zone_ids.some(
      z => pickupHierarchy.includes(z.toString())
    );
    if (!pickupCovered) {
      return { coverage: false, reason: 'Pickup location not covered by delivery provider' };
    }
  }

  // Resolve dropoff price
  const dropoffHierarchy = await buildZoneHierarchy(dropoff_zone_id);
  const basePrice = resolveZonePrice(provider, dropoffHierarchy);
  if (basePrice === null) {
    return { coverage: false, reason: 'Delivery location not covered by delivery provider' };
  }

  // Apply weight multiplier
  const multipliers = settings.p2p_weight_multipliers || { light: 1, medium: 1.3, heavy: 1.8, extra_heavy: 2.5 };
  const weightMultiplier = multipliers[weight_tier] || 1;
  const price = Math.round(basePrice * weightMultiplier);

  // Apply platform commission
  const commission = settings.p2p_commission_percent || 0;
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

module.exports = { getP2PProvider, getQuote, buildZoneHierarchy };
