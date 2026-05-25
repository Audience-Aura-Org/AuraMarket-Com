const mongoose = require('mongoose');

/**
 * models/Report.model.js
 * Auradime — Fraud & Abuse Reporting
 */
const ReportSchema = new mongoose.Schema(
  {
    reporter_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true // Can be UserID, ProductID, etc.
    },
    target_type: {
      type: String,
      enum: ['user', 'vendor', 'product', 'message'],
      required: true
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'scam_fraud',
        'prohibited_item',
        'offensive_content',
        'counterfeit',
        'harassment',
        'other'
      ]
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'action_taken', 'dismissed'],
      default: 'pending'
    },
    admin_notes: String,
    resolved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Report', ReportSchema);
