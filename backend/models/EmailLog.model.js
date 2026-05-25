const mongoose = require('mongoose');

/**
 * EmailLog.model.js
 * Auradime — Diagnostic Email Tracking
 * 
 * Stores all outgoing SMTP transmissions for administrative audit and debugging.
 */

const EmailLogSchema = new mongoose.Schema({
  recipient_email: {
    type: String,
    required: true,
    index: true
  },
  recipient_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  subject: {
    type: String,
    required: true
  },
  message_preview: {
    type: String // Truncated plain text version
  },
  role: {
    type: String,
    enum: ['user', 'customer', 'vendor', 'logistics', 'admin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['sent', 'failed'],
    default: 'sent'
  },
  error: {
    type: String
  },
  message_id: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('EmailLog', EmailLogSchema);
