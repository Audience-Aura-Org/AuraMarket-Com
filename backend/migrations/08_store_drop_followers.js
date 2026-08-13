/**
 * Migration 08 — Drop orphaned Store.followers[] field
 *
 * Store.followers was never written or read by any controller.
 * Follower state lives in the Follow collection; the counter is
 * denormalised onto Vendor.follower_count.
 *
 * Idempotent: $unset no-ops if the field is already absent.
 *
 * Run: node backend/migrations/08_store_drop_followers.js
 */

(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[08] Connected to MongoDB');

  const col = mongoose.connection.collection('stores');
  const before = await col.countDocuments();
  console.log(`[08] Documents in collection: ${before}`);

  const result = await col.updateMany({}, { $unset: { followers: 1 } });
  console.log(`[08] Unset followers[]: matched=${result.matchedCount} modified=${result.modifiedCount}`);

  await mongoose.disconnect();
  console.log('[08] Done\n');
})().catch(err => { console.error(err); process.exit(1); });
