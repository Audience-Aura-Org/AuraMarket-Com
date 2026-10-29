/**
 * Rider assignment endpoints.
 *
 * Agency (own shipments only):
 *   GET  /logistics/shipments/:id/assignment         live offer, history, ranked riders, shadow suggestion
 *   POST /logistics/shipments/:id/assign             { rider_id: <RiderProfile id> } → offer
 *   POST /logistics/shipments/:id/assignment/cancel  withdraw offer / take back before pickup
 * Rider:
 *   GET  /riders/me/deliveries                       open offers, active delivery, recent history
 *   POST /riders/me/offers/:assignmentId/accept | /reject
 *   POST /riders/me/deliveries/:shipmentId/status    picked_up | in_transit | out_for_delivery | delivered | failed
 */
const mongoose = require('mongoose');
const DeliveryAssignment = require('../models/DeliveryAssignment.model');
const RiderProfile = require('../models/RiderProfile.model');
const Shipment = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const dispatch = require('../services/riderDispatch.service');
const { modifyShipmentStatus } = require('./logistics.controller');

const RIDER_STATUSES = ['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];
const fail = (res, e, fallback) => res.status(e.status || 500).json({ success: false, message: e.status ? e.message : fallback });
const myAgency = (user) => LogisticsCompany.findOne({ user_id: user._id }).select('_id').lean();

/** Runs a status handler, then closes the rider assignment if the delivery ended. */
const withAssignmentSync = (handler) => (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 300 && req.params.id) dispatch.settleAfterStatus(req.params.id, req.body?.status).catch((e) => console.error('[dispatch] settle:', e.message));
  });
  return handler(req, res, next);
};

const getAssignment = async (req, res) => {
  try {
    const agency = await myAgency(req.user);
    if (!agency || !mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Shipment not found.' });
    const shipment = await Shipment.findOne({ _id: req.params.id, logistics_id: agency._id }).select('tracking_code status rider_id dispatch pickup_address package_details logistics_id').lean();
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found.' });
    const [history, ranked] = await Promise.all([
      DeliveryAssignment.find({ shipment_id: shipment._id }).sort({ createdAt: -1 }).limit(20).populate('rider_id', 'name avatar').lean(),
      dispatch.rankRiders(shipment),
    ]);
    const profiles = await RiderProfile.find({ agency_id: agency._id, status: 'active' }).populate('user_id', 'name avatar').lean();
    res.json({ success: true, data: {
      live: history.find((a) => a.active) || null,
      history,
      suggested: shipment.dispatch?.suggested_rider_id ? { rider_id: shipment.dispatch.suggested_rider_id, reason: shipment.dispatch.reason, at: shipment.dispatch.suggested_at } : null,
      riders: profiles.map((p) => {
        const rank = ranked.findIndex((r) => r.profile._id.toString() === p._id.toString());
        return { id: p._id, user_id: p.user_id?._id, name: p.user_id?.name, avatar: p.user_id?.avatar || null, availability: p.availability, vehicle_type: p.vehicle_type,
          eligible: rank !== -1, rank: rank === -1 ? null : rank + 1, reason: rank === -1 ? null : ranked[rank].reason };
      }).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    } });
  } catch (e) { fail(res, e, 'Could not load the assignment.'); }
};

const assignRider = async (req, res) => {
  try {
    const agency = await myAgency(req.user);
    if (!agency || !mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Shipment not found.' });
    const assignment = await dispatch.manualOffer({ shipmentId: req.params.id, agencyId: agency._id, riderProfileId: req.body?.rider_id, actorId: req.user._id, app: req.app });
    res.status(201).json({ success: true, data: { assignment } });
  } catch (e) { fail(res, e, 'Could not offer the delivery.'); }
};

const cancelAssignment = async (req, res) => {
  try {
    const agency = await myAgency(req.user);
    if (!agency || !mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Shipment not found.' });
    await dispatch.cancel({ shipmentId: req.params.id, agencyId: agency._id, actorId: req.user._id });
    res.json({ success: true });
  } catch (e) { fail(res, e, 'Could not cancel the assignment.'); }
};

const shipmentCard = (s) => s && ({
  id: s._id, tracking_code: s.tracking_code, status: s.status, type: s.type, price: s.price,
  package: { category: s.package_details?.category, weight_tier: s.package_details?.weight_tier, description: s.package_details?.description },
  pickup: { ...s.pickup_address, contact: s.guest_booker?.name || s.booked_by?.name || null, phone: s.pickup_address?.phone || s.guest_booker?.phone || s.booked_by?.phone || null },
  // The rider gets the confirmed destination only (never a live customer position).
  delivery: { ...s.delivery_address, contact: s.other_party?.name || null, phone: s.delivery_address?.phone || s.other_party?.phone || null },
  instructions: s.delivery_description || null,
  cash_to_collect: s.agency_package?.payment_arrangement === 'pay_on_delivery' ? s.agency_package.amount_due_on_delivery
    : s.order_id?.payment_method === 'pay_on_delivery' && s.order_id?.payment_status !== 'paid' ? s.order_id.total_amount : 0,
});

const myDeliveries = async (req, res) => {
  try {
    const profile = await RiderProfile.findOne({ user_id: req.user._id, status: 'active' }).lean();
    if (!profile) return res.status(403).json({ success: false, message: 'You are not an active rider.' });
    const populate = (q) => q.populate({ path: 'shipment_id', populate: [{ path: 'booked_by', select: 'name phone' }, { path: 'order_id', select: 'payment_method payment_status total_amount' }] });
    const [offers, active, recent] = await Promise.all([
      populate(DeliveryAssignment.find({ rider_id: req.user._id, status: 'offered', active: true, expires_at: { $gt: new Date() } })).lean(),
      populate(DeliveryAssignment.find({ rider_id: req.user._id, status: 'accepted', active: true })).lean(),
      populate(DeliveryAssignment.find({ rider_id: req.user._id, status: { $in: ['completed', 'cancelled'] } }).sort({ updatedAt: -1 }).limit(15)).lean(),
    ]);
    const shape = (a) => ({ assignment_id: a._id, status: a.status, offered_at: a.offered_at, expires_at: a.expires_at, completed_at: a.completed_at, shipment: shipmentCard(a.shipment_id) });
    const cash = await require('../services/riderCash.service').balanceFor(profile.agency_id, req.user._id);
    res.json({ success: true, data: { availability: profile.availability, cash_holding: cash.holding, offers: offers.map(shape), active: active.map(shape), recent: recent.map(shape) } });
  } catch (e) { fail(res, e, 'Could not load your deliveries.'); }
};

/**
 * Rider map: the rider's last position, each accepted delivery's pickup and drop-off
 * (exact pins, else the quartier centre, flagged approx), and the road route for the
 * delivery being worked on now. Routes are cached, so polling this is cheap.
 */
const myMap = async (req, res) => {
  try {
    const profile = await RiderProfile.findOne({ user_id: req.user._id, status: 'active' }).select('availability vehicle_type last_location').lean();
    if (!profile) return res.status(403).json({ success: false, message: 'You are not an active rider.' });
    const { routeForShipment } = require('../services/liveTracking.service');
    const active = await DeliveryAssignment.find({ rider_id: req.user._id, status: 'accepted', active: true })
      .populate('shipment_id', 'tracking_code status pickup_address delivery_address').sort({ responded_at: 1 }).lean();
    const loc = profile.last_location;
    const me = loc?.lat != null ? { lat: loc.lat, lng: loc.lng, at: loc.at } : null;
    const jobs = await Promise.all(active.filter((a) => a.shipment_id).map(async (a, i) => {
      const s = a.shipment_id;
      const [pickup, dropoff] = await Promise.all([dispatch.pickupPoint(s.pickup_address), dispatch.pickupPoint(s.delivery_address)]);
      // Only the first delivery gets a road route (the one the rider is doing now).
      const route = i === 0 && me ? await routeForShipment(s, me).catch(() => null) : null;
      return {
        shipment_id: s._id, tracking_code: s.tracking_code, status: s.status,
        pickup: pickup && { ...pickup, quartier: s.pickup_address?.quartier || null },
        dropoff: dropoff && { ...dropoff, quartier: s.delivery_address?.quartier || null },
        route,
      };
    }));
    res.json({ success: true, data: { availability: profile.availability, vehicle_type: profile.vehicle_type, me, jobs } });
  } catch (e) { fail(res, e, 'Could not load your map.'); }
};

const respond = (accept) => async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.assignmentId)) return res.status(404).json({ success: false, message: 'Offer not found.' });
    if (accept) await dispatch.accept({ assignmentId: req.params.assignmentId, rider: req.user, app: req.app });
    else await dispatch.reject({ assignmentId: req.params.assignmentId, rider: req.user, reason: req.body?.reason, app: req.app });
    res.json({ success: true });
  } catch (e) { fail(res, e, 'Could not answer the offer.'); }
};

const riderStatus = async (req, res, next) => {
  if (!RIDER_STATUSES.includes(req.body?.status)) return res.status(400).json({ success: false, message: 'Choose picked up, on the way, delivered or failed.' });
  if (!mongoose.isValidObjectId(req.params.shipmentId)) return res.status(404).json({ success: false, message: 'Delivery not found.' });
  const live = await DeliveryAssignment.exists({ shipment_id: req.params.shipmentId, rider_id: req.user._id, status: 'accepted', active: true });
  if (!live) return res.status(403).json({ success: false, message: 'This delivery is not assigned to you.' });
  req.params.id = req.params.shipmentId;
  req.riderContext = true;
  return withAssignmentSync(modifyShipmentStatus)(req, res, next);
};

module.exports = { getAssignment, assignRider, cancelAssignment, myDeliveries, myMap, acceptOffer: respond(true), rejectOffer: respond(false), riderStatus, withAssignmentSync };
