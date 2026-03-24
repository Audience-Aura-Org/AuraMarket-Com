const mongoose = require('mongoose');

/**
 * models/Legal.model.js
 * Stores Terms of Service, Privacy Policy, and Cookie Consent content.
 */
const LegalSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      unique: true,
      enum: ['terms_of_service', 'privacy_policy', 'cookie_policy', 'vendor_agreement']
    },
    version: {
      type: String,
      required: true
    },
    content: {
      type: String, // Likely HTML or Markdown
      required: true
    },
    last_updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    is_active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Legal', LegalSchema);
