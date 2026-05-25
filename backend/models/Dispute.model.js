const mongoose = require('mongoose');

/**
 * models/Dispute.model.js
 * Auradime — Dispute Resolution System
 * 
 * Formal flow for buyers or vendors to contest an order held in escrow.
 */
const DisputeSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    initiator_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'item_not_received',
        'item_not_as_described',
        'faulty_item',
        'unauthorized_transaction',
        'other'
      ]
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },
    evidence_urls: [String],
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'cancelled'],
      default: 'pending'
    },
    resolution_type: {
      type: String,
      enum: ['full_refund', 'release_payment', 'partial_refund', 'return_and_refund'],
      default: null
    },
    admin_notes: String,
    resolved_at: Date,
    resolved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Dispute', DisputeSchema);
