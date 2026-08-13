/**
 * migrations/09_vendor_type_backfill.js
 * Phase 3 Step 1 — Backfill vendor_type = 'retail' on all existing vendors.
 *
 * New vendors created after this migration get 'retail' from the schema default.
 * Restaurant vendors will be updated individually via the admin panel when
 * RestaurantProfile onboarding is available (Phase 3 Step 2).
 *
 * Usage:
 *   node backend/migrations/09_vendor_type_backfill.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

(async () => {
  await mongoose.connect(MONGO_URI);
  const col = mongoose.connection.collection('vendors');

  // Only set on docs that don't already have vendor_type (safe to re-run)
  const result = await col.updateMany(
    { vendor_type: { $exists: false } },
    { $set: { vendor_type: 'retail' } }
  );

  console.log(`vendor_type backfill: matched=${result.matchedCount} modified=${result.modifiedCount}`);

  // Verify — should be 0 docs without vendor_type after migration
  const missing = await col.countDocuments({ vendor_type: { $exists: false } });
  if (missing > 0) {
    console.error(`ERROR: ${missing} vendor(s) still missing vendor_type`);
    process.exit(1);
  }

  const counts = await col.aggregate([
    { $group: { _id: '$vendor_type', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  console.log('vendor_type distribution:', counts);

  await mongoose.disconnect();
  console.log('Done.');
  process.exit(0);
})().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
