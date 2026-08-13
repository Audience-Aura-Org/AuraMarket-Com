/**
 * Migration 04 — Add zone_id to vendor pickup addresses
 *
 * For every vendor with a pickup_address.city value:
 *   - Looks up the matching LogisticZone (type='district' or 'region') by exact name
 *   - Sets pickup_address.zone_id
 *
 * All 22 vendor city values were confirmed as exact-match district zone names in the
 * Phase 0 audit — zero ambiguity. Any miss is logged for manual review.
 *
 * Idempotent: skips vendors already having pickup_address.zone_id set.
 * Prerequisite: run 02_zone_reparent_districts.js first.
 *
 * Run: node backend/migrations/04_zone_vendor_pickup.js
 */

(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const Vendor = require('../models/Vendor.model');
  const LogisticZone = require('../models/LogisticZone.model');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[04] Connected to MongoDB');

  const vendors = await Vendor.find({ 'pickup_address.city': { $exists: true, $ne: '' } });
  console.log(`[04] Found ${vendors.length} vendors with a pickup city`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const misses = [];

  for (const vendor of vendors) {
    if (vendor.pickup_address?.zone_id) {
      skipped++;
      continue;
    }

    const cityName = vendor.pickup_address?.city?.trim();
    if (!cityName) { failed++; continue; }

    // Match vendor city to a district zone (confirmed exact name match in audit)
    const zone = await LogisticZone.findOne({
      type: { $in: ['district', 'region'] },
      name: new RegExp(`^${cityName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i'),
    });

    if (!zone) {
      misses.push(`"${vendor.store_name || vendor._id}" city="${cityName}"`);
      failed++;
      continue;
    }

    await Vendor.updateOne(
      { _id: vendor._id },
      { $set: { 'pickup_address.zone_id': zone._id } }
    );
    console.log(`  ${vendor.store_name}: "${cityName}" → ${zone.name} (${zone._id})`);
    updated++;
  }

  if (misses.length > 0) {
    console.warn('\n[04] MISSES — no district zone found for these vendors (manual review needed):');
    misses.forEach(m => console.warn(' ', m));
  }

  console.log(`\n[04] Updated: ${updated}, Skipped (already done): ${skipped}, Failed: ${failed}`);
  await mongoose.disconnect();
  console.log('[04] Done\n');
})().catch(err => { console.error(err); process.exit(1); });
