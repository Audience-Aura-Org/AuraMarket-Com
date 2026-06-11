const mongoose = require('mongoose');

const UserSubscriptionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['customer', 'vendor', 'logistics', 'admin'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'grace', 'limited', 'active', 'cancelled', 'refunded', 'expired'],
      default: 'pending',
      index: true,
    },
    billing_cycle: {
      type: String,
      enum: ['one_time', 'monthly', 'yearly'],
      default: 'one_time',
    },
    amount_paid: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'XAF',
      uppercase: true,
    },
    started_at: {
      type: Date,
      default: null,
    },
    expires_at: {
      type: Date,
      default: null,
    },
    grace_started_at: {
      type: Date,
      default: null,
    },
    grace_expires_at: {
      type: Date,
      default: null,
      index: true,
    },
    limited_since: {
      type: Date,
      default: null,
    },
    restriction_reason: {
      type: String,
      default: null,
      trim: true,
    },
    payment_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    payment_reference: {
      type: String,
      default: null,
      index: true,
    },
    source: {
      type: String,
      enum: ['wallet', 'eversend', 'manual', 'admin'],
      default: 'manual',
    },
    activated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    history: [{
      action: String,
      note: String,
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      at: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

UserSubscriptionSchema.index({ user_id: 1, role: 1, status: 1 });
UserSubscriptionSchema.index({ status: 1, expires_at: 1 });

module.exports = mongoose.model('UserSubscription', UserSubscriptionSchema);
