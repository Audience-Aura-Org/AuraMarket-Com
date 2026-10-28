/**
 * migrations/16_zone_centroid_geo_index.js
 * Prepares logistic zones for map pins (pin → nearest quartier):
 *
 * 1. Removes half-written centroids ({ type: 'Point' } with no coordinates), which
 *    make a 2dsphere index build fail.
 * 2. Creates the 2dsphere index on `centroid`.
 *
 * Coordinates themselves come from scripts/apply-zone-centroids.js after review.
 * Safe to re-run (idempotent).
 *
 * Usage:
 *   node backend/migrations/16_zone_centroid_geo_index.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

(async () => {
  await mongoose.connect(MONGO_URI);
  const zones = mongoose.connection.collection('logisticzones');

  const cleared = await zones.updateMany(
    { centroid: { $exists: true }, 'centroid.coordinates.1': { $exists: false } },
    { $unset: { centroid: '' } }
  );
  console.log(`Cleared ${cleared.modifiedCount} empty centroid(s).`);

  await zones.createIndex({ centroid: '2dsphere' }, { name: 'centroid_2dsphere' });
  console.log('2dsphere index on centroid is in place.');

  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
