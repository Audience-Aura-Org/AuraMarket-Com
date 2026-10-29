/**
 * services/riderCash.service.js
 * How much cash each rider is carrying for their agency.
 *
 * Collected = agency packages paid on delivery (Shipment.agency_package.collected_amount)
 *           + cash-on-delivery orders (AgencySettlement collections, amount_collected).
 * Holding   = collected − handovers recorded by the agency.
 */
const mongoose = require('mongoose');
const Shipment = require('../models/Shipment.model');
const AgencySettlement = require('../models/AgencySettlement.model');
const RiderCashHandover = require('../models/RiderCashHandover.model');

const toMap = (rows) => new Map(rows.map((r) => [r._id.toString(), r]));

/** { [riderUserId]: { collected, handed_over, holding, last_handover_at } } for an agency. */
const balances = async (agencyId, riderIds = null) => {
  const agency = new mongoose.Types.ObjectId(String(agencyId));
  const riders = riderIds ? { $in: riderIds.map((id) => new mongoose.Types.ObjectId(String(id))) } : { $ne: null };
  const [packages, orders, handovers] = await Promise.all([
    Shipment.aggregate([
      { $match: { logistics_id: agency, 'agency_package.collected_by': riders, 'agency_package.collected_amount': { $gt: 0 } } },
      { $group: { _id: '$agency_package.collected_by', total: { $sum: '$agency_package.collected_amount' } } },
    ]),
    AgencySettlement.aggregate([
      { $match: { agency_id: agency, kind: 'collection', rider_id: riders } },
      { $group: { _id: '$rider_id', total: { $sum: '$amount_collected' } } },
    ]),
    RiderCashHandover.aggregate([
      { $match: { agency_id: agency, rider_id: riders } },
      { $group: { _id: '$rider_id', total: { $sum: '$amount' }, last: { $max: '$createdAt' } } },
    ]),
  ]);
  const p = toMap(packages); const o = toMap(orders); const h = toMap(handovers);
  const ids = new Set([...p.keys(), ...o.keys(), ...h.keys()]);
  const out = {};
  for (const id of ids) {
    const collected = (p.get(id)?.total || 0) + (o.get(id)?.total || 0);
    const handed = h.get(id)?.total || 0;
    out[id] = { collected, handed_over: handed, holding: Math.max(0, collected - handed), last_handover_at: h.get(id)?.last || null };
  }
  return out;
};

const balanceFor = async (agencyId, riderUserId) =>
  (await balances(agencyId, [riderUserId]))[String(riderUserId)] || { collected: 0, handed_over: 0, holding: 0, last_handover_at: null };

module.exports = { balances, balanceFor };
