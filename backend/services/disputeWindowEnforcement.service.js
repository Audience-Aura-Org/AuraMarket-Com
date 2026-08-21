/**
 * services/disputeWindowEnforcement.service.js
 * Auradime — Food Dispute Window Enforcement Worker
 *
 * Phase 3 Step 5c: Food orders have a fixed dispute window set at placement
 * (Order.dispute_window_closes_at). After the window closes, buyers can no longer
 * open a dispute for that order.
 *
 * This worker scans food orders where the dispute window has closed and:
 *   1. Marks the order as non-disputable (sets dispute_window_closed = true)
 *   2. Sends a "window closed" notification to the buyer (24h warning + final)
 *
 * NOTE: dispute_window_closes_at is set on the Order model.
 *       The field was planned in Step 5c but is on the Dispute model's
 *       dispute_window_closes_at — this worker reads from Order.dispute_window_closes_at
 *       which we add here if not present, or from the Dispute document directly.
 *
 * Run interval: every 10 minutes (disputes are not millisecond-sensitive).
 */

const Order = require('../models/Order.model');
const Dispute = require('../models/Dispute.model');
const { sendNotification } = require('../utils/notifier');
const { withLock } = require('../utils/locks');

const RUN_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const LOCK_TTL_SECONDS = Math.ceil(RUN_INTERVAL_MS / 1000) + 60;
const BATCH_SIZE = 50;
const WARNING_HOURS_BEFORE = 24; // notify buyer this many hours before window closes

let timer = null;

const processDisputeWindows = async (app) => {
  const result = await withLock('worker:dispute-window', LOCK_TTL_SECONDS, async () => {
  let processed = 0;
  let warned = 0;

  try {
    const now = new Date();
    const warningCutoff = new Date(now.getTime() + WARNING_HOURS_BEFORE * 60 * 60 * 1000);

    // 1. Find food orders whose dispute window has closed and hasn't been marked yet
    const expired = await Order.find({
      food_status:           { $exists: true, $ne: null },
      'dispute_window_closes_at': { $lte: now, $ne: null },
      dispute_window_closed:  { $ne: true },
    })
      .select('_id customer_id dispute_window_closes_at')
      .sort('dispute_window_closes_at')
      .limit(BATCH_SIZE)
      .lean();

    for (const order of expired) {
      // Ensure there's no open dispute before closing — if there is, skip (admin handles it)
      const hasOpenDispute = await Dispute.exists({
        order_id: order._id,
        status:   { $in: ['pending', 'investigating'] },
      });
      if (hasOpenDispute) continue;

      await Order.updateOne(
        { _id: order._id },
        { $set: { dispute_window_closed: true } }
      );
      processed += 1;
    }

    // 2. Find food orders whose dispute window closes within the warning period
    //    and haven't had a warning sent yet
    const toWarn = await Order.find({
      food_status:                { $exists: true, $ne: null },
      'dispute_window_closes_at': { $lte: warningCutoff, $gt: now },
      dispute_window_warning_sent: { $ne: true },
      dispute_window_closed:       { $ne: true },
    })
      .select('_id customer_id dispute_window_closes_at')
      .sort('dispute_window_closes_at')
      .limit(BATCH_SIZE)
      .lean();

    for (const order of toWarn) {
      try {
        await sendNotification(app, order.customer_id, {
          title:   'Dispute Window Closing Soon',
          message: 'Your window to raise a dispute for a recent food order closes in less than 24 hours.',
          type:    'system_alert',
          metadata: { target_id: order._id, link: `/orders/${order._id}` },
        });
        await Order.updateOne(
          { _id: order._id },
          { $set: { dispute_window_warning_sent: true } }
        );
        warned += 1;
      } catch (e) {
        console.error('[disputeWindowEnforcement] warning notification failed:', e.message);
      }
    }
  } catch (error) {
    console.error('[disputeWindowEnforcement] scan failed:', error.message);
  }

  return { processed, warned, skipped: false };
  }).catch((err) => {
    console.error('[disputeWindowEnforcement] lock failed:', err.message);
    return { processed: 0, warned: 0, skipped: false };
  });

  return result ?? { processed: 0, warned: 0, skipped: true };
};

const startDisputeWindowWorker = (app) => {
  if (timer) return;

  setTimeout(() => {
    processDisputeWindows(app).catch((err) => {
      console.error('[disputeWindowEnforcement] initial run failed:', err.message);
    });
  }, 90 * 1000); // 90 s after boot — after escrow and food-timeout workers

  timer = setInterval(() => {
    processDisputeWindows(app).catch((err) => {
      console.error('[disputeWindowEnforcement] interval failed:', err.message);
    });
  }, RUN_INTERVAL_MS);

  if (timer.unref) timer.unref();
};

const stopDisputeWindowWorker = () => {
  if (timer) { clearInterval(timer); timer = null; }
};

module.exports = { processDisputeWindows, startDisputeWindowWorker, stopDisputeWindowWorker };
