/**
 * services/intercityArrivalLapse.service.js
 * Auradime — Phase 4 Step 8: expected_arrival_at Lapse Ping
 *
 * When an intercity parcel has been dispatched (`transit_status: 'dispatched'`) but
 * the estimated arrival window has passed, both the buyer and the vendor should be
 * notified so they can follow up with the intercity agency.
 *
 * This job does NOT cancel or refund anything — it is a reminder only.
 *
 * Conditions for a lapse ping:
 *   - shipping_method    === 'intercity_agency'
 *   - transit_status     === 'dispatched'
 *   - expected_arrival_at < now
 *   - payment_status     === 'paid'
 *   - order_status NOT IN ['cancelled', 'refunded', 'completed', 'delivered']
 *
 * To avoid spamming, each order is pinged at most once per 24 hours.
 * A `transit_lapse_pinged_at` field on Order tracks the last ping.
 *
 * Registered in server.js — first run 5 min after boot, then every 2 hours.
 */

const mongoose = require('mongoose');
const Order   = require('../models/Order.model');
const Vendor  = require('../models/Vendor.model');
const User    = require('../models/User.model');
const { sendNotification } = require('../utils/notifier');

const PING_COOLDOWN_HOURS = 24;

async function runIntercityArrivalLapseCheck(app) {
  if (mongoose.connection.readyState !== 1) return;

  const now = new Date();
  const cooldownCutoff = new Date(now.getTime() - PING_COOLDOWN_HOURS * 3600 * 1000);

  // Find dispatched intercity orders whose expected arrival has passed and haven't been pinged recently
  const lapsed = await Order.find({
    shipping_method:      'intercity_agency',
    transit_status:       'dispatched',
    payment_status:       'paid',
    expected_arrival_at:  { $lt: now, $ne: null },
    order_status:         { $nin: ['cancelled', 'refunded', 'completed', 'delivered'] },
    $or: [
      { transit_lapse_pinged_at: { $lt: cooldownCutoff } },
      { transit_lapse_pinged_at: null },
    ],
  }).lean();

  if (!lapsed.length) return;

  console.log(`[intercityArrivalLapse] ${lapsed.length} order(s) overdue — sending lapse pings.`);

  for (const orderDoc of lapsed) {
    try {
      const [vendorRecord, buyerUser] = await Promise.all([
        Vendor.findById(orderDoc.vendor_id).lean(),
        User.findById(orderDoc.customer_id).lean(),
      ]);

      const vendorUser = vendorRecord
        ? await User.findById(vendorRecord.user_id).lean()
        : null;

      const orderLabel = `Order #${orderDoc._id.toString().slice(-6).toUpperCase()}`;
      const carrier    = orderDoc.transit_carrier || 'the intercity agency';

      if (app) {
        const notifications = [];

        if (buyerUser) {
          notifications.push(
            sendNotification(app, buyerUser._id, {
              title:    'Parcel Delivery Overdue',
              message:  `${orderLabel} was expected to arrive by ${new Date(orderDoc.expected_arrival_at).toLocaleDateString()} but has not been collected yet. Please follow up with ${carrier} or contact support.`,
              type:     'order_status',
              metadata: { order_id: orderDoc._id, link: '/orders' },
            })
          );
        }

        if (vendorUser) {
          notifications.push(
            sendNotification(app, vendorUser._id, {
              title:    'Intercity Parcel Overdue',
              message:  `${orderLabel} was expected to arrive by ${new Date(orderDoc.expected_arrival_at).toLocaleDateString()}. Please contact ${carrier} and update the platform if the parcel has been delivered or is lost.`,
              type:     'order_status',
              metadata: { order_id: orderDoc._id, link: '/vendor/orders' },
            })
          );
        }

        await Promise.all(notifications);
      }

      // Stamp the order so we don't re-ping within PING_COOLDOWN_HOURS
      await Order.updateOne(
        { _id: orderDoc._id },
        { $set: { transit_lapse_pinged_at: now } }
      );

      console.log(`[intercityArrivalLapse] Pinged ${orderLabel}.`);
    } catch (err) {
      console.error(`[intercityArrivalLapse] Failed to ping order ${orderDoc._id}:`, err.message);
    }
  }
}

/**
 * Register the arrival lapse ping worker.
 * First run: 5 minutes after boot.
 * Subsequent runs: every 2 hours.
 *
 * @param {import('express').Application} app
 */
function startIntercityArrivalLapseWorker(app) {
  const FIRST_RUN_MS = 5 * 60 * 1000;    // 5 min
  const INTERVAL_MS  = 2 * 60 * 60 * 1000; // 2 h

  setTimeout(() => {
    runIntercityArrivalLapseCheck(app);
    const t = setInterval(() => runIntercityArrivalLapseCheck(app), INTERVAL_MS);
    if (t.unref) t.unref();
  }, FIRST_RUN_MS);

  console.log('[intercityArrivalLapse] Worker scheduled — first run in 5 min, then every 2 h.');
}

module.exports = { startIntercityArrivalLapseWorker, runIntercityArrivalLapseCheck };
