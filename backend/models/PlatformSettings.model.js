const mongoose = require('mongoose');

/**
 * models/PlatformSettings.model.js
 * Auradime — Global Platform Configurations
 */
const PlatformSettingsSchema = new mongoose.Schema(
  {
    commission_rate: {
      type: Number,
      default: 5,
      min: 0,
      max: 100
    },
    commission_type: {
      type: String,
      enum: ['percentage', 'amount'],
      default: 'percentage'
    },
    commission_value: {
      type: Number,
      default: 5,
      min: 0
    },
    escrow_fee_type: {
      type: String,
      enum: ['percentage', 'amount'],
      default: 'percentage'
    },
    escrow_fee_value: {
      type: Number,
      default: 0,
      min: 0
    },
    withdrawal_fee: {
      type: Number,
      default: 500,
      min: 0
    },
    min_withdrawal_amount: {
      type: Number,
      default: 10,
      min: 0
    },
    platform_wallet_balance: {
      type: Number,
      default: 0
    },
    subscription_required_roles: {
      customer: { type: Boolean, default: false },
      vendor: { type: Boolean, default: true },
      logistics: { type: Boolean, default: true },
      admin: { type: Boolean, default: false }
    },
    subscription_grace_days: {
      customer: { type: Number, default: 0, min: 0, max: 365 },
      vendor: { type: Number, default: 7, min: 0, max: 365 },
      logistics: { type: Number, default: 3, min: 0, max: 365 },
      admin: { type: Number, default: 0, min: 0, max: 365 }
    },

    // ── Phase 3 — Restaurant-specific settings ──────────────────────────────

    // Kitchen acceptance window: minutes the restaurant has to accept before auto-cancel.
    food_acceptance_timeout_minutes: {
      type: Number,
      default: 10,
      min: 1,
      max: 60,
    },

    // New-restaurant hold: number of successfully delivered food orders before
    // a restaurant graduates to instant settlement.
    new_restaurant_hold_order_count: {
      type: Number,
      default: 5,
      min: 0,
    },

    // Restaurant withdrawal gate
    restaurant_min_withdrawal_orders: {
      type: Number,
      default: 5,
      min: 0,
    },
    restaurant_min_withdrawal_age_days: {
      type: Number,
      default: 7,
      min: 0,
    },

    // Cancellation-rate monitor
    // Float 0–1 representing the max acceptable cancel+refund rate.
    // Vendors above this threshold are automatically flipped to held settlement.
    restaurant_cancel_rate_threshold: {
      type: Number,
      default: 0.25,
      min: 0,
      max: 1,
    },
    // Rolling window in days for the cancel-rate computation.
    restaurant_cancel_rate_window_days: {
      type: Number,
      default: 30,
      min: 1,
    },
  },
  {
    timestamps: true
  }
);

// We only ever want one document in this collection
PlatformSettingsSchema.statics.getSettings = async function (session = null) {
  let query = this.findOne();
  if (session) query = query.session(session);

  let settings = await query;
  if (!settings) {
    const created = session ? await this.create([{}], { session }) : await this.create([{}]);
    settings = Array.isArray(created) ? created[0] : created;
  }
  return settings;
};

module.exports = mongoose.model('PlatformSettings', PlatformSettingsSchema);
