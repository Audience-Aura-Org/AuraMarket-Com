const PushSubscription = require('../models/PushSubscription.model');

/**
 * @route   POST /api/push/subscribe
 * @desc    Save a user's PWA push subscription
 * @access  Private
 */
const subscribe = async (req, res, next) => {
  try {
    const { subscription, device_type } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Invalid subscription data.' });
    }

    // Use findOneAndUpdate to prevent duplicates per user/device
    await PushSubscription.findOneAndUpdate(
      { user_id: req.user._id, 'subscription.endpoint': subscription.endpoint },
      { 
        user_id: req.user._id, 
        subscription, 
        device_type: device_type || 'mobile' 
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    res.status(200).json({ success: true, message: 'Subscription stabilized in the Matrix.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/push/unsubscribe
 * @desc    Remove a specific subscription by endpoint
 * @access  Private
 */
const unsubscribe = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.findOneAndDelete({ user_id: req.user._id, 'subscription.endpoint': endpoint });
    res.status(200).json({ success: true, message: 'Connection severed.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/push/purge-all
 * @desc    Wipe ALL push subscriptions for the user — forces clean re-registration
 *          Use when VAPID keys have rotated or subscriptions are permanently stale
 * @access  Private
 */
const purgeAll = async (req, res, next) => {
  try {
    const result = await PushSubscription.deleteMany({ user_id: req.user._id });
    console.log(`🗑️  Purged ${result.deletedCount} stale push subscriptions for user ${req.user._id}`);
    res.status(200).json({ 
      success: true, 
      message: `Purged ${result.deletedCount} stale subscriptions. Re-open the app to re-register.` 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  purgeAll
};
