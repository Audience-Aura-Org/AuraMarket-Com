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
 * @returns {{ ids: string[], names: string[] }} Zone IDs and names from leaf to root
 */
const buildZoneHierarchy = async (zoneId) => {
  if (!zoneId) return { ids: [], names: [] };
  const zone = await LogisticZone.findById(zoneId).select('name ancestors').lean();
  if (!zone) {
    console.log(`[buildZoneHierarchy] Zone not found: ${zoneId}`);
    return { ids: [zoneId.toString()], names: [] };
  }

  // Build hierarchy with IDs
  const ids = [zoneId.toString()];
  const names = [zone.name];

  if (zone.ancestors?.length) {
    // ancestors is ordered root→leaf; reverse to get leaf→root
    const ancestorIds = zone.ancestors.map(a => a.toString()).reverse();
    ids.push(...ancestorIds);

    // Also fetch ancestor names for matching
    const ancestorZones = await LogisticZone.find({ _id: { $in: ancestorIds } }).select('name').lean();
    const ancestorMap = {};
    ancestorZones.forEach(z => ancestorMap[z._id.toString()] = z.name);
    ancestorIds.forEach(id => {
      if (ancestorMap[id]) names.push(ancestorMap[id]);
    });
  }

  console.log(`[buildZoneHierarchy] Zone "${zone.name}": ${ids.length} level(s)`);
  return { ids, names };
};

/**
 * Resolve the delivery price from a provider's rate card for a given zone hierarchy.
 * Walks from most specific (quartier) to least specific (city).
 * First tries zone_id matching, then falls back to quartier string name matching.
 */
const resolveZonePrice = (provider, hierarchyIdStrings, hierarchyNames) => {
  // First try: match by zone_id
  for (const zoneIdStr of hierarchyIdStrings) {
    const entry = provider.quartier_prices.find(
      p => p.zone_id && p.zone_id.toString() === zoneIdStr
    );
    if (entry) {
      console.log(`  [resolveZonePrice] Found match by zone_id: ${entry.price} XAF`);
      return entry.price;
    }
  }

  // Fallback: match by quartier string name (for legacy pricing without zone_id)
  if (hierarchyNames?.length) {
    for (const zoneName of hierarchyNames) {
      const entry = provider.quartier_prices.find(
        p => p.quartier && p.quartier.toLowerCase() === zoneName.toLowerCase()
      );
      if (entry) {
        console.log(`  [resolveZonePrice] Found match by quartier name "${zoneName}": ${entry.price} XAF`);
        return entry.price;
      }
    }
  }

  console.log(`  [resolveZonePrice] No match found for ${provider.company_name}`);
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
    console.log('[p2p.getQuotes] P2P disabled');
    return { coverage: false, reason: 'P2P delivery is not currently available', quotes: [] };
  }

  const providers = await getP2PProviders();
  if (!providers.length) {
    console.log('[p2p.getQuotes] No P2P providers configured');
    return { coverage: false, reason: 'No delivery providers configured', quotes: [] };
  }

  console.log(`[p2p.getQuotes] Found ${providers.length} provider(s):`, providers.map(p => p.company_name));

  const multipliers = settings.p2p_weight_multipliers || { light: 1, medium: 1.3, heavy: 1.8, extra_heavy: 2.5 };
  const weightMultiplier = multipliers[weight_tier] || 1;
  const commission = settings.p2p_commission_percent || 0;

  // Build hierarchies once, shared across all providers
  const dropoffHierarchy = await buildZoneHierarchy(dropoff_zone_id);
  const pickupHierarchy = pickup_zone_id ? await buildZoneHierarchy(pickup_zone_id) : { ids: [], names: [] };

  console.log(`[p2p.getQuotes] Dropoff hierarchy: ${dropoffHierarchy.names.join(' <- ')}`);
  console.log(`[p2p.getQuotes] Pickup hierarchy: ${pickupHierarchy.names.join(' <- ')}`);

  const quotes = [];

  for (const provider of providers) {
    // Check pickup coverage (if provider restricts pickup zones)
    if (provider.supported_pickup_zone_ids?.length > 0 && pickup_zone_id) {
      const pickupCovered = provider.supported_pickup_zone_ids.some(
        z => pickupHierarchy.ids.includes(z.toString())
      );
      if (!pickupCovered) {
        console.log(`[p2p.getQuotes] ${provider.company_name}: pickup zone not covered`);
        continue;
      }
    }

    // Resolve dropoff price from rate card
    const basePrice = resolveZonePrice(provider, dropoffHierarchy.ids, dropoffHierarchy.names);
    if (basePrice === null) {
      console.log(`[p2p.getQuotes] ${provider.company_name}: no price for dropoff zone`);
      continue;
    }

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
      z => pickupHierarchy.ids.includes(z.toString())
    );
    if (!pickupCovered) {
      return { coverage: false, reason: 'Pickup location not covered by this provider' };
    }
  }

  const dropoffHierarchy = await buildZoneHierarchy(dropoff_zone_id);
  const basePrice = resolveZonePrice(provider, dropoffHierarchy.ids, dropoffHierarchy.names);
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
