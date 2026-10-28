/**
 * models/RiderProfile.model.js
 * A user who delivers for one delivery agency (LogisticsCompany).
 *
 * Riders keep their normal account role (usually customer); rider features are
 * unlocked by an *active* profile, not by the role. One profile per user, so a
 * person rides for one agency at a time; past memberships stay in `history` and
 * every delivery record keeps the agency it was assigned under.
 */
const mongoose = require('mongoose');

const RiderProfileSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    agency_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticsCompany', required: true },
    // invited → active (accepted) → inactive (agency switched off); declined if the invite was refused.
    status: { type: String, enum: ['invited', 'active', 'inactive', 'declined'], default: 'invited' },
    availability: { type: String, enum: ['offline', 'online', 'busy'], default: 'offline' },
    phone: { type: String, default: null },
    vehicle_type: { type: String, enum: ['motorcycle', 'bicycle', 'car', 'van', 'on_foot'], default: 'motorcycle' },
    vehicle_plate: { type: String, default: null, maxlength: 20 },
    invited_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    invited_at: { type: Date, default: Date.now },
    accepted_at: { type: Date, default: null },
    deactivated_at: { type: Date, default: null },
    availability_changed_at: { type: Date, default: null },
    // Last GPS fix, only reported while on an active delivery (phase 5).
    last_location: {
      lat: Number,
      lng: Number,
      accuracy_m: Number,
      at: Date,
    },
    history: [{
      agency_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticsCompany' },
      joined_at: Date,
      left_at: Date,
    }],
  },
  { timestamps: true }
);

RiderProfileSchema.index({ agency_id: 1, status: 1, availability: 1 });

module.exports = mongoose.model('RiderProfile', RiderProfileSchema);
