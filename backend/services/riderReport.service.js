/**
 * services/riderReport.service.js
 * Rider performance and dispatch quality for an agency over a period, from the
 * DeliveryAssignment history (every offer is kept, see riderDispatch.service).
 */
const mongoose = require('mongoose');
const DeliveryAssignment = require('../models/DeliveryAssignment.model');
const RiderProfile = require('../models/RiderProfile.model');
const riderCash = require('./riderCash.service');

const round = (n, d = 0) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);

const agencyReport = async (agencyId, { days = 30 } = {}) => {
  const agency = new mongoose.Types.ObjectId(String(agencyId));
  const since = new Date(Date.now() - days * 864e5);

  const [rows, dispatch, profiles, cash] = await Promise.all([
    DeliveryAssignment.aggregate([
      { $match: { agency_id: agency, offered_at: { $gte: since } } },
      {
        $group: {
          _id: '$rider_id',
          offers: { $sum: 1 },
          // Accepted = holding or finished the job. (Cancelled offers are left out: an
          // agency withdrawal also sets responded_at, so they cannot be told apart.)
          accepted: { $sum: { $cond: [{ $in: ['$status', ['accepted', 'completed']] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          expired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          response_ms: { $avg: { $cond: [{ $in: ['$status', ['accepted', 'completed', 'rejected']] }, { $subtract: ['$responded_at', '$offered_at'] }, null] } },
          delivery_ms: { $avg: { $cond: [{ $and: [{ $eq: ['$status', 'completed'] }, { $ne: ['$completed_at', null] }, { $ne: ['$responded_at', null] }] }, { $subtract: ['$completed_at', '$responded_at'] }, null] } },
        },
      },
    ]),
    DeliveryAssignment.aggregate([
      { $match: { agency_id: agency, offered_at: { $gte: since } } },
      { $group: { _id: '$shipment_id', offers: { $sum: 1 }, auto: { $sum: { $cond: [{ $eq: ['$mode', 'auto'] }, 1, 0] } }, done: { $max: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      { $group: { _id: null, deliveries: { $sum: 1 }, offers: { $sum: '$offers' }, auto_offers: { $sum: '$auto' }, completed: { $sum: '$done' }, first_try: { $sum: { $cond: [{ $and: [{ $eq: ['$offers', 1] }, { $eq: ['$done', 1] }] }, 1, 0] } } } },
    ]),
    RiderProfile.find({ agency_id: agency }).populate('user_id', 'name').select('user_id status availability vehicle_type').lean(),
    riderCash.balances(agency),
  ]);

  const byRider = new Map(rows.map((r) => [r._id.toString(), r]));
  const riders = profiles.filter((p) => p.user_id).map((p) => {
    const id = p.user_id._id.toString();
    const r = byRider.get(id) || {};
    const answered = (r.accepted || 0) + (r.rejected || 0);
    return {
      rider_id: id,
      name: p.user_id.name,
      status: p.status,
      availability: p.availability,
      vehicle_type: p.vehicle_type,
      offers: r.offers || 0,
      accepted: r.accepted || 0,
      rejected: r.rejected || 0,
      missed: r.expired || 0,
      completed: r.completed || 0,
      acceptance_rate: r.offers ? round((r.accepted || 0) / r.offers, 2) : null,
      answer_rate: r.offers ? round(answered / r.offers, 2) : null,
      avg_response_seconds: round(r.response_ms / 1000),
      avg_delivery_minutes: round(r.delivery_ms / 60000),
      cash_holding: cash[id]?.holding || 0,
    };
  }).sort((a, b) => b.completed - a.completed || b.offers - a.offers);

  const d = dispatch[0] || {};
  return {
    days,
    since,
    dispatch: {
      deliveries_offered: d.deliveries || 0,
      offers: d.offers || 0,
      auto_share: d.offers ? round(d.auto_offers / d.offers, 2) : null,
      offers_per_delivery: d.deliveries ? round(d.offers / d.deliveries, 1) : null,
      first_offer_success: d.completed ? round(d.first_try / d.completed, 2) : null,
    },
    riders,
  };
};

module.exports = { agencyReport };
