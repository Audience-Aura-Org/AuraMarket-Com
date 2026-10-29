/**
 * Agency delivery pricing rules (own agency only).
 *
 *   GET   /logistics/pricing/rules     mode, distance rates, cross-city rules, service cities
 *   PATCH /logistics/pricing/rules     change any of them
 *   POST  /logistics/pricing/preview   price a trip with the saved rules, or with unsaved
 *                                      `pricing` from the editor: { pickup, dropoff, pricing? }
 *
 * The quartier price list stays on PATCH /logistics/pricing; district mode keeps using it.
 */
const mongoose = require('mongoose');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const { cleanPricing, priceDelivery } = require('../services/pricing.service');
const { confirmedPoint } = require('../utils/geoPoint');
const { recordAudit } = require('../utils/auditTrail');

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const myAgency = (user) => LogisticsCompany.findOne({ user_id: user._id });

const view = (firm) => {
  const p = firm.pricing?.toObject ? firm.pricing.toObject() : (firm.pricing || {});
  return {
    pricing: { ...p, mode: p.mode || 'district', cross_city: { city_pairs: [], ...(p.cross_city || {}) } },
    service_regions: firm.service_regions || [],
    quartier_count: (firm.quartier_prices || []).length,
  };
};

const getRules = async (req, res, next) => {
  try {
    const firm = await myAgency(req.user);
    if (!firm) return fail(res, 404, 'Set up your delivery agency first.');
    res.json({ success: true, data: view(firm) });
  } catch (err) { next(err); }
};

const cleanCities = (list) => {
  if (!Array.isArray(list) || list.length > 50) throw Object.assign(new Error('Service cities must be a list (at most 50).'), { status: 400 });
  return [...new Set(list.map((c) => String(c || '').trim().slice(0, 80)).filter(Boolean))];
};

const setRules = async (req, res, next) => {
  try {
    const firm = await myAgency(req.user);
    if (!firm) return fail(res, 404, 'Set up your delivery agency first.');
    const before = view(firm);
    const body = req.body || {};
    let changes;
    try {
      changes = body.pricing ? cleanPricing(body.pricing) : {};
      if (body.service_regions !== undefined) firm.service_regions = cleanCities(body.service_regions);
    } catch (e) {
      if (e.status === 400) return fail(res, 400, e.message);
      throw e;
    }
    // Merge field by field so a partial update keeps the rest.
    const { cross_city: cross, ...top } = changes;
    for (const [k, v] of Object.entries(top)) if (v !== undefined) firm.set(`pricing.${k}`, v);
    for (const [k, v] of Object.entries(cross || {})) if (v !== undefined) firm.set(`pricing.cross_city.${k}`, v);

    const p = firm.pricing || {};
    if (p.max_fee > 0 && p.max_fee < p.min_fee) return fail(res, 400, 'Within-city maximum must be above the minimum (or 0 for no cap).');
    if (p.cross_city?.max_fee > 0 && p.cross_city.max_fee < p.cross_city.min_fee) return fail(res, 400, 'Cross-city maximum must be above the minimum (or 0 for no cap).');
    if (p.mode === 'distance' && !(p.base_fee > 0 || p.per_km > 0 || p.min_fee > 0)) return fail(res, 400, 'Set a base fee, a price per km or a minimum before switching to distance pricing.');

    await firm.save();
    const after = view(firm);
    await recordAudit({ actorId: req.user._id, action: 'agency_pricing_updated', targetType: 'LogisticsCompany', targetId: firm._id, before: before.pricing, after: after.pricing }).catch(() => {});
    res.json({ success: true, message: 'Pricing saved.', data: after });
  } catch (err) { next(err); }
};

const placeFrom = (input) => input && {
  zone_id: mongoose.isValidObjectId(input.zone_id) ? input.zone_id : undefined,
  quartier: typeof input.quartier === 'string' ? input.quartier.slice(0, 120) : undefined,
  city: typeof input.city === 'string' ? input.city.slice(0, 80) : undefined,
  location: confirmedPoint(input.location) || null,
};

const preview = async (req, res, next) => {
  try {
    const firm = await myAgency(req.user);
    if (!firm) return fail(res, 404, 'Set up your delivery agency first.');
    const body = req.body || {};
    const pickup = placeFrom(body.pickup);
    const dropoff = placeFrom(body.dropoff);
    if (!pickup || !dropoff || (!pickup.zone_id && !pickup.location && !pickup.quartier) || (!dropoff.zone_id && !dropoff.location && !dropoff.quartier)) {
      return fail(res, 400, 'Choose a pickup and a drop-off.');
    }
    let draft;
    try { draft = body.pricing ? cleanPricing(body.pricing) : {}; } catch (e) {
      if (e.status === 400) return fail(res, 400, e.message);
      throw e;
    }
    const saved = view(firm).pricing;
    const pricing = { ...saved, ...strip(draft), mode: 'distance', cross_city: { ...saved.cross_city, ...strip(draft.cross_city || {}) } };
    const regions = body.service_regions !== undefined ? cleanCities(body.service_regions) : firm.service_regions;
    const quote = await priceDelivery({ pricing, service_regions: regions }, { pickup, dropoff });
    if (quote.error) return fail(res, 400, quote.error);
    res.json({ success: true, data: quote });
  } catch (err) {
    if (err.status === 400) return fail(res, 400, err.message);
    next(err);
  }
};

const strip = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

module.exports = { getRules, setRules, preview };
