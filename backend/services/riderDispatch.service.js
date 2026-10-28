/**
 * services/riderDispatch.service.js
 * Offering deliveries to an agency's riders, manually or automatically.
 *
 * Eligible rider: active member of the shipment's agency, online (not offline,
 * not busy on another delivery), account active, has not already rejected or
 * let this shipment's offer expire, and with a vehicle fit for the package
 * (heavy parcels never go to bicycles or riders on foot).
 *
 * Ranking (transparent, recorded as `reason`): nearest to the pickup pin when
 * both the pin and a fresh rider location (≤ 10 min) exist; otherwise fewest
 * deliveries today, then longest idle.
 *
 * Flag auto_rider_dispatch: "off" → agencies assign by hand; "shadow" → the
 * engine records its suggestion only; "on" → the engine sends offers and moves to
 * the next rider on reject/timeout. One live offer per shipment is guaranteed by
 * the DeliveryAssignment unique index.
 */
const mongoose = require('mongoose');
const DeliveryAssignment = require('../models/DeliveryAssignment.model');
const RiderProfile = require('../models/RiderProfile.model');
const Shipment = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { readFlags } = require('../utils/featureFlags');
const { sendNotification } = require('../utils/notifier');
const { withLock } = require('../utils/locks');

const OFFER_SECONDS = () => Number(process.env.RIDER_OFFER_TIMEOUT_SECONDS || 120);
const FRESH_LOCATION_MS = 10 * 60 * 1000;
const DISPATCHABLE = ['pending', 'assigned', 'failed'];
const SMALL_VEHICLES = ['bicycle', 'on_foot'];
const HEAVY = ['heavy', 'extra_heavy'];

const err = (status, message) => Object.assign(new Error(message), { status });
const notify = (app, userId, data) => userId && sendNotification(app, userId, data).catch((e) => console.error('[riderDispatch] notify:', e.message));

const distanceKm = (a, b) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const dispatchMode = async () => readFlags(await PlatformSettings.getSettings()).auto_rider_dispatch;

/** Ranked eligible riders for a shipment: [{ profile, distance_km, today, reason }]. */
const rankRiders = async (shipment) => {
  const tried = await DeliveryAssignment.distinct('rider_id', { shipment_id: shipment._id, status: { $in: ['rejected', 'expired'] } });
  const profiles = await RiderProfile.find({ agency_id: shipment.logistics_id, status: 'active', availability: 'online', user_id: { $nin: tried } })
    .populate('user_id', 'name is_active').lean();
  const heavy = HEAVY.includes(shipment.package_details?.weight_tier);
  const eligible = profiles.filter((p) => p.user_id && p.user_id.is_active !== false && !(heavy && SMALL_VEHICLES.includes(p.vehicle_type)));
  if (!eligible.length) return [];

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayCounts = await DeliveryAssignment.aggregate([
    { $match: { rider_id: { $in: eligible.map((p) => p.user_id._id) }, status: { $in: ['accepted', 'completed'] }, offered_at: { $gte: startOfDay } } },
    { $group: { _id: '$rider_id', n: { $sum: 1 } } },
  ]);
  const today = new Map(todayCounts.map((r) => [r._id.toString(), r.n]));
  const pickup = shipment.pickup_address?.location?.lat != null ? shipment.pickup_address.location : null;

  return eligible.map((p) => {
    const fresh = p.last_location?.at && Date.now() - new Date(p.last_location.at).getTime() <= FRESH_LOCATION_MS && p.last_location.lat != null;
    const distance_km = pickup && fresh ? Math.round(distanceKm(pickup, p.last_location) * 10) / 10 : null;
    const n = today.get(p.user_id._id.toString()) || 0;
    return { profile: p, distance_km, today: n, idle_since: p.availability_changed_at ? new Date(p.availability_changed_at).getTime() : 0,
      reason: distance_km != null ? `${distance_km} km from pickup` : `${n} deliver${n === 1 ? 'y' : 'ies'} today` };
  }).sort((a, b) => {
    if (a.distance_km != null || b.distance_km != null) {
      if (a.distance_km == null) return 1;
      if (b.distance_km == null) return -1;
      if (a.distance_km !== b.distance_km) return a.distance_km - b.distance_km;
    }
    return a.today - b.today || a.idle_since - b.idle_since;
  });
};

/** Creates the single live offer for a shipment. Throws 409 if one already exists. */
const offer = async (shipment, riderUserId, { mode, offeredBy = null, reason = null, app = null }) => {
  let assignment;
  try {
    assignment = await DeliveryAssignment.create({
      shipment_id: shipment._id, agency_id: shipment.logistics_id, rider_id: riderUserId, mode, offered_by: offeredBy, reason,
      expires_at: new Date(Date.now() + OFFER_SECONDS() * 1000),
    });
  } catch (e) {
    if (e?.code === 11000) throw err(409, 'This delivery is already offered to or carried by a rider.');
    throw e;
  }
  await Shipment.updateOne({ _id: shipment._id }, { $inc: { 'dispatch.attempts': 1 }, $set: { 'dispatch.mode': mode } });
  notify(app, riderUserId, {
    title: 'New delivery for you',
    message: `${shipment.pickup_address?.quartier || 'Pickup'} → ${shipment.delivery_address?.quartier || 'delivery'} (${shipment.tracking_code}). Accept within ${Math.round(OFFER_SECONDS() / 60) || 1} min.`,
    type: 'logistics_update', metadata: { link: '/rider', shipment_id: shipment._id, assignment_id: assignment._id },
  });
  return assignment;
};

/** Engine entry point: honours the off/shadow/on flag. Safe to call repeatedly. */
const autoDispatch = async (shipmentId, app = null) => {
  const mode = await dispatchMode();
  if (mode === 'off') return { skipped: 'off' };
  const shipment = await Shipment.findById(shipmentId).lean();
  if (!shipment || shipment.rider_id || !DISPATCHABLE.includes(shipment.status)) return { skipped: 'not_dispatchable' };
  if (await DeliveryAssignment.exists({ shipment_id: shipment._id, active: true })) return { skipped: 'already_offered' };

  const ranked = await rankRiders(shipment);
  if (!ranked.length) {
    if (mode === 'on' && !shipment.dispatch?.unassigned_alerted_at) {
      await Shipment.updateOne({ _id: shipment._id }, { $set: { 'dispatch.unassigned_alerted_at': new Date() } });
      const firm = await LogisticsCompany.findById(shipment.logistics_id).select('user_id').lean();
      notify(app, firm?.user_id, { title: 'No rider available', message: `${shipment.tracking_code} is waiting: none of your riders is online and free. Assign it by hand from Manifests.`,
        type: 'logistics_update', metadata: { link: `/logistics/manifests?shipmentId=${shipment._id}` } });
    }
    return { assigned: false, reason: 'no_eligible_rider' };
  }

  const best = ranked[0];
  if (mode === 'shadow') {
    await Shipment.updateOne({ _id: shipment._id }, { $set: { 'dispatch.mode': 'shadow', 'dispatch.suggested_rider_id': best.profile.user_id._id, 'dispatch.suggested_at': new Date(), 'dispatch.reason': best.reason } });
    return { suggested: best.profile.user_id._id, reason: best.reason };
  }
  try {
    const assignment = await offer(shipment, best.profile.user_id._id, { mode: 'auto', reason: best.reason, app });
    return { offered: best.profile.user_id._id, assignment_id: assignment._id, reason: best.reason };
  } catch (e) {
    if (e.status === 409) return { skipped: 'already_offered' };
    throw e;
  }
};

/** Agency assigns by hand (works in every mode). */
const manualOffer = async ({ shipmentId, agencyId, riderProfileId, actorId, app }) => {
  const shipment = await Shipment.findOne({ _id: shipmentId, logistics_id: agencyId }).lean();
  if (!shipment) throw err(404, 'Shipment not found.');
  if (!DISPATCHABLE.includes(shipment.status) || shipment.rider_id) throw err(400, 'This delivery already has a rider or cannot be assigned at this stage.');
  const profile = mongoose.isValidObjectId(riderProfileId) ? await RiderProfile.findOne({ _id: riderProfileId, agency_id: agencyId }).lean() : null;
  if (!profile) throw err(404, 'Rider not found.');
  if (profile.status !== 'active') throw err(400, 'This rider is not active.');
  if (profile.availability === 'busy') throw err(400, 'This rider is on another delivery.');
  return offer(shipment, profile.user_id, { mode: 'manual', offeredBy: actorId, reason: 'Chosen by the agency', app });
};

const accept = async ({ assignmentId, rider, app }) => {
  const session = await mongoose.startSession();
  let assignment;
  let shipment;
  try {
    await session.withTransaction(async () => {
      assignment = await DeliveryAssignment.findOneAndUpdate(
        { _id: assignmentId, rider_id: rider._id, status: 'offered', active: true, expires_at: { $gt: new Date() } },
        { $set: { status: 'accepted', responded_at: new Date() } },
        { session, returnDocument: 'after' }
      );
      if (!assignment) throw err(409, 'This offer has expired or is no longer yours.');
      shipment = await Shipment.findOne({ _id: assignment.shipment_id, rider_id: null }).session(session);
      if (!shipment) throw err(409, 'This delivery already has a rider.');
      shipment.rider_id = rider._id;
      shipment.rider_assigned_at = new Date();
      if (shipment.status === 'pending' || shipment.status === 'failed') {
        shipment.status = 'assigned';
        shipment.shipment_logs.push({ status: 'assigned', updated_by: rider._id, timestamp: new Date(), note: `Rider ${rider.name || ''} accepted`.trim() });
      }
      await shipment.save({ session });
      await RiderProfile.updateOne({ user_id: rider._id, status: 'active' }, { $set: { availability: 'busy', availability_changed_at: new Date() } }, { session });
    });
  } finally {
    await session.endSession();
  }
  const firm = await LogisticsCompany.findById(shipment.logistics_id).select('user_id').lean();
  notify(app, firm?.user_id, { title: 'Rider on the way', message: `${rider.name || 'Your rider'} accepted ${shipment.tracking_code}.`, type: 'logistics_update', metadata: { link: `/logistics/manifests?shipmentId=${shipment._id}` } });
  for (const party of [shipment.booked_by, shipment.other_party?.user_id]) {
    notify(app, party, { title: 'A rider is assigned', message: `${rider.name?.split(' ')[0] || 'A rider'} will deliver ${shipment.tracking_code}. You can follow it from your delivery page.`,
      type: 'p2p_status', metadata: { link: `/delivery/track?code=${shipment.tracking_code}`, status: 'assigned' } });
  }
  return { assignment, shipment };
};

const reject = async ({ assignmentId, rider, reason, app }) => {
  const assignment = await DeliveryAssignment.findOneAndUpdate(
    { _id: assignmentId, rider_id: rider._id, status: 'offered', active: true },
    { $set: { status: 'rejected', active: false, responded_at: new Date(), reject_reason: String(reason || '').slice(0, 200) || null } },
    { returnDocument: 'after' }
  );
  if (!assignment) throw err(409, 'This offer is no longer open.');
  if (assignment.mode === 'manual') {
    const firm = await LogisticsCompany.findById(assignment.agency_id).select('user_id').lean();
    notify(app, firm?.user_id, { title: 'Rider declined', message: `${rider.name || 'A rider'} declined a delivery${reason ? `: ${reason}` : ''}. Assign another rider.`, type: 'logistics_update', metadata: { link: `/logistics/manifests?shipmentId=${assignment.shipment_id}` } });
  }
  await autoDispatch(assignment.shipment_id, app); // next rider when the engine is on
  return assignment;
};

/** Agency withdraws an offer, or takes back a delivery the rider has not picked up yet. */
const cancel = async ({ shipmentId, agencyId, actorId }) => {
  const shipment = await Shipment.findOne({ _id: shipmentId, logistics_id: agencyId });
  if (!shipment) throw err(404, 'Shipment not found.');
  const live = await DeliveryAssignment.findOne({ shipment_id: shipment._id, active: true });
  if (!live) throw err(400, 'There is no rider offer to cancel.');
  if (live.status === 'accepted' && !['pending', 'assigned'].includes(shipment.status)) throw err(400, 'The rider already has the package; finish or fail the delivery instead.');
  await DeliveryAssignment.updateOne({ _id: live._id, active: true }, { $set: { status: 'cancelled', active: false, responded_at: new Date() } });
  if (live.status === 'accepted') {
    await Shipment.updateOne({ _id: shipment._id }, { $set: { rider_id: null, rider_assigned_at: null }, $push: { shipment_logs: { status: shipment.status, updated_by: actorId, timestamp: new Date(), note: 'Rider unassigned by the agency' } } });
    await RiderProfile.updateOne({ user_id: live.rider_id, availability: 'busy' }, { $set: { availability: 'online', availability_changed_at: new Date() } });
  }
  return live;
};

/** After a delivery ends (delivered / failed / cancelled): close the assignment and free the rider. */
const settleAfterStatus = async (shipmentId, status) => {
  if (!['delivered', 'failed', 'cancelled'].includes(status)) return;
  const live = await DeliveryAssignment.findOneAndUpdate(
    { shipment_id: shipmentId, active: true },
    { $set: { status: status === 'delivered' ? 'completed' : 'cancelled', active: false, completed_at: new Date() } },
    { returnDocument: 'before' }
  );
  if (live?.status === 'accepted') {
    const stillBusy = await DeliveryAssignment.exists({ rider_id: live.rider_id, status: 'accepted', active: true });
    if (!stillBusy) await RiderProfile.updateOne({ user_id: live.rider_id, availability: 'busy' }, { $set: { availability: 'online', availability_changed_at: new Date() } });
  }
  if (status === 'failed') await Shipment.updateOne({ _id: shipmentId }, { $set: { rider_id: null } });
};

/**
 * Deliveries waiting for a rider (any creation path: checkout, P2P, agency packages).
 * P2P bookings are only dispatched once paid: unverified prepaid orders never go out.
 */
const sweepUndispatched = async (app = null) => {
  if ((await dispatchMode()) === 'off') return 0;
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const waiting = await Shipment.find({ status: { $in: ['pending', 'assigned'] }, rider_id: null, createdAt: { $gte: since },
    $or: [{ type: { $ne: 'p2p' } }, { payment_status: 'paid' }] }).select('_id').sort({ createdAt: 1 }).limit(20).lean();
  let n = 0;
  for (const s of waiting) {
    const r = await autoDispatch(s._id, app).catch((e) => { console.error('[riderDispatch] sweep:', e.message); return null; });
    if (r?.offered || r?.suggested) n++;
  }
  return n;
};

/** Worker tick: expire unanswered offers, move on to the next rider, and pick up undispatched deliveries. */
const expireDueOffers = async (app = null) => withLock('worker:rider-offer-expiry', 50, async () => {
  const due = await DeliveryAssignment.find({ status: 'offered', active: true, expires_at: { $lte: new Date() } }).limit(50).lean();
  let expired = 0;
  for (const a of due) {
    const r = await DeliveryAssignment.updateOne({ _id: a._id, status: 'offered', active: true }, { $set: { status: 'expired', active: false } });
    if (!r.modifiedCount) continue;
    expired++;
    if (a.mode === 'manual') {
      const firm = await LogisticsCompany.findById(a.agency_id).select('user_id').lean();
      notify(app, firm?.user_id, { title: 'Offer not answered', message: 'A rider did not answer in time. Assign the delivery again.', type: 'logistics_update', metadata: { link: `/logistics/manifests?shipmentId=${a.shipment_id}` } });
    }
    await autoDispatch(a.shipment_id, app).catch((e) => console.error('[riderDispatch] re-dispatch:', e.message));
  }
  const dispatched = await sweepUndispatched(app);
  return { expired, dispatched };
});

let timer = null;
const startRiderOfferExpiryWorker = (app) => {
  if (timer) return;
  timer = setInterval(() => expireDueOffers(app).catch((e) => console.error('[riderDispatch] expiry:', e.message)), 30 * 1000);
  if (timer.unref) timer.unref();
};

module.exports = { rankRiders, autoDispatch, sweepUndispatched, manualOffer, accept, reject, cancel, settleAfterStatus, expireDueOffers, startRiderOfferExpiryWorker, distanceKm };
