/**
 * services/pricing.service.js
 * Distance-based delivery prices for agencies whose `pricing.mode` is 'distance'.
 *
 *   within one city:  base_fee + per_km × road km, kept between min_fee and max_fee
 *   between cities:   the agency's fixed price for that city pair (either direction),
 *                     else the cross_city base + per_km rate; refused when the agency
 *                     has cross-city delivery switched off
 *
 * Every fee is rounded up to `round_to` XAF. Points are the exact spots customers and
 * vendors pinned, else the quartier centre (the quote is then marked approx).
 * District-priced agencies never come through here.
 */
const LogisticZone = require('../models/LogisticZone.model');
const { roadDistanceKm } = require('./routing.service');

const isDistance = (firm) => firm?.pricing?.mode === 'distance';

// "Yaoundé" and "yaounde " are the same city.
const cityKey = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const CITY_TTL_MS = 10 * 60 * 1000;
const cityCache = new Map(); // zone id or quartier name -> { at, city }

/** City name of an address: from its zone (or quartier) ancestors, else its city text. */
const cityOf = async (address) => {
  if (!address) return null;
  const key = address.zone_id ? `z:${address.zone_id}` : address.quartier ? `q:${cityKey(address.quartier)}` : null;
  if (key) {
    const hit = cityCache.get(key);
    if (hit && Date.now() - hit.at < CITY_TTL_MS) return hit.city || address.city || null;
    let zone = null;
    if (address.zone_id) zone = await LogisticZone.findById(address.zone_id).select('name type ancestors').lean().catch(() => null);
    if (!zone && address.quartier) {
      const escaped = address.quartier.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      zone = await LogisticZone.findOne({ name: new RegExp(`^${escaped}$`, 'i') }).select('name type ancestors').lean();
    }
    let city = null;
    if (zone?.type === 'city') city = zone.name;
    else if (zone?.ancestors?.length) city = (await LogisticZone.findOne({ _id: { $in: zone.ancestors }, type: 'city' }).select('name').lean())?.name || null;
    if (cityCache.size > 2000) cityCache.clear();
    cityCache.set(key, { at: Date.now(), city });
    if (city) return city;
  }
  return address.city || null;
};

/** Cities the agency delivers inside: its service regions (empty = anywhere). */
const servedCities = (firm) => (firm.service_regions || []).map(cityKey).filter(Boolean);

const roundUp = (fee, step) => Math.ceil(fee / (step || 1)) * (step || 1);
const rate = (r, km) => {
  let fee = (Number(r.base_fee) || 0) + (Number(r.per_km) || 0) * km;
  fee = Math.max(fee, Number(r.min_fee) || 0);
  if (Number(r.max_fee) > 0) fee = Math.min(fee, Number(r.max_fee));
  return fee;
};

const pairPrice = (cross, from, to) => {
  const a = cityKey(from); const b = cityKey(to);
  const hit = (cross?.city_pairs || []).find((p) => {
    const x = cityKey(p.from_city); const y = cityKey(p.to_city);
    return (x === a && y === b) || (x === b && y === a);
  });
  return hit ? Number(hit.price) : null;
};

/**
 * Whether a distance-priced agency takes a trip between these cities, without
 * computing a price (no routing call). Unknown cities are given the benefit of the doubt.
 */
const covers = (firm, fromCity, toCity) => {
  const served = servedCities(firm);
  const inServed = (c) => !served.length || !c || served.includes(cityKey(c));
  const cross = fromCity && toCity && cityKey(fromCity) !== cityKey(toCity);
  if (!cross) return inServed(toCity || fromCity);
  if (!firm.pricing?.cross_city?.enabled) return false;
  return inServed(fromCity) || inServed(toCity);
};

/**
 * Price of one trip for a distance-priced agency.
 * pickup / dropoff: addresses ({ location, zone_id, quartier, city }) or bare points.
 * Returns { fee, distance_km, approx, cross_city, from_city, to_city, rule }
 * or { error } when the agency does not take this trip.
 */
const priceDelivery = async (firm, { pickup, dropoff }) => {
  const { pickupPoint } = require('./riderDispatch.service');
  const p = firm.pricing || {};
  const [from, to, fromCity, toCity] = await Promise.all([pickupPoint(pickup), pickupPoint(dropoff), cityOf(pickup), cityOf(dropoff)]);
  if (!covers(firm, fromCity, toCity)) {
    const cross = fromCity && toCity && cityKey(fromCity) !== cityKey(toCity);
    return { error: cross ? `This agency does not deliver from ${fromCity} to ${toCity}.` : `This agency does not deliver in ${toCity || fromCity}.` };
  }
  const crossCity = Boolean(fromCity && toCity && cityKey(fromCity) !== cityKey(toCity));
  const base = { cross_city: crossCity, from_city: fromCity || null, to_city: toCity || null };

  const pair = crossCity ? pairPrice(p.cross_city, fromCity, toCity) : null;
  if (pair != null) return { ...base, fee: roundUp(pair, p.round_to), distance_km: null, approx: false, rule: 'city_pair' };

  if (!from || !to) return { error: 'We could not place the pickup or drop-off on the map. Choose the quartier or pin the spot.' };
  const { km, approx } = await roadDistanceKm(from, to);
  const fee = roundUp(rate(crossCity ? p.cross_city || {} : p, km), p.round_to);
  return { ...base, fee, distance_km: km, approx: approx || Boolean(from.approx || to.approx), rule: crossCity ? 'cross_city_km' : 'within_city' };
};

/** Pricing settings an agency may change, cleaned. Throws { status: 400 } on bad input. */
const cleanPricing = (input = {}) => {
  const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
  const amount = (v, name, { min = 0 } = {}) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < min || n > 10_000_000) throw bad(`${name} must be a whole XAF amount${min ? ` of at least ${min}` : ''}.`);
    return n;
  };
  const rates = (src = {}, label) => {
    const out = {
      base_fee: amount(src.base_fee, `${label} base fee`), per_km: amount(src.per_km, `${label} price per km`),
      min_fee: amount(src.min_fee, `${label} minimum`), max_fee: amount(src.max_fee, `${label} maximum`),
    };
    if (out.max_fee > 0 && out.min_fee != null && out.max_fee < out.min_fee) throw bad(`${label} maximum must be above the minimum (or 0 for no cap).`);
    return out;
  };
  const out = {};
  if (input.mode !== undefined) {
    if (!['district', 'distance'].includes(input.mode)) throw bad('Pricing mode must be district or distance.');
    out.mode = input.mode;
  }
  Object.assign(out, rates(input, 'Within-city'));
  if (input.round_to !== undefined) out.round_to = amount(input.round_to, 'Rounding', { min: 1 });
  if (input.cross_city) {
    const c = input.cross_city;
    out.cross_city = { ...rates(c, 'Cross-city') };
    if (c.enabled !== undefined) out.cross_city.enabled = Boolean(c.enabled);
    if (c.city_pairs !== undefined) {
      if (!Array.isArray(c.city_pairs) || c.city_pairs.length > 100) throw bad('City pairs must be a list (at most 100).');
      const seen = new Set();
      out.cross_city.city_pairs = c.city_pairs.map((pair) => {
        const from_city = String(pair?.from_city || '').trim().slice(0, 80);
        const to_city = String(pair?.to_city || '').trim().slice(0, 80);
        if (!from_city || !to_city) throw bad('Each city pair needs both cities.');
        if (cityKey(from_city) === cityKey(to_city)) throw bad('A city pair needs two different cities.');
        const key = [cityKey(from_city), cityKey(to_city)].sort().join('|');
        if (seen.has(key)) throw bad(`${from_city} – ${to_city} is listed twice.`);
        seen.add(key);
        const price = amount(pair.price, `${from_city} – ${to_city} price`, { min: 1 });
        if (price === undefined) throw bad(`Enter a price for ${from_city} – ${to_city}.`);
        return { from_city, to_city, price };
      });
    }
  }
  return out;
};

module.exports = { isDistance, priceDelivery, covers, cityOf, cityKey, cleanPricing };
