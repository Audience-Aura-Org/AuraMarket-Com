const mongoose = require('mongoose');

/**
 * models/StockWatch.model.js
 * Auradime — Restock Alerts
 */
const StockWatchSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    }
  },
  {
    timestamps: true
  }
);

StockWatchSchema.index({ user_id: 1, product_id: 1 }, { unique: true });

module.exports = mongoose.model('StockWatch', StockWatchSchema);
