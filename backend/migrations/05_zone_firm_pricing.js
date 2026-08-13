/**
 * Migration 05 — Add zone_id to logistics firm quartier_prices entries
 *
 * For each entry in LogisticsCompany.quartier_prices[]:
 *   - Looks up the matching LogisticZone by name (any type: quartier, district, city)
 *   - Sets quartier_prices[i].zone_id
 *
 * All 10 price entries were confirmed zero-orphan in the Phase 0 audit.
 * Any miss is logged for manual review.
 *
 * Idempotent: skips entries already having zone_id set.
 *
 * Note: supported_pickup_zone_ids is intentionally left empty for both current firms
 * (empty = pickup-agnostic, matches all vendor districts). Do not add entries unless
 * a firm explicitly restricts its pickup coverage.
 *
 * Run: node backend/migrations/05_zone_firm_pricing.js
 */

(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const LogisticsCompany = require('../models/LogisticsCompany.model');
  const LogisticZone = require('../models/LogisticZone.model');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[05] Connected to MongoDB');

  const firms = await LogisticsCompany.find({});
  console.log(`[05] Found ${firms.length} logistics firm(s)`);

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const misses = [];

  for (const firm of firms) {
    if (!firm.quartier_prices || firm.quartier_prices.length === 0) continue;
    console.log(`\n  Firm: "${firm.company_name}" — ${firm.quartier_prices.length} price entries`);

    let modified = false;

    for (const entry of firm.quartier_prices) {
      if (entry.zone_id) {
        totalSkipped++;
        continue;
      }

      const name = entry.quartier?.trim();
      if (!name) { totalFailed++; continue; }

      const zone = await LogisticZone.findOne({
        name: new RegExp(`^${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i'),
        type: { $in: ['quartier', 'district', 'region', 'city'] },
      });

      if (!zone) {
        misses.push(`Firm "${firm.company_name}" entry="${name}"`);
        totalFailed++;
        continue;
      }

      entry.zone_id = zone._id;
      modified = true;
      console.log(`    "${name}" → ${zone.type} "${zone.name}" (${zone._id})`);
      totalUpdated++;
    }

    if (modified) {
      firm.markModified('quartier_prices');
      await firm.save();
    }
  }

  if (misses.length > 0) {
    console.warn('\n[05] MISSES — no zone found for these entries (manual review needed):');
    misses.forEach(m => console.warn(' ', m));
  }

  console.log(`\n[05] Updated: ${totalUpdated}, Skipped (already done): ${totalSkipped}, Failed: ${totalFailed}`);
  await mongoose.disconnect();
  console.log('[05] Done\n');
})().catch(err => { console.error(err); process.exit(1); });
