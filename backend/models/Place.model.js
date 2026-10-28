/**
 * models/Place.model.js
 * Verified landmarks and named spots customers search for ("Carrefour Bonamoussadi",
 * "Marché Mokolo"). Each place belongs to a priced delivery zone (quartier), so
 * picking a place never changes district pricing. Only approved places are searchable.
 */
const mongoose = require('mongoose');

const PlaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    aliases: { type: [String], default: [] },
    kind: { type: String, enum: ['landmark', 'market', 'junction', 'school', 'hospital', 'church', 'mosque', 'hotel', 'station', 'office', 'other'], default: 'landmark' },
    zone_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticZone', required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    source: { type: String, enum: ['osm', 'manual'], default: 'manual' },
    source_ref: { type: String, default: null },
    approved: { type: Boolean, default: false },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

PlaceSchema.index({ location: '2dsphere' });
PlaceSchema.index({ approved: 1, name: 1 });
PlaceSchema.index({ zone_id: 1, approved: 1 });

module.exports = mongoose.model('Place', PlaceSchema);
