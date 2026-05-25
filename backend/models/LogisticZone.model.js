/**
 * models/LogisticZone.model.js
 * Auradime — Geographic Zone/Quartier Schema
 */

const mongoose = require('mongoose');

const LogisticZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LogisticZone',
      default: null, // If null, this is a top-level Region/State
    },
    type: {
      type: String,
      enum: ['region', 'quartier'],
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups by name
LogisticZoneSchema.index({ name: 1 });

module.exports = mongoose.model('LogisticZone', LogisticZoneSchema);
