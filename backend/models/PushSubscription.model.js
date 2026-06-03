const mongoose = require('mongoose');

const PushSubscriptionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  subscription: {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    }
  },
  device_type: {
    type: String,
    enum: ['mobile', 'desktop', 'tablet'],
    default: 'mobile'
  }
}, { timestamps: true });

// Ensure one subscription per device/endpoint for a user
PushSubscriptionSchema.index({ user_id: 1, 'subscription.endpoint': 1 }, { unique: true });
// Fast lookup when a browser endpoint moves from one signed-in account to another.
PushSubscriptionSchema.index({ 'subscription.endpoint': 1 });

module.exports = mongoose.model('PushSubscription', PushSubscriptionSchema);
