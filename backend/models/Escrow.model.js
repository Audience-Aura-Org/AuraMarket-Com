/**
 * models/Escrow.model.js
 * Aura Market — Escrow Tracking Schema
 *
 * Provides a secure holding pen for transaction funds.
 * Funds sit securely in Escrow until the 'delivered' condition is explicitly met.
 */

const mongoose = require('mongoose');

const EscrowSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true, // One escrow instance per order
    },
    buyer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Escrow amount cannot be negative'],
    },
    status: {
      type: String,
      enum: ['held', 'pending_release', 'released', 'refunded', 'disputed'],
      default: 'held',
    },
    customer_confirmed: {
      type: Boolean,
      default: false,
    },
    vendor_confirmed: {
      type: Boolean,
      default: false,
    },
    release_date: {
      type: Date,
      default: null,
    },
    refund_reason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Escrow', EscrowSchema);
