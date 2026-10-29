/**
 * services/savedAddress.service.js
 * Saved addresses (User.addresses): up to MAX_SAVED per account. Every address used
 * at checkout, for a package or a P2P booking is remembered automatically:
 *   - the same place again (same quartier and within SAME_SPOT_METRES, or the same
 *     description when neither has a pin) only refreshes it (and adds the pin or
 *     description it was missing);
 *   - a new place is added; at the limit the least recently used address that is
 *     not the default makes room.
 * Saving never blocks the action that used the address.
 */
const User = require('../models/User.model');
const { confirmedPoint } = require('../utils/geoPoint');
const { metres } = require('./routing.service');

const MAX_SAVED = 5;
const SAME_SPOT_METRES = 150;

const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const text = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || undefined;

/** Same place? Pins decide when both have one; otherwise quartier + description. */
const samePlace = (a, b) => {
  const sameArea = (a.zone_id && b.zone_id && String(a.zone_id) === String(b.zone_id)) || (norm(a.quartier) && norm(a.quartier) === norm(b.quartier));
  if (a.location?.lat != null && b.location?.lat != null) return metres(a.location, b.location) <= SAME_SPOT_METRES;
  if (!sameArea) return false;
  const da = norm(a.place_name || a.landmark_description || a.street);
  const db = norm(b.place_name || b.landmark_description || b.street);
  return !da || !db || da === db;
};

/** Clean address fields from any address shape used in the app. */
const fromInput = (input = {}) => ({
  label: text(input.label, 40),
  place_name: text(input.place_name, 120),
  street: text(input.street, 200),
  quartier: text(input.quartier, 120),
  city: text(input.city, 80),
  region: text(input.region, 80),
  zone_id: input.zone_id || null,
  landmark_description: text(input.landmark_description ?? input.landmark ?? input.address_description, 300),
  recipient_name: text(input.recipient_name, 80),
  contact_phone: text(input.contact_phone ?? input.phone, 20),
  location: confirmedPoint(input.location) || undefined,
});

/**
 * Remember an address for a user. Returns the saved address, or null when the
 * address is too vague to reuse (no quartier and no pin).
 */
const rememberAddress = async (userId, input) => {
  const a = fromInput(input);
  if (!a.quartier && !a.zone_id && !a.location) return null;
  const user = await User.findById(userId).select('addresses');
  if (!user) return null;
  const now = new Date();
  let saved = user.addresses.find((x) => samePlace(x, a));
  if (saved) {
    saved.last_used_at = now;
    if (!saved.location?.lat && a.location) saved.location = a.location;
    for (const k of ['place_name', 'landmark_description', 'zone_id', 'city', 'recipient_name', 'contact_phone']) {
      if (!saved[k] && a[k]) saved[k] = a[k];
    }
  } else {
    if (user.addresses.length >= MAX_SAVED) {
      const spare = [...user.addresses].filter((x) => !x.isDefault)
        .sort((x, y) => new Date(x.last_used_at || x._id.getTimestamp()) - new Date(y.last_used_at || y._id.getTimestamp()))[0];
      if (!spare) return null;
      user.addresses.pull(spare._id);
    }
    user.addresses.push({ ...a, label: a.label || a.place_name || a.quartier || 'Address', isDefault: user.addresses.length === 0, last_used_at: now });
    saved = user.addresses[user.addresses.length - 1];
  }
  await user.save();
  return saved;
};

/** Fire-and-forget version for request handlers: never throws, never delays the reply. */
const rememberLater = (userId, ...inputs) => {
  if (!userId) return;
  setImmediate(async () => {
    for (const input of inputs) {
      try { await rememberAddress(userId, input); } catch (e) { console.warn('[savedAddress]', e.message); }
    }
  });
};

/** Saved addresses, default first, then most recently used. */
const sortSaved = (addresses = []) => [...addresses].sort((x, y) =>
  (y.isDefault ? 1 : 0) - (x.isDefault ? 1 : 0)
  || new Date(y.last_used_at || 0) - new Date(x.last_used_at || 0));

module.exports = { MAX_SAVED, rememberAddress, rememberLater, sortSaved, samePlace };
