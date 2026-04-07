const mongoose = require('mongoose');

/**
 * models/KYC.model.js
 * Aura Market — Vendor Identity Verification Data
 */
const KYCSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    full_name: {
      type: String,
      required: true
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor'
    },
    document_type: {
      type: String,
      enum: ['national_id', 'passport', 'drivers_license', 'utility_bill'],
      required: true
    },
    document_number: {
      type: String,
      required: true
    },
    document_front_url: {
      type: String, // URL to uploaded image
      required: true
    },
    document_back_url: {
      type: String // Optional based on document type
    },
    selfie_url: {
      type: String, // Selfie holding the ID
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    admin_feedback: String,
    reviewed_at: Date,
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('KYC', KYCSchema);
