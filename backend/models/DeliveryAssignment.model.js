/**
 * models/DeliveryAssignment.model.js
 * Every time a delivery is offered to a rider: offered → accepted / rejected /
 * expired, then completed (or cancelled). The full history stays for audits and
 * rider performance; `active` marks the one live offer/assignment per shipment.
 *
 * The unique partial index on { shipment_id } where active = true makes it
 * impossible for two riders to hold the same delivery, even under concurrent
 * offers or accepts.
 */
const mongoose = require('mongoose');

const DeliveryAssignmentSchema = new mongoose.Schema(
  {
    shipment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment', required: true },
    // The agency the delivery belonged to at the time (kept even if the rider later moves agencies).
    agency_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticsCompany', required: true },
    rider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['offered', 'accepted', 'rejected', 'expired', 'cancelled', 'completed'], default: 'offered' },
    active: { type: Boolean, default: true },
    mode: { type: String, enum: ['manual', 'auto'], required: true },
    offered_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = dispatch engine
    offered_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },
    responded_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    reject_reason: { type: String, default: null, maxlength: 200 },
    // Why the engine chose this rider (transparent, for review).
    reason: { type: String, default: null },
  },
  { timestamps: true }
);

DeliveryAssignmentSchema.index({ shipment_id: 1 }, { unique: true, partialFilterExpression: { active: true }, name: 'one_active_per_shipment' });
DeliveryAssignmentSchema.index({ rider_id: 1, status: 1, createdAt: -1 });
DeliveryAssignmentSchema.index({ status: 1, expires_at: 1 });
DeliveryAssignmentSchema.index({ agency_id: 1, createdAt: -1 });

module.exports = mongoose.model('DeliveryAssignment', DeliveryAssignmentSchema);
