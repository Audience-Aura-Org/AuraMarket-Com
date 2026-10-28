/**
 * Save reviewed zone coordinates.
 *
 *   node scripts/apply-zone-centroids.js [file]            # dry run: shows what would change
 *   node scripts/apply-zone-centroids.js [file] --apply    # writes approved entries
 *
 * Only entries with "approved": true and valid lat/lng inside Cameroon are written.
 * Default file: data/zone-centroids.proposed.json (from propose-zone-centroids.js).
 * Run migrations/16_zone_centroid_geo_index.js first.
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const LogisticZone = require('../models/LogisticZone.model');

const apply = process.argv.includes('--apply');
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const file = path.resolve(__dirname, '..', fileArg || 'data/zone-centroids.proposed.json');
const inCameroon = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && lat >= 1.6 && lat <= 13.1 && lng >= 8.4 && lng <= 16.2;

(async () => {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  const approved = entries.filter((e) => e.approved === true);
  const invalid = approved.filter((e) => !inCameroon(Number(e.lat), Number(e.lng)));
  if (invalid.length) {
    console.error(`Refusing: ${invalid.length} approved entr${invalid.length === 1 ? 'y has' : 'ies have'} coordinates outside Cameroon:`);
    invalid.forEach((e) => console.error(`  ${e.name} (${e.lat}, ${e.lng})`));
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  let changed = 0;
  for (const e of approved) {
    const coordinates = [Number(e.lng), Number(e.lat)];
    const zone = await LogisticZone.findById(e.zone_id).select('name centroid').lean();
    if (!zone) { console.warn(`  ! zone ${e.zone_id} (${e.name}) no longer exists — skipped`); continue; }
    const same = zone.centroid?.coordinates?.[0] === coordinates[0] && zone.centroid?.coordinates?.[1] === coordinates[1];
    if (same) continue;
    changed++;
    console.log(`${apply ? 'SET ' : 'WOULD SET'} ${zone.name.padEnd(28)} → ${e.lat}, ${e.lng}`);
    if (apply) await LogisticZone.updateOne({ _id: zone._id }, { $set: { centroid: { type: 'Point', coordinates } } });
  }
  console.log(`\n${approved.length}/${entries.length} entries approved; ${changed} ${apply ? 'updated' : 'would change (re-run with --apply)'}.`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
