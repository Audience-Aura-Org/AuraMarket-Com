/**
 * models/ShipmentMessage.model.js
 * Auradime — Shipment Tracking Messages
 *
 * Messages between shippers, recipients, and logistics regarding specific shipments
 * Visible to all parties involved in the shipment
 */

const mongoose = require('mongoose');

const ShipmentMessageSchema = new mongoose.Schema(
  {
    shipment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shipment',
      required: true,
      index: true,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null for guest messages
    },
    sender_name: {
      type: String,
      required: true, // Display name of sender
    },
    sender_role: {
      type: String,
      enum: ['shipper', 'recipient', 'logistics', 'admin'],
      default: 'shipper',
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    read_by: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // Use timestamp field instead
  }
);

// Indexes for efficient querying
ShipmentMessageSchema.index({ shipment_id: 1, timestamp: 1 });

module.exports = mongoose.model('ShipmentMessage', ShipmentMessageSchema);
