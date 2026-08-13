/**
 * Migration 02 — Reparent district zones to their city nodes
 *
 * For every zone with type='region' (the 18 arrondissements):
 *   - Determines the parent city by name prefix
 *   - Sets: type='district', level=2, parent_id=city._id, code='YDE-01' etc.
 *
 * Idempotent: skips any zone already at level=2.
 * Prerequisite: run 01_zone_insert_cities.js first.
 *
 * Run: node backend/migrations/02_zone_reparent_districts.js
 */

(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const LogisticZone = require('../models/LogisticZone.model');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[02] Connected to MongoDB');

  // Load city nodes inserted by migration 01
  const cityDocs = await LogisticZone.find({ type: 'city' });
  if (cityDocs.length === 0) {
    console.error('No city documents found. Run 01_zone_insert_cities.js first.');
    process.exit(1);
  }

  const cityPrefixes = [
    { prefix: 'Yaoundé', code: 'YDE' },
    { prefix: 'Douala',  code: 'DLA' },
    { prefix: 'Bamenda', code: 'BDA' },
    { prefix: 'Kumba',   code: 'KMB' },
  ];

  // Build name→city map
  const cityByPrefix = {};
  for (const cp of cityPrefixes) {
    const doc = cityDocs.find(c => c.name === cp.prefix);
    if (!doc) { console.error(`City document missing: ${cp.prefix}`); process.exit(1); }
    cityByPrefix[cp.prefix] = { doc, code: cp.code };
  }

  const districts = await LogisticZone.find({ type: 'region' }).sort({ name: 1 });
  console.log(`[02] Found ${districts.length} zones with type='region' to migrate`);

  // Group by city prefix
  const grouped = {};
  for (const key of Object.keys(cityByPrefix)) grouped[key] = [];
  const unmatched = [];

  for (const d of districts) {
    if (d.level === 2) { continue; } // already migrated
    let matched = false;
    for (const cp of cityPrefixes) {
      if (d.name.startsWith(cp.prefix)) {
        grouped[cp.prefix].push(d);
        matched = true;
        break;
      }
    }
    if (!matched) unmatched.push(d.name);
  }

  if (unmatched.length > 0) {
    console.warn('[02] Could not match to a city (will NOT be updated):', unmatched);
  }

  let updated = 0;
  let skipped = 0;

  for (const cp of cityPrefixes) {
    const { doc: cityDoc, code: cityCode } = cityByPrefix[cp.prefix];
    const group = grouped[cp.prefix];
    // Sort alphabetically for deterministic code assignment
    group.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    for (let i = 0; i < group.length; i++) {
      const district = group[i];
      if (district.level === 2 && district.type === 'district') {
        skipped++;
        continue;
      }
      const code = `${cityCode}-${String(i + 1).padStart(2, '0')}`;
      await LogisticZone.updateOne(
        { _id: district._id },
        {
          $set: {
            type: 'district',
            level: 2,
            parent_id: cityDoc._id,
            ancestors: [],  // districts have no ancestors above city (city is parent_id)
            code,
          },
        }
      );
      console.log(`  ${district.name} → ${code}  (parent: ${cp.prefix})`);
      updated++;
    }
  }

  console.log(`[02] Updated: ${updated}, Skipped: ${skipped}, Unmatched: ${unmatched.length}`);
  await mongoose.disconnect();
  console.log('[02] Done\n');
})().catch(err => { console.error(err); process.exit(1); });
