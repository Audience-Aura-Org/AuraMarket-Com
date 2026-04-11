const mongoose = require('mongoose');

/**
 * models/PlatformSettings.model.js
 * Aura Market — Global Platform Configurations
 */
const PlatformSettingsSchema = new mongoose.Schema(
  {
    commission_rate: {
      type: Number,
      default: 5, // 5% by default
      min: 0,
      max: 100
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
PlatformSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('PlatformSettings', PlatformSettingsSchema);
