/**
 * services/restaurantZoneSync.service.js
 * Auradime — Restaurant Service Zone Sync
 *
 * Phase 3 Step 10: Keeps Product.service_zone_ids[] in sync with
 * RestaurantProfile.service_zones[] for all meal products belonging to a restaurant.
 *
 * Call syncRestaurantServiceZones(vendorId) whenever:
 *   - A restaurant profile is created or updated (service_zones changed)
 *   - An admin manually triggers a resync
 *
 * The function is idempotent — safe to call multiple times.
 * Expected: up to 200 meal products per restaurant; bulk write handles it in one round-trip.
 */

const Product = require('../models/Product.model');
const RestaurantProfile = require('../models/RestaurantProfile.model');

/**
 * Syncs service_zone_ids on all meal products owned by the given vendor.
 *
 * @param {string|ObjectId} vendorId
 * @param {ClientSession}   [session]  — optional mongoose session for transactional callers
 * @returns {Promise<{ updated: number, zone_ids: ObjectId[] }>}
 */
const syncRestaurantServiceZones = async (vendorId, session = null) => {
  const rProfile = await RestaurantProfile.findOne({ vendor_id: vendorId })
    .select('service_zones')
    .session(session || null)
    .lean();

  // Use only active service zones; empty array means all meal products lose their zones
  // (restaurant suspended delivery — products should drop out of zone-scoped feeds).
  const zoneIds = (rProfile?.service_zones || [])
    .filter(z => z.is_active !== false)
    .map(z => z.zone_id)
    .filter(Boolean);

  const query = Product.updateMany(
    { vendor_id: vendorId, meal: { $ne: null, $exists: true } },
    { $set: { service_zone_ids: zoneIds } }
  );
  if (session) query.session(session);

  const result = await query;
  return { updated: result.modifiedCount, zone_ids: zoneIds };
};

/**
 * Bulk resync for all restaurants — run as a maintenance job or after a migration.
 * Safe to call from a script without a session.
 */
const syncAllRestaurantServiceZones = async () => {
  const profiles = await RestaurantProfile.find({}).select('vendor_id').lean();
  let totalUpdated = 0;

  for (const profile of profiles) {
    try {
      const { updated } = await syncRestaurantServiceZones(profile.vendor_id);
      totalUpdated += updated;
    } catch (err) {
      console.error(`[restaurantZoneSync] failed for vendor ${profile.vendor_id}:`, err.message);
    }
  }

  console.log(`[restaurantZoneSync] bulk sync complete — ${totalUpdated} meal products updated across ${profiles.length} restaurants.`);
  return { totalUpdated, restaurants: profiles.length };
};

module.exports = { syncRestaurantServiceZones, syncAllRestaurantServiceZones };
