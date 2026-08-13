/**
 * migrations/12_intercity_rate_seed.js
 * Auradime — Phase 4: Seed 5 intercity shipping routes
 *
 * BEFORE RUNNING: Replace the placeholder prices below with real agency quotes.
 * Each price is the flat XAF rate for one small parcel (≤40×30×20 cm, one person can carry).
 *
 * Routes seeded:
 *   1. Yaoundé → Douala
 *   2. Douala  → Yaoundé
 *   3. Yaoundé → Bafoussam
 *   4. Douala  → Bafoussam
 *   5. Bafoussam → Yaoundé
 *
 * Usage:
 *   node backend/migrations/12_intercity_rate_seed.js
 *
 * Idempotent: guarded by (origin, destination) unique index — safe to re-run.
 * To update a price, change the value below and re-run — the script will log "skipped".
 * To change a price for an existing route use the admin panel or a manual findOneAndUpdate.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const LogisticZone  = require('../models/LogisticZone.model');
const IntercityRate = require('../models/IntercityRate.model');

// ── EDIT THESE BEFORE RUNNING ──────────────────────────────────────────────
// Replace XXXX with the real quote from your agency partner.
const ROUTES = [
  { origin: 'Yaoundé',    destination: 'Douala',      price: 3500, agency: 'Général Voyages', transit_hours_min: 10, transit_hours_max: 16 },
  { origin: 'Douala',     destination: 'Yaoundé',     price: 3500, agency: 'Général Voyages', transit_hours_min: 10, transit_hours_max: 16 },
  { origin: 'Yaoundé',    destination: 'Bafoussam',   price: 2500, agency: 'Buca Express',    transit_hours_min:  6, transit_hours_max: 10 },
  { origin: 'Douala',     destination: 'Bafoussam',   price: 2500, agency: 'Buca Express',    transit_hours_min:  5, transit_hours_max:  9 },
  { origin: 'Bafoussam',  destination: 'Yaoundé',     price: 2500, agency: 'Buca Express',    transit_hours_min:  6, transit_hours_max: 10 },
];
// ── END EDIT ───────────────────────────────────────────────────────────────

async function findCityZone(cityName) {
  const zone = await LogisticZone.findOne({
    name: new RegExp(`^${cityName.trim()}$`, 'i'),
    type: { $in: ['city', 'region'] },
  }).lean();
  if (!zone) throw new Error(`City zone not found: "${cityName}". Check LogisticZone collection.`);
  return zone;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  let inserted = 0;
  let skipped  = 0;

  for (const route of ROUTES) {
    const [originZone, destZone] = await Promise.all([
      findCityZone(route.origin),
      findCityZone(route.destination),
    ]);

    const existing = await IntercityRate.findOne({
      origin_city_zone_id:      originZone._id,
      destination_city_zone_id: destZone._id,
    }).lean();

    if (existing) {
      console.log(`  ⏩ Already exists: ${route.origin} → ${route.destination} (${existing.price} XAF)`);
      skipped++;
      continue;
    }

    await IntercityRate.create({
      origin_city_zone_id:      originZone._id,
      destination_city_zone_id: destZone._id,
      price:                    route.price,
      agency_name:              route.agency,
      transit_hours_min:        route.transit_hours_min,
      transit_hours_max:        route.transit_hours_max,
      is_active:                true,
    });
    console.log(`  ✅ Inserted: ${route.origin} → ${route.destination} — ${route.price} XAF (${route.agency})`);
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
