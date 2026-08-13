/**
 * migrations/10_service_zone_ids_backfill.js
 * Auradime — Backfill Product.service_zone_ids from RestaurantProfile.service_zones
 *
 * Phase 3 Step 10: First-time population of service_zone_ids on all existing meal products.
 * Safe to re-run — idempotent (overwrites with the same data).
 *
 * Run: node backend/migrations/10_service_zone_ids_backfill.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Migration 10] Connected to MongoDB.');

  const { syncAllRestaurantServiceZones } = require('../services/restaurantZoneSync.service');
  const { totalUpdated, restaurants } = await syncAllRestaurantServiceZones();

  console.log(`[Migration 10] Done. Updated ${totalUpdated} meal products across ${restaurants} restaurants.`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('[Migration 10] Failed:', err.message);
  process.exit(1);
});
