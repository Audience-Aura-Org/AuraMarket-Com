/**
 * Migration 01 — Insert city-level zone documents
 *
 * Creates one LogisticZone per platform city (level=1, type='city').
 * Idempotent: uses upsert on (name, type) — safe to re-run.
 *
 * Run: node backend/migrations/01_zone_insert_cities.js
 */

(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const LogisticZone = require('../models/LogisticZone.model');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[01] Connected to MongoDB');

  const cities = [
    { name: 'Yaoundé',  code: 'YDE' },
    { name: 'Douala',   code: 'DLA' },
    { name: 'Bamenda',  code: 'BDA' },
    { name: 'Kumba',    code: 'KMB' },
  ];

  for (const city of cities) {
    const result = await LogisticZone.updateOne(
      { name: city.name, type: 'city' },
      {
        $setOnInsert: {
          name: city.name,
          code: city.code,
          type: 'city',
          level: 1,
          parent_id: null,
          ancestors: [],
          is_active: true,
        },
      },
      { upsert: true }
    );
    const status = result.upsertedId ? `INSERTED  _id=${result.upsertedId}` : 'already exists';
    console.log(`  ${city.name} (${city.code}): ${status}`);
  }

  await mongoose.disconnect();
  console.log('[01] Done\n');
})().catch(err => { console.error(err); process.exit(1); });
