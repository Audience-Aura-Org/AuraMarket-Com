/**
 * services/routing.service.js
 * Road routes and travel times for live tracking, from OpenRouteService
 * (ORS_API_KEY; free plan ≈ 2,000 routes a day, 40 a minute).
 *
 * Calls are kept low: a route is only recomputed for a delivery when the rider
 * has moved more than RECALC_METRES or the last one is older than RECALC_MS, and
 * only when someone is watching (the tracking page asks). Travel times come from
 * road types and speed limits, not live traffic.
 */
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
const RECALC_MS = 60 * 1000;
const RECALC_METRES = 150;
const MAX_CACHE = 500;

const cache = new Map(); // key -> { at, from, result }

const metres = (a, b) => Math.hypot((b.lat - a.lat) * 111320, (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180));

const fetchRoute = async (points) => {
  const key = process.env.ORS_API_KEY;
  if (!key) return null;
  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]), instructions: false }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`ORS ${res.status}`);
  const json = await res.json();
  const feature = json.features?.[0];
  if (!feature) return null;
  const segments = feature.properties?.segments || [];
  return {
    // [lng, lat] pairs, as both map libraries expect for a line.
    coordinates: feature.geometry.coordinates,
    distance_m: Math.round(feature.properties.summary.distance),
    duration_s: Math.round(feature.properties.summary.duration),
    legs: segments.map((s) => ({ distance_m: Math.round(s.distance), duration_s: Math.round(s.duration) })),
  };
};

/**
 * Route from the rider through the given stops. `key` identifies the delivery and
 * its phase (e.g. "<shipmentId>:pickup"), so each delivery reuses its last route.
 * Returns null when no key is set or the service fails (the map then shows no line).
 */
const routeFor = async (key, rider, stops) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < RECALC_MS && metres(hit.from, rider) < RECALC_METRES) return hit.result;
  try {
    const result = await fetchRoute([rider, ...stops]);
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(key, { at: Date.now(), from: { lat: rider.lat, lng: rider.lng }, result });
    return result;
  } catch (e) {
    console.warn('[routing]', e.message);
    return hit?.result || null; // keep showing the last good route
  }
};

module.exports = { routeFor, metres };
