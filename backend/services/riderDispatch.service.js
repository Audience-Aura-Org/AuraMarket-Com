/**
 * services/riderDispatch.service.js
 * Offering deliveries to an agency's riders, manually or automatically.
 *
 * Eligible rider: active member of the shipment's agency, online or already on a
 * delivery (never offline), holding fewer deliveries than the agency's limit
 * (max_active_per_rider: accepted ones plus open offers), account active, has not
 * already rejected or let this shipment's offer expire, and with a vehicle fit for
 * the package (heavy parcels never go to bicycles or riders on foot).
 *
 * Ranking (transparent, recorded as `reason`): free riders before riders already
 * carrying something; then nearest to the pickup when both the pickup point and a
 * fresh rider location (≤ 10 min) exist; riders with no fresh location come after
 * those with one, then fewest deliveries today, then longest idle.
 *
 * Riders may also take a waiting delivery themselves from their open deliveries
 * list (claim), including one offered to another rider who has not answered yet. The pickup point is the customer's map pin, or else the centre of
 * the pickup quartier (approximate, and the reason says so). Online riders report
 * their position from the rider page (services/liveTracking.service.js).
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
const LogisticZone = require('../models/LogisticZone.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { readFlags, isEnabled } = require('../utils/featureFlags');
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

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const DEFAULT_MAX_ACTIVE = 3;
const capFor = async (agencyId) => (await LogisticsCompany.findById(agencyId).select('max_active_per_rider').lean())?.max_active_per_rider || DEFAULT_MAX_ACTIVE;
/** Deliveries each rider holds now (accepted + open offers): Map(riderId -> n). */
const loadOf = async (riderIds) => {
  const rows = await DeliveryAssignment.aggregate([
    { $match: { rider_id: { $in: riderIds }, active: true, status: { $in: ['offered', 'accepted'] } } },
    { $group: { _id: '$rider_id', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.n]));
};

/** Where the rider must go: the exact pin, else the pickup quartier's centre. */
const pickupPoint = async (address) => {
  if (address?.location?.lat != null && address?.location?.lng != null) return { lat: address.location.lat, lng: address.location.lng, approx: false };
  let zone = null;
  if (address?.zone_id) zone = await LogisticZone.findById(address.zone_id).select('centroid').lean();
  if (!zone?.centroid?.coordinates && address?.quartier) {
    zone = await LogisticZone.findOne({ type: 'quartier', name: new RegExp(`^${escapeRegex(address.quartier.trim())}$`, 'i'), 'centroid.coordinates': { $exists: true } })
      .select('centroid').lean();
  }
  const c = zone?.centroid?.coordinates;
  return c?.length === 2 ? { lng: c[0], lat: c[1], approx: true } : null;
};

const dispatchMode = async () => readFlags(await PlatformSettings.getSettings()).auto_rider_dispatch;

/** Ranked eligible riders for a shipment: [{ profile, distance_km, today, reason }]. */
const rankRiders = async (shipment) => {
  const tried = await DeliveryAssignment.distinct('rider_id', { shipment_id: shipment._id, status: { $in: ['rejected', 'expired'] } });
  const profiles = await RiderProfile.find({ agency_id: shipment.logistics_id, status: 'active', availability: { $in: ['online', 'busy'] }, user_id: { $nin: tried } })
    .populate('user_id', 'name is_active').lean();
  const heavy = HEAVY.includes(shipment.package_details?.weight_tier);
  const [cap, load] = await Promise.all([capFor(shipment.logistics_id), loadOf(profiles.map((p) => p.user_id?._id).filter(Boolean))]);
  const eligible = profiles.filter((p) => p.user_id && p.user_id.is_active !== false && !(heavy && SMALL_VEHICLES.includes(p.vehicle_type))
    && (load.get(p.user_id._id.toString()) || 0) < cap);
  if (!eligible.length) return [];

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const todayCounts = await DeliveryAssignment.aggregate([
    { $match: { rider_id: { $in: eligible.map((p) => p.user_id._id) }, status: { $in: ['accepted', 'completed'] }, offered_at: { $gte: startOfDay } } },
    { $group: { _id: '$rider_id', n: { $sum: 1 } } },
  ]);
  const today = new Map(todayCounts.map((r) => [r._id.toString(), r.n]));
  const pickup = await pickupPoint(shipment.pickup_address);

  return eligible.map((p) => {
    const fresh = p.last_location?.at && Date.now() - new Date(p.last_location.at).getTime() <= FRESH_LOCATION_MS && p.last_location.lat != null;
    const distance_km = pickup && fresh ? Math.round(distanceKm(pickup, p.last_location) * 10) / 10 : null;
    const n = today.get(p.user_id._id.toString()) || 0;
    const carrying = load.get(p.user_id._id.toString()) || 0;
    const base = distance_km != null ? `${pickup.approx ? '~' : ''}${distance_km} km from pickup${pickup.approx ? ' (quartier centre)' : ''}` : `${n} deliver${n === 1 ? 'y' : 'ies'} today`;
    return { profile: p, distance_km, today: n, carrying, idle_since: p.availability_changed_at ? new Date(p.availability_changed_at).getTime() : 0,
      reason: carrying ? `${base} · already carrying ${carrying}` : base };
  }).sort((a, b) => {
    if ((a.carrying > 0) !== (b.carrying > 0)) return a.carrying > 0 ? 1 : -1; // free riders first
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
      notify(app, firm?.user_id, { title: 'No rider available', message: `${shipment.tracking_code} is waiting: none of your riders is online with room for another delivery. Assign it by hand from Manifests.`,
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
  const [cap, load] = await Promise.all([capFor(agencyId), loadOf([profile.user_id])]);
  const holding = load.get(profile.user_id.toString()) || 0;
  if (holding >= cap) throw err(400, `This rider already has ${holding} deliveries (your limit is ${cap} at a time).`);
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
      const carrying = await DeliveryAssignment.countDocuments({ rider_id: rider._id, status: 'accepted', active: true, _id: { $ne: assignment._id } }).session(session);
      const cap = await capFor(assignment.agency_id);
      if (carrying >= cap) throw err(409, `You already carry ${carrying} deliveries, your agency's limit. Finish one first.`);
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
  await announceRider(shipment, rider, app, 'accepted');
  return { assignment, shipment };
};

/** Tells the agency and the customer(s) who is delivering. */
const announceRider = async (shipment, rider, app, verb) => {
  const firm = await LogisticsCompany.findById(shipment.logistics_id).select('user_id').lean();
  notify(app, firm?.user_id, { title: 'Rider on the way', message: `${rider.name || 'Your rider'} ${verb} ${shipment.tracking_code}.`, type: 'logistics_update', metadata: { link: `/logistics/manifests?shipmentId=${shipment._id}` } });
  for (const party of [shipment.booked_by, shipment.other_party?.user_id]) {
    notify(app, party, { title: 'A rider is assigned', message: `${rider.name?.split(' ')[0] || 'A rider'} will deliver ${shipment.tracking_code}. You can follow it from your delivery page.`,
      type: 'p2p_status', metadata: { link: `/delivery/track?code=${shipment.tracking_code}`, status: 'assigned' } });
  }
};

// Deliveries a rider may see waiting in their agency (and take themselves).
const OPEN_DAYS = 3;
const openFilter = (agencyId) => ({
  logistics_id: agencyId, rider_id: null, status: { $in: DISPATCHABLE }, createdAt: { $gte: new Date(Date.now() - OPEN_DAYS * 864e5) },
  $or: [{ type: { $ne: 'p2p' } }, { payment_status: 'paid' }], // unpaid P2P bookings never go out
});

/**
 * Deliveries of the rider's agency still waiting for a rider, nearest pickup first.
 * Includes ones offered to another rider who has not answered (`offered_to_other`);
 * the rider's own open offers are listed separately (myDeliveries.offers).
 * Contact details stay hidden until the rider takes the delivery.
 */
const openDeliveries = async (rider) => {
  const profile = await RiderProfile.findOne({ user_id: rider._id, status: 'active' }).lean();
  if (!profile) throw err(403, 'You are not an active rider.');
  const shipments = await Shipment.find(openFilter(profile.agency_id))
    .select('tracking_code status type price pickup_address delivery_address package_details agency_package order_id createdAt')
    .populate('order_id', 'payment_method payment_status total_amount').sort({ createdAt: 1 }).limit(40).lean();
  const live = await DeliveryAssignment.find({ shipment_id: { $in: shipments.map((s) => s._id) }, active: true }).select('shipment_id rider_id status').lean();
  const liveBy = new Map(live.map((a) => [a.shipment_id.toString(), a]));
  const fresh = profile.last_location?.lat != null && Date.now() - new Date(profile.last_location.at).getTime() <= FRESH_LOCATION_MS;
  const rows = [];
  for (const s of shipments) {
    const a = liveBy.get(s._id.toString());
    if (a && (a.status === 'accepted' || a.rider_id.toString() === rider._id.toString())) continue;
    const pickup = fresh ? await pickupPoint(s.pickup_address) : null;
    rows.push({
      id: s._id, tracking_code: s.tracking_code, status: s.status, type: s.type || 'order', price: s.price, created_at: s.createdAt,
      pickup: { quartier: s.pickup_address?.quartier || null, landmark: s.pickup_address?.landmark || s.pickup_address?.street || null, city: s.pickup_address?.city || null },
      delivery: { quartier: s.delivery_address?.quartier || null, landmark: s.delivery_address?.landmark || null, city: s.delivery_address?.city || null },
      package: { category: s.package_details?.category, weight_tier: s.package_details?.weight_tier, description: s.package_details?.description },
      cash_to_collect: s.agency_package?.payment_arrangement === 'pay_on_delivery' ? s.agency_package.amount_due_on_delivery
        : s.order_id?.payment_method === 'pay_on_delivery' && s.order_id?.payment_status !== 'paid' ? s.order_id.total_amount : 0,
      distance_km: pickup ? Math.round(distanceKm(pickup, profile.last_location) * 10) / 10 : null,
      offered_to_other: Boolean(a),
      too_heavy: SMALL_VEHICLES.includes(profile.vehicle_type) && HEAVY.includes(s.package_details?.weight_tier),
    });
  }
  rows.sort((x, y) => (x.distance_km ?? Infinity) - (y.distance_km ?? Infinity) || new Date(x.created_at) - new Date(y.created_at));
  return rows;
};

/**
 * A rider takes a waiting delivery from the open list. An unanswered offer to
 * another rider is withdrawn; the one-live-assignment index still guarantees only
 * one rider ends up with it when two riders tap at the same moment.
 */
const claim = async ({ shipmentId, rider, app }) => {
  const profile = await RiderProfile.findOne({ user_id: rider._id, status: 'active' }).lean();
  if (!profile) throw err(403, 'You are not an active rider.');
  if (profile.availability === 'offline') throw err(400, 'Go online to take deliveries.');
  const mine = await DeliveryAssignment.findOne({ shipment_id: shipmentId, rider_id: rider._id, status: 'offered', active: true }).select('_id').lean();
  if (mine) return accept({ assignmentId: mine._id, rider, app }); // it is already offered to this rider
  const session = await mongoose.startSession();
  let shipment;
  let assignment;
  try {
    await session.withTransaction(async () => {
      shipment = await Shipment.findOne({ _id: shipmentId, ...openFilter(profile.agency_id) }).session(session);
      if (!shipment) throw err(409, 'This delivery is no longer waiting for a rider.');
      if (SMALL_VEHICLES.includes(profile.vehicle_type) && HEAVY.includes(shipment.package_details?.weight_tier)) throw err(400, 'This package is too heavy for your vehicle.');
      const carrying = await DeliveryAssignment.countDocuments({ rider_id: rider._id, active: true, status: { $in: ['offered', 'accepted'] } }).session(session);
      const cap = await capFor(profile.agency_id);
      if (carrying >= cap) throw err(409, `You already have ${carrying} deliveries, your agency's limit. Finish one first.`);
      const live = await DeliveryAssignment.findOne({ shipment_id: shipment._id, active: true }).session(session);
      if (live?.status === 'accepted') throw err(409, 'Another rider has just taken this delivery.');
      if (live) await DeliveryAssignment.updateOne({ _id: live._id, status: 'offered', active: true }, { $set: { status: 'cancelled', active: false, responded_at: new Date(), reject_reason: 'Taken by another rider' } }, { session });
      [assignment] = await DeliveryAssignment.create([{
        shipment_id: shipment._id, agency_id: profile.agency_id, rider_id: rider._id, mode: 'claim', status: 'accepted',
        offered_at: new Date(), responded_at: new Date(), expires_at: new Date(), reason: 'Taken from open deliveries',
      }], { session });
      shipment.rider_id = rider._id;
      shipment.rider_assigned_at = new Date();
      if (shipment.status === 'pending' || shipment.status === 'failed') {
        shipment.status = 'assigned';
        shipment.shipment_logs.push({ status: 'assigned', updated_by: rider._id, timestamp: new Date(), note: `Rider ${rider.name || ''} took it from open deliveries`.trim() });
      }
      await shipment.save({ session });
      await RiderProfile.updateOne({ user_id: rider._id, status: 'active' }, { $set: { availability: 'busy', availability_changed_at: new Date() } }, { session });
    });
  } catch (e) {
    if (e?.code === 11000) throw err(409, 'Another rider has just taken this delivery.');
    throw e;
  } finally {
    await session.endSession();
  }
  await announceRider(shipment, rider, app, 'took');
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
    const stillBusy = await DeliveryAssignment.exists({ rider_id: live.rider_id, status: 'accepted', active: true });
    if (!stillBusy) await RiderProfile.updateOne({ user_id: live.rider_id, availability: 'busy' }, { $set: { availability: 'online', availability_changed_at: new Date() } });
  }
  return live;
};

/** After a delivery ends (delivered / failed / cancelled): close the assignment and free the rider. */
const settleAfterStatus = async (shipmentId, status) => {
  if (!['delivered', 'failed', 'cancelled'].includes(status)) return;
  const live = await DeliveryAssignment.findOneAndUpdate(
    { shipment_id: shipmentId, active: true },
    { $set: { status: status === 'delivered' ? 'completed' : 'cancelled', active: false, completed_at: new Date(), outcome: status } },
    { returnDocument: 'before' }
  );
  // Record the fee and the rider's pay at today's rate, so later rate changes do not rewrite history.
  if (live?.status === 'accepted') {
    const [shipment, agency] = await Promise.all([
      Shipment.findById(shipmentId).select('price').lean(),
      LogisticsCompany.findById(live.agency_id).select('rider_pay').lean(),
    ]);
    const fee = Number(shipment?.price) || 0;
    const rule = agency?.rider_pay;
    const pay = status !== 'delivered' || !rule?.mode ? (status === 'delivered' ? null : 0)
      : rule.mode === 'fixed' ? Math.round(rule.value || 0) : Math.round((fee * (rule.value || 0)) / 100);
    await DeliveryAssignment.updateOne({ _id: live._id }, { $set: { delivery_fee: fee, rider_pay: pay } });
  }
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

/**
 * Flag payment_triggered_dispatch: offer riders the moment a delivery is paid for
 * (or, for food, accepted by the kitchen) instead of waiting for the 30 s sweep.
 * Pass the caller's transaction session so dispatch runs only once it has ended:
 * an aborted payment leaves no shipment to find. The sweep remains the backstop.
 */
const dispatchAfterPayment = (filter, { app = null, session = null } = {}) => {
  const run = async () => {
    try {
      if (!isEnabled(await PlatformSettings.getSettings(), 'payment_triggered_dispatch')) return;
      const ids = await Shipment.find({ ...filter, rider_id: null, status: { $in: DISPATCHABLE } }).distinct('_id');
      for (const id of ids) await autoDispatch(id, app);
    } catch (e) { console.error('[riderDispatch] after payment:', e.message); }
  };
  if (session?.once) session.once('ended', () => setImmediate(run));
  else setImmediate(run);
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

module.exports = { pickupPoint, rankRiders, autoDispatch, dispatchAfterPayment, sweepUndispatched, manualOffer, accept, reject, cancel, claim, openDeliveries, DEFAULT_MAX_ACTIVE, settleAfterStatus, expireDueOffers, startRiderOfferExpiryWorker, distanceKm };
