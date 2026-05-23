const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription.model');

// Set VAPID keys (should be in .env)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.EMAIL_USER || 'mailto:hello@auradime.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('⚠️ [PushService] VAPID keys missing. Push notifications will be disabled.');
}

/**
 * sendPushNotification
 * Finds all subscriptions for a user and sends a notification.
 */
const sendPushNotification = async (userId, payload) => {
  try {
    const subscriptions = await PushSubscription.find({ user_id: userId });
    
    if (!subscriptions || subscriptions.length === 0) {
      // console.log(`[PushService] No subscriptions found for user ${userId}`);
      return;
    }

    const payloadString = JSON.stringify(payload);

    const notifications = subscriptions.map(sub => {
      return webpush.sendNotification(sub.subscription, payloadString)
        .catch(async (err) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
             // Subscription has expired or is no longer valid
             await PushSubscription.findByIdAndDelete(sub._id);
             console.log(`[PushService] Cleaned up expired subscription for user ${userId}`);
          } else {
             console.error(`[PushService] Error sending to ${sub._id}:`, err.message);
          }
        });
    });

    await Promise.all(notifications);
  } catch (error) {
    console.error(`[PushService] Error in global sendPushNotification:`, error);
  }
};

module.exports = {
  sendPushNotification
};
