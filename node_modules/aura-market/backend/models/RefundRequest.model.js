const mongoose = require('mongoose');

/**
 * models/RefundRequest.model.js
 * Aura Market — Refund Flow management
 */
const RefundRequestSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    admin_feedback: String, // If admin intervenes
    vendor_feedback: String,
    evidence_urls: [String]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('RefundRequest', RefundRequestSchema);
