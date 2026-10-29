/**
 * models/RiderCashHandover.model.js
 * Cash a rider hands over to their delivery agency.
 *
 * Riders collect cash on delivery (agency packages paid on delivery, and
 * cash-on-delivery orders). What a rider still holds =
 *   cash collected on their deliveries − sum(handover.amount).
 * The agency's own debt to the platform is tracked separately in AgencySettlement.
 */
const mongoose = require('mongoose');

const RiderCashHandoverSchema = new mongoose.Schema(
  {
    agency_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticsCompany', required: true },
    rider_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'XAF' },
    note: { type: String, default: '', maxlength: 200 },
    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

RiderCashHandoverSchema.index({ agency_id: 1, rider_id: 1, createdAt: -1 });

module.exports = mongoose.model('RiderCashHandover', RiderCashHandoverSchema);
