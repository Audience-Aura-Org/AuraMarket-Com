/**
 * models/AgencySettlement.model.js
 * Cash a delivery agency holds on the platform's behalf, and its remittances.
 *
 * Pay-on-delivery: the rider collects the full order total in cash, while the
 * platform credits the vendor from its own funds at delivery. A `collection`
 * entry records that the agency now owes the platform `amount_due`; a
 * `remittance` entry records the agency paying it back. Outstanding balance per
 * agency = sum(collection.amount_due) − sum(remittance.amount_due).
 */
const mongoose = require('mongoose');

const AgencySettlementSchema = new mongoose.Schema(
  {
    agency_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticsCompany', required: true },
    kind: { type: String, enum: ['collection', 'remittance'], required: true },
    // Collections: the delivery the cash was taken for.
    shipment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', default: null },
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    // Rider who physically collected the cash (set once rider accounts exist).
    rider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Cash taken from the customer (order total, including the delivery fee).
    amount_collected: { type: Number, default: 0, min: 0 },
    // What the agency owes the platform (collection) or paid back (remittance).
    amount_due: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'XAF' },
    status: { type: String, enum: ['outstanding', 'settled'], default: 'outstanding' },
    reference: { type: String, required: true, unique: true },
    note: { type: String, default: '' },
    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

AgencySettlementSchema.index({ agency_id: 1, kind: 1, status: 1, createdAt: -1 });
// One cash collection per order, however many times delivery is re-confirmed.
AgencySettlementSchema.index(
  { order_id: 1, kind: 1 },
  { unique: true, partialFilterExpression: { kind: 'collection', order_id: { $type: 'objectId' } } }
);

module.exports = mongoose.model('AgencySettlement', AgencySettlementSchema);
