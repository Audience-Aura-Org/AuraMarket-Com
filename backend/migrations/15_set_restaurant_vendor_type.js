/**
 * migrations/15_set_restaurant_vendor_type.js
 * Two fixes in one:
 *
 * 1. Set is_meal: true on all products that have a meal subdoc (migration 14 omitted this flag)
 * 2. Set vendor_type: 'restaurant' on all vendors who have meal products
 *
 * Safe to re-run (idempotent).
 *
 * Usage:
 *   node backend/migrations/15_set_restaurant_vendor_type.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

(async () => {
  await mongoose.connect(MONGO_URI);
  const productCol = mongoose.connection.collection('products');
  const vendorCol  = mongoose.connection.collection('vendors');

  // ── Fix 1: set is_meal: true on products that have a meal subdoc ─────────
  const mealFix = await productCol.updateMany(
    { meal: { $exists: true, $ne: null }, is_meal: { $ne: true } },
    { $set: { is_meal: true } }
  );
  console.log(`Fix 1 — is_meal flag: ${mealFix.modifiedCount} products updated`);

  // ── Fix 2: set vendor_type: 'restaurant' on vendors with meal products ────
  const mealVendorIds = await productCol.distinct('vendor_id', { is_meal: true });
  console.log(`Found ${mealVendorIds.length} vendor(s) with meal products`);

  const vendorFix = await vendorCol.updateMany(
    { _id: { $in: mealVendorIds }, vendor_type: { $ne: 'restaurant' } },
    { $set: { vendor_type: 'restaurant' } }
  );
  console.log(`Fix 2 — vendor_type: ${vendorFix.modifiedCount} vendor(s) updated`);

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalMeals   = await productCol.countDocuments({ is_meal: true });
  const allVendors   = await vendorCol.find({}).project({ store_name: 1, vendor_type: 1 }).toArray();
  const restaurants  = allVendors.filter(v => v.vendor_type === 'restaurant');

  console.log(`\nTotal meal products in DB: ${totalMeals}`);
  console.log(`Restaurant vendors (${restaurants.length}):`);
  restaurants.forEach(v => console.log(`  ✅ ${v.store_name}`));

  await mongoose.disconnect();
  console.log('\nDone.');
  process.exit(0);
})().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
