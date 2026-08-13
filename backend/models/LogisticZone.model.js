/**
 * models/LogisticZone.model.js
 * Auradime — Geographic Zone Schema
 *
 * Three-level hierarchy: city (level 1) → district (level 2) → quartier (level 3)
 *
 * 'region' is retained in the type enum only for backward-compatibility during the
 * Phase 1 migration. After all district documents have been updated to type='district'
 * and verified, remove 'region' from the enum in Phase 2 cleanup.
 *
 * New fields (Phase 1):
 *   code       — stable unique short code: 'YDE', 'YDE-06', 'DLA-05-012'
 *   ancestors  — ObjectId array of all parent zones; enables one-query subtree lookups
 *   level      — denormalised depth: 1=city · 2=district · 3=quartier
 *   centroid   — GeoJSON Point; used to centre the map picker (Phase 3)
 *                (2dsphere index deferred to Phase 2 when boundary polygons land)
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
      default: null,
    },
    type: {
      type: String,
      // 'region' kept during migration — delete after Phase 1 verification
      enum: ['city', 'district', 'region', 'quartier'],
      required: true,
    },
    code: {
      type: String,
      default: undefined, // not present until migration sets it; sparse index below
    },
    ancestors: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LogisticZone' }],
      default: [],
    },
    level: {
      type: Number,
      default: null, // 1 = city · 2 = district · 3 = quartier
    },
    centroid: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
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

LogisticZoneSchema.index({ name: 1 });
LogisticZoneSchema.index({ code: 1 }, { unique: true, sparse: true });
LogisticZoneSchema.index({ ancestors: 1, type: 1 });
LogisticZoneSchema.index({ parent_id: 1, is_active: 1 });

module.exports = mongoose.model('LogisticZone', LogisticZoneSchema);
