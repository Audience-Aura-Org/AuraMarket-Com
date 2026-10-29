/**
 * services/riderEarnings.service.js
 * A rider's day, earnings and history, from DeliveryAssignment (every offer and
 * job is kept) plus RiderPayout (what the agency paid them).
 *
 * Days and weeks follow Cameroon time (Africa/Douala, UTC+1).
 */
const mongoose = require('mongoose');
const DeliveryAssignment = require('../models/DeliveryAssignment.model');
const RiderPayout = require('../models/RiderPayout.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const riderCash = require('./riderCash.service');

const TZ_OFFSET_MS = 60 * 60 * 1000; // Africa/Douala, no daylight saving
const startOf = (unit, now = new Date()) => {
  const local = new Date(now.getTime() + TZ_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  if (unit === 'week') local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7)); // Monday
  if (unit === 'month') local.setUTCDate(1);
  return new Date(local.getTime() - TZ_OFFSET_MS);
};
const oid = (v) => new mongoose.Types.ObjectId(String(v));

/** Sum of pay and counts per outcome since a date. */
const tally = async (riderId, agencyId, since) => {
  const rows = await DeliveryAssignment.aggregate([
    { $match: { rider_id: oid(riderId), agency_id: oid(agencyId), completed_at: since ? { $gte: since } : { $ne: null } } },
    { $group: { _id: '$outcome', n: { $sum: 1 }, pay: { $sum: { $ifNull: ['$rider_pay', 0] } } } },
  ]);
  const by = Object.fromEntries(rows.map((r) => [r._id, r]));
  return {
    delivered: by.delivered?.n || 0,
    failed: by.failed?.n || 0,
    earned: rows.reduce((s, r) => s + r.pay, 0),
  };
};

const summary = async (riderId, agencyId) => {
  const now = new Date();
  const [agency, today, week, month, all, paid, missed, cash] = await Promise.all([
    LogisticsCompany.findById(agencyId).select('rider_pay').lean(),
    tally(riderId, agencyId, startOf('day', now)),
    tally(riderId, agencyId, startOf('week', now)),
    tally(riderId, agencyId, startOf('month', now)),
    tally(riderId, agencyId, null),
    RiderPayout.aggregate([{ $match: { rider_id: oid(riderId), agency_id: oid(agencyId) } }, { $group: { _id: null, total: { $sum: '$amount' }, last: { $max: '$createdAt' } } }]),
    DeliveryAssignment.countDocuments({ rider_id: riderId, agency_id: agencyId, status: 'expired', offered_at: { $gte: startOf('day', now) } }),
    riderCash.balanceFor(agencyId, riderId),
  ]);
  const paidTotal = paid[0]?.total || 0;
  return {
    pay_rule: agency?.rider_pay?.mode ? agency.rider_pay : null,
    today: { delivered: today.delivered, failed: today.failed, missed_offers: missed, earned: today.earned },
    week: { delivered: week.delivered, earned: week.earned },
    month: { delivered: month.delivered, earned: month.earned },
    earnings: { earned: all.earned, paid: paidTotal, owed: Math.max(0, all.earned - paidTotal), last_paid_at: paid[0]?.last || null },
    cash_holding: cash.holding,
  };
};

/** Owed to each rider of an agency: { [riderUserId]: { earned, paid, owed } }. */
const owedByRider = async (agencyId) => {
  const [earned, paid] = await Promise.all([
    DeliveryAssignment.aggregate([{ $match: { agency_id: oid(agencyId), rider_pay: { $gt: 0 } } }, { $group: { _id: '$rider_id', total: { $sum: '$rider_pay' } } }]),
    RiderPayout.aggregate([{ $match: { agency_id: oid(agencyId) } }, { $group: { _id: '$rider_id', total: { $sum: '$amount' } } }]),
  ]);
  const paidBy = new Map(paid.map((r) => [r._id.toString(), r.total]));
  const out = {};
  for (const r of earned) {
    const p = paidBy.get(r._id.toString()) || 0;
    out[r._id.toString()] = { earned: r.total, paid: p, owed: Math.max(0, r.total - p) };
  }
  return out;
};

/**
 * Finished jobs, newest first, by cursor. Filters: outcome (delivered | failed |
 * cancelled), from / to dates (YYYY-MM-DD, Cameroon days).
 */
const history = async (riderId, { before = null, outcome = null, from = null, to = null, limit = 20 } = {}) => {
  const q = { rider_id: oid(riderId), completed_at: { $ne: null } };
  if (['delivered', 'failed', 'cancelled'].includes(outcome)) q.outcome = outcome;
  const range = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(from || ''))) range.$gte = new Date(new Date(`${from}T00:00:00Z`).getTime() - TZ_OFFSET_MS);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(to || ''))) range.$lt = new Date(new Date(`${to}T00:00:00Z`).getTime() - TZ_OFFSET_MS + 864e5);
  if (Object.keys(range).length) q.completed_at = { ...q.completed_at, ...range };
  if (before && mongoose.isValidObjectId(before)) {
    const anchor = await DeliveryAssignment.findOne({ _id: before, rider_id: riderId }).select('completed_at').lean();
    if (anchor) q.$or = [{ completed_at: { $lt: anchor.completed_at } }, { completed_at: anchor.completed_at, _id: { $lt: anchor._id } }];
  }
  const rows = await DeliveryAssignment.find(q)
    .populate('shipment_id', 'tracking_code pickup_address.quartier pickup_address.city delivery_address.quartier delivery_address.city agency_package.collected_amount')
    .sort({ completed_at: -1, _id: -1 }).limit(Math.min(50, limit) + 1).lean();
  const has_more = rows.length > limit;
  return {
    has_more,
    items: rows.slice(0, limit).map((a) => ({
      id: a._id,
      outcome: a.outcome || (a.status === 'completed' ? 'delivered' : 'cancelled'),
      completed_at: a.completed_at,
      tracking_code: a.shipment_id?.tracking_code || null,
      from: a.shipment_id?.pickup_address?.quartier || null,
      to: a.shipment_id?.delivery_address?.quartier || null,
      delivery_fee: a.delivery_fee,
      earned: a.rider_pay,
      cash_collected: a.shipment_id?.agency_package?.collected_amount || 0,
    })),
  };
};

module.exports = { summary, history, owedByRider, startOf };
