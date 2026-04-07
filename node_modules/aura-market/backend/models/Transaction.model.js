/**
 * models/Transaction.model.js
 * Aura Market — Transaction Schema for Wallet System
 *
 * Tracks all financial movements within the platform affecting user wallets.
 * Types: deposit, withdrawal, payment (order), refund, escrow_release
 */

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Transaction must belong to a User'],
      index: true,
    },
    type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'payment', 'refund', 'escrow_release', 'payout'],
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      validate: {
        validator: function (v) {
          // Amount should not be 0; typically withdrawals/payments are saved as positive amounts
          // The math logic decides to add or subtract based on the `type` or action.
          return v > 0;
        },
        message: 'Transaction amount must be greater than 0',
      },
    },
    reference: {
      type: String,
      unique: true,
      required: true, // e.g., TX-123456789 or external payment gateway ref
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'rejected'],
      default: 'pending',
    },
    description: {
      type: String,
      required: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null, // Only applicable for 'payment', 'refund', 'escrow_release'
    },
    order_ids: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    }], // Support for multiple orders in one payment session
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null, // Flexible additional context
    },
    gateway_response: {
      type: mongoose.Schema.Types.Mixed,
      default: null, // Raw payload from Paystack / Eversend / etc.
    },
    gateway: {
      type: String,
      enum: ['paystack', 'eversend', 'flutterwave', 'wallet', 'manual'],
      default: 'paystack',
    },
    currency: {
      type: String,
      default: null, // ISO currency code, e.g. 'XAF', 'NGN', 'UGX'
    },
    gateway_transaction_id: {
      type: String,
      default: null, // External transaction ID from the payment provider
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Transaction', TransactionSchema);
