/**
 * Migration 03 — Backfill level and ancestors on all quartier zones
 *
 * For every zone with type='quartier':
 *   - parent_id already points to the district (unchanged)
 *   - Sets: level=3, ancestors=[city._id, district._id]
 *   - Assigns code: district.code + '-' + sequential 3-digit suffix
 *
 * Idempotent: skips any quartier already at level=3 with ancestors populated.
 * Prerequisite: run 02_zone_reparent_districts.js first.
 *
 * Run: node backend/migrations/03_zone_backfill_quartiers.js
 */

(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const LogisticZone = require('../models/LogisticZone.model');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[03] Connected to MongoDB');

  // Load all districts to build lookup map
  const districts = await LogisticZone.find({ type: 'district' });
  if (districts.length === 0) {
    console.error('No districts found. Run 02_zone_reparent_districts.js first.');
    process.exit(1);
  }
  const districtMap = {};
  for (const d of districts) districtMap[d._id.toString()] = d;

  const quartiers = await LogisticZone.find({ type: 'quartier' }).sort({ parent_id: 1, name: 1 });
  console.log(`[03] Found ${quartiers.length} quartiers to backfill`);

  // Group quartiers by district for sequential code assignment
  const byDistrict = {};
  for (const q of quartiers) {
    const key = q.parent_id?.toString();
    if (!key) continue;
    if (!byDistrict[key]) byDistrict[key] = [];
    byDistrict[key].push(q);
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [districtId, group] of Object.entries(byDistrict)) {
    const district = districtMap[districtId];
    if (!district) {
      console.warn(`[03] No district document for parent_id=${districtId} — ${group.length} quartier(s) skipped`);
      failed += group.length;
      continue;
    }
    const cityId = district.parent_id;
    if (!cityId) {
      console.warn(`[03] District "${district.name}" has no parent city — run 02 first`);
      failed += group.length;
      continue;
    }

    // Sort alphabetically within the district for deterministic code ordering
    group.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    for (let i = 0; i < group.length; i++) {
      const q = group[i];
      if (q.level === 3 && q.ancestors && q.ancestors.length >= 2) {
        skipped++;
        continue;
      }
      const code = `${district.code}-${String(i + 1).padStart(3, '0')}`;
      await LogisticZone.updateOne(
        { _id: q._id },
        {
          $set: {
            level: 3,
            ancestors: [cityId, district._id],
            code,
          },
        }
      );
      updated++;
    }
    console.log(`  District "${district.name}" (${district.code}): ${group.length - skipped} updated`);
  }

  const withoutParent = quartiers.filter(q => !q.parent_id);
  if (withoutParent.length > 0) {
    console.warn(`[03] ${withoutParent.length} quartier(s) have no parent_id — review manually:`,
      withoutParent.map(q => q.name).join(', '));
  }

  console.log(`[03] Updated: ${updated}, Skipped (already done): ${skipped}, Failed: ${failed}`);
  await mongoose.disconnect();
  console.log('[03] Done\n');
})().catch(err => { console.error(err); process.exit(1); });
