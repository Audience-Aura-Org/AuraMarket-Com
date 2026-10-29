/**
 * models/RiderPayout.model.js
 * Money a delivery agency paid a rider for their deliveries (outside Auradime:
 * cash, mobile money…). Owed to a rider = sum(DeliveryAssignment.rider_pay) − sum(amount).
 */
const mongoose = require('mongoose');

const RiderPayoutSchema = new mongoose.Schema(
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

RiderPayoutSchema.index({ agency_id: 1, rider_id: 1, createdAt: -1 });

module.exports = mongoose.model('RiderPayout', RiderPayoutSchema);
