/**
 * Propose map coordinates for delivery zones from OpenStreetMap (Nominatim).
 *
 *   node scripts/propose-zone-centroids.js [--out data/zone-centroids.proposed.json]
 *
 * Writes PROPOSALS only — nothing is saved to the database. A person reviews the
 * file, sets "approved": true on correct entries (fixing lat/lng where needed),
 * then runs scripts/apply-zone-centroids.js. Respects Nominatim's usage policy:
 * one request per second and an identifying User-Agent.
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const LogisticZone = require('../models/LogisticZone.model');

const OUT = path.resolve(__dirname, '..', process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'data/zone-centroids.proposed.json');
const UA = 'Auradime/1.0 (support@auradime.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const geocode = async (query) => {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: query, countrycodes: 'cm', format: 'jsonv2', limit: '3', addressdetails: '1' })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'fr,en' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const zones = await LogisticZone.find({ is_active: { $ne: false } }).select('name type parent_id ancestors centroid').lean();
  const byId = new Map(zones.map((z) => [z._id.toString(), z]));
  const cityOf = (z) => (z.type === 'city' ? z : [...(z.ancestors || [])].map((a) => byId.get(a.toString())).find((a) => a?.type === 'city'));
  const order = { city: 0, region: 1, district: 2, quartier: 3 };
  const proposals = [];

  for (const zone of zones.sort((a, b) => order[a.type] - order[b.type])) {
    const city = cityOf(zone);
    const query = zone.type === 'city' ? `${zone.name}, Cameroon` : `${zone.name}, ${city?.name || ''}, Cameroon`;
    let hits = [];
    try { hits = await geocode(query); } catch (err) { console.warn(`  ! ${query}: ${err.message}`); }
    const best = hits[0];
    // Sanity check: a quartier should land within ~25 km of its city.
    const cityProposal = city && proposals.find((p) => p.zone_id === city._id.toString());
    const km = best && cityProposal?.lat ? Math.hypot((best.lat - cityProposal.lat) * 111, (best.lon - cityProposal.lng) * 111 * Math.cos(cityProposal.lat * Math.PI / 180)) : null;
    proposals.push({
      zone_id: zone._id.toString(), name: zone.name, type: zone.type, city: city?.name || null, query,
      lat: best ? Number(best.lat) : null, lng: best ? Number(best.lon) : null,
      osm_match: best ? best.display_name : null, osm_type: best ? `${best.category}/${best.type}` : null,
      km_from_city: km == null ? null : Math.round(km * 10) / 10,
      flag: !best ? 'NOT_FOUND' : km != null && km > 25 ? 'FAR_FROM_CITY' : null,
      existing: zone.centroid?.coordinates?.length ? zone.centroid.coordinates : null,
      approved: false,
    });
    console.log(`${zone.type.padEnd(8)} ${zone.name.padEnd(28)} ${best ? `${Number(best.lat).toFixed(4)}, ${Number(best.lon).toFixed(4)}` : 'not found'}${km > 25 ? `  (${km.toFixed(0)} km from city!)` : ''}`);
    await sleep(1100);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proposals, null, 2));
  const found = proposals.filter((p) => p.lat != null).length;
  console.log(`\n${found}/${proposals.length} zones geocoded; ${proposals.filter((p) => p.flag).length} flagged for review → ${OUT}`);
  await mongoose.disconnect();
})().catch((err) => { console.error(err); process.exit(1); });
