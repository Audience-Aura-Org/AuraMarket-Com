/**
 * models/WhatsAppMessage.model.js
 * One row per WhatsApp message we send, updated by Meta's status webhooks
 * (sent → delivered → read, or failed). Used for delivery audits and cost tracking.
 */
const mongoose = require('mongoose');

const WhatsAppMessageSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    to: { type: String, required: true }, // E.164 without "+", e.g. 237677123456
    template: { type: String, required: true },
    language: { type: String, default: 'en' },
    status: { type: String, enum: ['dry_run', 'accepted', 'sent', 'delivered', 'read', 'failed'], default: 'accepted' },
    wa_message_id: { type: String, default: null },
    error: { type: String, default: null },
    notification_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', default: null },
    status_at: { type: Date, default: Date.now },
    // Meta pricing info from status webhooks (conversation category / billable).
    pricing: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

WhatsAppMessageSchema.index({ wa_message_id: 1 }, { unique: true, sparse: true });
WhatsAppMessageSchema.index({ user_id: 1, createdAt: -1 });
WhatsAppMessageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('WhatsAppMessage', WhatsAppMessageSchema);
