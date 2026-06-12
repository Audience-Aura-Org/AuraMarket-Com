const mongoose = require('mongoose');

const PushSubscriptionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  channel: {
    type: String,
    enum: ['web', 'android'],
    default: 'web',
  },
  subscription: {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  },
  fcm_token: {
    type: String,
    trim: true,
  },
  device_type: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet', 'android'],
    default: 'mobile'
  }
}, { timestamps: true });

// Ensure one subscription per device/endpoint for a user
PushSubscriptionSchema.index({ user_id: 1, 'subscription.endpoint': 1 }, { unique: true });
PushSubscriptionSchema.index({ user_id: 1, fcm_token: 1 }, { unique: true, sparse: true });
// Fast lookup when a browser endpoint moves from one signed-in account to another.
PushSubscriptionSchema.index({ 'subscription.endpoint': 1 });
PushSubscriptionSchema.index({ fcm_token: 1 }, { sparse: true });

module.exports = mongoose.model('PushSubscription', PushSubscriptionSchema);
