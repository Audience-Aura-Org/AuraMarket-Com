const PushSubscription = require('../models/PushSubscription.model');
const { VAPID_PUBLIC_KEY } = require('../config/env');

const DEFAULT_VAPID_PUBLIC_KEY = 'BPhRBNH4-gNAvZGDAELIrh-CS6_U4pAxfnVbLGnqjBBkekohWswpHk1leAH6It2wvc66fEo4IBunBrB-I6P5LPQ';
const RESAVE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * @route   GET /api/push/vapid-public-key
 * @desc    Return the active backend VAPID public key used for Web Push
 * @access  Public
 */
const getVapidPublicKey = async (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      publicKey: VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY,
    },
  });
};

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

    const endpoint = subscription.endpoint;

    // A browser/device push endpoint belongs to exactly one active account.
    // If the same browser logs into a new account, remove stale ownership first
    // so notifications from old signed-out accounts cannot continue arriving.
    await PushSubscription.deleteMany({
      'subscription.endpoint': endpoint,
      user_id: { $ne: req.user._id },
    });

    const existing = await PushSubscription.findOne(
      { user_id: req.user._id, 'subscription.endpoint': endpoint }
    ).select('_id updatedAt device_type');

    const shouldRefresh = !existing ||
      existing.device_type !== (device_type || 'mobile') ||
      (existing.updatedAt && Date.now() - new Date(existing.updatedAt).getTime() > RESAVE_INTERVAL_MS);

    if (!shouldRefresh) {
      return res.status(200).json({
        success: true,
        message: 'Subscription already current.',
        data: { unchanged: true },
      });
    }

    await PushSubscription.findOneAndUpdate(
      { user_id: req.user._id, 'subscription.endpoint': endpoint },
      { 
        user_id: req.user._id, 
        subscription, 
        device_type: device_type || 'mobile' 
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    console.log(`[PWA] Push subscription ${existing ? 'refreshed' : 'saved'} for ${req.user._id} (${device_type || 'mobile'}) endpoint=${endpoint.slice(-24)}`);
    res.status(200).json({ success: true, message: 'Subscription stabilized.' });
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
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  purgeAll
};
