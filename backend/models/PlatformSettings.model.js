const mongoose = require('mongoose');

/**
 * models/PlatformSettings.model.js
 * Aura Market — Global Platform Configurations
 */
const PlatformSettingsSchema = new mongoose.Schema(
  {
    commission_rate: {
      type: Number,
      default: 0,
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
      default: 0,
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
      default: 2, // Flat $2 or equivalent
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
    }
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
