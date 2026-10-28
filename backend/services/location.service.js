/**
 * services/location.service.js
 * Location search and pin → delivery-zone resolution.
 *
 * District (quartier) pricing stays authoritative: a map pin only *suggests* the
 * quartier it falls in, by nearest zone centre. When the pin is far from every
 * centre, or two quartiers are about equally close, the result is marked
 * `needs_confirmation` and the customer picks the quartier themselves.
 */
const LogisticZone = require('../models/LogisticZone.model');
const Place = require('../models/Place.model');

// Pins further than this from the nearest quartier centre are not trusted.
const MAX_CONFIDENT_METERS = Number(process.env.LOCATION_MAX_CONFIDENT_M || 2500);
// The nearest quartier must beat the runner-up by this margin to be trusted.
const MIN_MARGIN_METERS = Number(process.env.LOCATION_MIN_MARGIN_M || 400);

const ACCENTS = { a: '[aàâä]', e: '[eéèêë]', i: '[iîï]', o: '[oôö]', u: '[uùûü]', c: '[cç]' };
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// "yaounde" matches "Yaoundé", "bonamousadi" still needs the right letters.
const accentInsensitive = (q) => escapeRegExp(q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase())
  .replace(/[aeiouc]/g, (ch) => ACCENTS[ch]);

const zoneLabel = (zone, byId) => {
  const parents = (zone.ancestors || []).map((id) => byId.get(id.toString())).filter(Boolean);
  const city = parents.find((p) => p.type === 'city');
  const district = parents.find((p) => p.type === 'district');
  return { city: city?.name || (zone.type === 'city' ? zone.name : null), district: district?.name || null };
};

const toPoint = (doc) => (doc?.coordinates?.length === 2 ? { lng: doc.coordinates[0], lat: doc.coordinates[1] } : null);

const search = async (rawQuery, { limit = 10 } = {}) => {
  const q = String(rawQuery || '').trim().slice(0, 60);
  if (q.length < 2) return [];
  const pattern = new RegExp(accentInsensitive(q), 'i');
  const startsWith = new RegExp(`^${accentInsensitive(q)}`, 'i');

  const [zones, places] = await Promise.all([
    LogisticZone.find({ is_active: { $ne: false }, name: pattern }).select('name type ancestors centroid').limit(40).lean(),
    Place.find({ approved: true, $or: [{ name: pattern }, { aliases: pattern }] }).select('name kind zone_id location').limit(20).lean(),
  ]);

  const ancestorIds = [...new Set([...zones.flatMap((z) => z.ancestors || []), ...places.map((p) => p.zone_id)].map(String))];
  const related = await LogisticZone.find({ _id: { $in: ancestorIds } }).select('name type ancestors parent_id').lean();
  const byId = new Map(related.map((z) => [z._id.toString(), z]));
  const typeRank = { quartier: 0, district: 1, city: 2, region: 3 };

  const zoneResults = zones.map((z) => ({
    kind: z.type, id: z._id, zone_id: z.type === 'quartier' ? z._id : null, name: z.name,
    ...zoneLabel(z, byId), point: toPoint(z.centroid), rank: (startsWith.test(z.name) ? 0 : 10) + typeRank[z.type],
  }));
  const placeResults = places.map((p) => {
    const zone = byId.get(p.zone_id.toString());
    return { kind: 'place', place_kind: p.kind, id: p._id, zone_id: p.zone_id, name: p.name, quartier: zone?.name || null,
      ...(zone ? zoneLabel(zone, byId) : {}), point: toPoint(p.location), rank: (startsWith.test(p.name) ? 0 : 10) + 0.5 };
  });

  return [...zoneResults, ...placeResults]
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ rank, ...r }) => r);
};

const resolvePoint = async ({ lat, lng }) => {
  const nearest = await LogisticZone.aggregate([
    { $geoNear: { near: { type: 'Point', coordinates: [lng, lat] }, key: 'centroid', distanceField: 'distance_m', spherical: true,
      query: { type: 'quartier', is_active: { $ne: false }, 'centroid.coordinates.0': { $exists: true } } } },
    { $limit: 4 },
    { $project: { name: 1, ancestors: 1, distance_m: 1 } },
  ]);
  if (!nearest.length) return { zone: null, needs_confirmation: true, reason: 'no_coverage', alternatives: [] };

  const related = await LogisticZone.find({ _id: { $in: nearest.flatMap((z) => z.ancestors || []) } }).select('name type').lean();
  const byId = new Map(related.map((z) => [z._id.toString(), z]));
  const shape = (z) => ({ zone_id: z._id, name: z.name, ...zoneLabel(z, byId), distance_m: Math.round(z.distance_m) });
  const [best, second] = nearest;
  const tooFar = best.distance_m > MAX_CONFIDENT_METERS;
  const tooClose = second && second.distance_m - best.distance_m < MIN_MARGIN_METERS;
  return {
    zone: shape(best),
    needs_confirmation: Boolean(tooFar || tooClose),
    reason: tooFar ? 'far_from_known_quartiers' : tooClose ? 'between_quartiers' : null,
    alternatives: nearest.slice(1).map(shape),
  };
};

module.exports = { search, resolvePoint, accentInsensitive };
