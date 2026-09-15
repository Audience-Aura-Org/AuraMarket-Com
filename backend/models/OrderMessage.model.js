/**
 * models/OrderMessage.model.js
 * Auradime — Order Thread Messages
 *
 * Messages between buyers, vendors, and logistics regarding specific orders.
 * Visible to all parties involved in the order.
 */

const mongoose = require('mongoose');

const OrderMessageSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender_name: {
      type: String,
      required: true,
    },
    sender_role: {
      type: String,
      enum: ['buyer', 'vendor', 'logistics', 'admin'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

OrderMessageSchema.index({ order_id: 1, timestamp: 1 });

module.exports = mongoose.model('OrderMessage', OrderMessageSchema);
