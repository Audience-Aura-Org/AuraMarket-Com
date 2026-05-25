const mongoose = require('mongoose');

/**
 * models/Currency.model.js
 * Auradime — Currency Exchange Rates
 */
const CurrencySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },
    symbol: {
      type: String,
      required: true
    },
    rate_to_base: {
      type: Number,
      required: true // e.g. 1 USD = 600 XAF, so rate_to_base = 600
    },
    is_base: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Currency', CurrencySchema);
