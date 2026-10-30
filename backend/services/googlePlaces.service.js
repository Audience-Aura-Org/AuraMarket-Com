/**
 * services/googlePlaces.service.js
 * Google Places (New) for the place search: far more streets, shops, junctions and
 * landmarks in Cameroon than OpenStreetMap. Calls go through the server only.
 *
 *   GOOGLE_PLACES_API_KEY   server key with "Places API (New)" enabled
 *                           (falls back to GOOGLE_MAPS_SERVER_KEY)
 *
 * Cost control: suggestions are cached per query for a day; a place's position is
 * looked up only when someone picks it, cached for 30 days (the longest Google
 * allows), and suggestions + the pick share one session token, which Google bills
 * as a single session. Without a key, or if Google refuses it, it returns nothing
 * and the search carries on with our quartiers and OpenStreetMap.
 */
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places/';
const SUGGEST_TTL_MS = 24 * 60 * 60 * 1000;
const DETAILS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHE = 3000;
const PAUSE_AFTER_REFUSAL_MS = 10 * 60 * 1000;

const suggestCache = new Map(); // "q|lat,lng" -> { at, results }
const detailsCache = new Map(); // placeId -> { at, place }
let refusedUntil = 0; // key refused (API off, billing): stop calling for a while

const keyOf = () => process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_SERVER_KEY || '';
const enabled = () => Boolean(keyOf()) && Date.now() > refusedUntil;
const remember = (cache, k, v) => { if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value); cache.set(k, v); };
const token = (t) => (typeof t === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(t) ? t : undefined);

const refused = async (res) => {
  if (res.status === 403 || res.status === 401) {
    refusedUntil = Date.now() + PAUSE_AFTER_REFUSAL_MS;
    console.warn('[googlePlaces] key refused:', (await res.text().catch(() => '')).slice(0, 200));
  }
};

/**
 * Suggestions for a typed query, in the location search's result shape. Positions
 * come later from placeDetails (\`google_place_id\`), so \`point\` is null here.
 * bias: { lat, lng } to prefer places near the user.
 */
const suggest = async (q, { session, bias } = {}) => {
  if (!enabled() || q.length < 3) return [];
  const ck = `${q.toLowerCase()}|${bias ? `${bias.lat.toFixed(1)},${bias.lng.toFixed(1)}` : ''}`;
  const hit = suggestCache.get(ck);
  if (hit && Date.now() - hit.at < SUGGEST_TTL_MS) return hit.results;
  try {
    const res = await fetch(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': keyOf() },
      body: JSON.stringify({
        input: q, includedRegionCodes: ['cm'], languageCode: 'fr', sessionToken: token(session),
        ...(bias ? { locationBias: { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 30000 } } } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) { await refused(res); return hit?.results || []; }
    const json = await res.json();
    const results = (json.suggestions || []).map((s) => s.placePrediction).filter(Boolean).slice(0, 6).map((p) => ({
      kind: 'place', source: 'google', id: `g:${p.placeId}`, google_place_id: p.placeId, zone_id: null, point: null,
      name: p.structuredFormat?.mainText?.text || p.text?.text,
      address: p.structuredFormat?.secondaryText?.text || null,
      city: null, quartier: null, district: null,
    }));
    remember(suggestCache, ck, { at: Date.now(), results });
    return results;
  } catch (e) {
    console.warn('[googlePlaces] suggest:', e.message);
    return hit?.results || [];
  }
};

const component = (comps, ...types) => comps?.find((c) => types.some((t) => c.types?.includes(t)))?.longText || null;

/** Position and address of a picked place: { name, address, point, quartier, city } or null. */
const placeDetails = async (placeId, { session } = {}) => {
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(String(placeId || ''))) return null;
  const hit = detailsCache.get(placeId);
  if (hit && Date.now() - hit.at < DETAILS_TTL_MS) return hit.place;
  if (!enabled()) return null;
  try {
    const url = `${DETAILS_URL}${encodeURIComponent(placeId)}${token(session) ? `?sessionToken=${token(session)}` : ''}`;
    const res = await fetch(url, {
      headers: { 'X-Goog-Api-Key': keyOf(), 'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) { await refused(res); return null; }
    const p = await res.json();
    if (p.location?.latitude == null) return null;
    const place = {
      name: p.displayName?.text || null,
      address: p.formattedAddress || null,
      point: { lat: p.location.latitude, lng: p.location.longitude },
      quartier: component(p.addressComponents, 'sublocality_level_1', 'sublocality', 'neighborhood'),
      city: component(p.addressComponents, 'locality', 'administrative_area_level_2'),
    };
    remember(detailsCache, placeId, { at: Date.now(), place });
    return place;
  } catch (e) {
    console.warn('[googlePlaces] details:', e.message);
    return null;
  }
};

module.exports = { suggest, placeDetails, enabled };
