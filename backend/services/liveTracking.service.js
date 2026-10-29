/**
 * services/liveTracking.service.js
 * Rider GPS on customer tracking pages (feature flag `live_tracking`).
 *
 * Privacy rules:
 * - A rider can only report a position while holding an accepted delivery that is
 *   under way, or while they have switched themselves online so automatic dispatch
 *   can offer them the nearest pickup. Offline riders are never tracked.
 * - Customers see a position only for their own delivery, only while it is under
 *   way, and only as its parties or the holder of its secret tracking link.
 * - Old fixes (> LIVE_STALE_SECONDS) are not shown: a frozen dot misleads more than none.
 */
const RiderProfile = require('../models/RiderProfile.model');
const DeliveryAssignment = require('../models/DeliveryAssignment.model');
const Shipment = require('../models/Shipment.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { isEnabled, readFlags } = require('../utils/featureFlags');

const LIVE_STATUSES = ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'];
const STALE_MS = Number(process.env.LIVE_STALE_SECONDS || 300) * 1000;
const MIN_WRITE_MS = 4000; // phones can fire GPS every second; one write per few seconds is plenty

const flagOn = async () => isEnabled(await PlatformSettings.getSettings(), 'live_tracking');
// Positions are collected only when something uses them: live tracking or automatic dispatch.
const collecting = async () => {
  const flags = readFlags(await PlatformSettings.getSettings());
  return { live: flags.live_tracking === true, dispatch: flags.auto_rider_dispatch !== 'off' };
};

const validFix = ({ lat, lng, accuracy_m }) => {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  const acc = Number(accuracy_m);
  return { lat: la, lng: ln, accuracy_m: Number.isFinite(acc) && acc >= 0 ? Math.round(acc) : null };
};

/** Accepted, still-running assignments of this rider whose shipment is under way. */
const liveAssignments = async (riderId) => {
  const assignments = await DeliveryAssignment.find({ rider_id: riderId, status: 'accepted', active: true }).select('shipment_id').lean();
  if (!assignments.length) return [];
  const live = await Shipment.find({ _id: { $in: assignments.map((a) => a.shipment_id) }, status: { $in: LIVE_STATUSES } }).select('_id').lean();
  return live.map((s) => s._id);
};

/**
 * Stores the rider's latest fix. Returns { ok, stored } or { error, status }.
 */
const reportLocation = async (userId, body) => {
  const use = await collecting();
  if (!use.live && !use.dispatch) return { error: 'Location sharing is not enabled.', status: 403 };
  const fix = validFix(body || {});
  if (!fix) return { error: 'A valid latitude and longitude are required.', status: 400 };
  const profile = await RiderProfile.findOne({ user_id: userId, status: 'active' }).select('_id availability last_location').lean();
  if (!profile) return { error: 'You are not an active rider.', status: 403 };
  const waitingForWork = use.dispatch && profile.availability === 'online';
  if (!waitingForWork && !(await liveAssignments(userId)).length) return { error: 'Location is only shared while you are online or on a delivery.', status: 409 };

  const last = profile.last_location?.at ? new Date(profile.last_location.at).getTime() : 0;
  if (Date.now() - last < MIN_WRITE_MS) return { ok: true, stored: false };
  await RiderProfile.updateOne({ _id: profile._id }, { $set: { last_location: { ...fix, at: new Date() } } });
  return { ok: true, stored: true };
};

/**
 * The rider position to show for a shipment, or { live: false, reason }.
 * Callers must already have checked that the viewer may see this shipment.
 */
const liveForShipment = async (shipment) => {
  if (!(await flagOn())) return { live: false, reason: 'disabled' };
  if (!LIVE_STATUSES.includes(shipment.status)) return { live: false, reason: 'not_under_way', status: shipment.status };
  const assignment = await DeliveryAssignment.findOne({ shipment_id: shipment._id, status: 'accepted', active: true }).select('rider_id').lean();
  if (!assignment) return { live: false, reason: 'no_rider', status: shipment.status };
  const profile = await RiderProfile.findOne({ user_id: assignment.rider_id }).select('last_location vehicle_type vehicle_plate phone user_id').populate('user_id', 'name').lean();
  // Who is coming, shown even before the first GPS fix (like ride-hailing apps).
  const who = {
    name: String(profile?.user_id?.name || 'Your rider').trim().split(/\s+/)[0],
    vehicle_type: profile?.vehicle_type || null,
    vehicle_plate: profile?.vehicle_plate || null,
    phone: profile?.phone || null,
  };
  const loc = profile?.last_location;
  if (!loc?.at || Date.now() - new Date(loc.at).getTime() > STALE_MS) return { live: false, reason: 'no_signal', status: shipment.status, rider_info: who };

  const rider = { lat: loc.lat, lng: loc.lng, accuracy_m: loc.accuracy_m ?? null, at: loc.at, vehicle_type: profile.vehicle_type };
  return { live: true, status: shipment.status, rider, rider_info: who, route: await routeForShipment(shipment, rider) };
};

/**
 * Road route and arrival times: before pickup the rider goes to the pickup and
 * then the drop-off; after pickup, straight to the drop-off. Null without points
 * or without a routing key.
 */
const routeForShipment = async (shipment, rider) => {
  const { pickupPoint } = require('./riderDispatch.service');
  const { routeFor } = require('./routing.service');
  const toPickup = shipment.status === 'assigned';
  const [pickup, dropoff] = await Promise.all([toPickup ? pickupPoint(shipment.pickup_address) : null, pickupPoint(shipment.delivery_address)]);
  if (!dropoff || (toPickup && !pickup)) return null;
  const r = await routeFor(`${shipment._id}:${toPickup ? 'pickup' : 'dropoff'}`, rider, toPickup ? [pickup, dropoff] : [dropoff]);
  if (!r) return null;
  const mins = (s) => Math.max(1, Math.round(s / 60));
  return {
    heading_to: toPickup ? 'pickup' : 'dropoff',
    coordinates: r.coordinates,
    pickup: toPickup ? { lat: pickup.lat, lng: pickup.lng } : null,
    dropoff: { lat: dropoff.lat, lng: dropoff.lng, approx: dropoff.approx },
    distance_km: Math.round(r.distance_m / 100) / 10,
    pickup_eta_min: toPickup ? mins(r.legs[0]?.duration_s ?? r.duration_s) : null,
    dropoff_eta_min: mins(r.duration_s),
    computed_at: new Date(),
  };
};

module.exports = { reportLocation, liveForShipment, LIVE_STATUSES, STALE_MS };
