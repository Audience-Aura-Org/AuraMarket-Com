const mongoose = require('mongoose');

/**
 * models/Notification.model.js
 * Represents a platform alert sent to a user.
 */
const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['order_status', 'order_update', 'payment_received', 'wallet_update', 'chat_alert', 'message', 'system_alert', 'vendor_update', 'promo'],
      default: 'system_alert'
    },
    metadata: {
      target_id: mongoose.Schema.Types.ObjectId, // e.g. Order ID, Product ID
      link: String // Link to the specific page in the frontend
    },
    is_read: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Notification', NotificationSchema);
