/**
 * services/foodAcceptanceTimeout.service.js
 * Auradime — Food Order Acceptance Timeout Worker
 *
 * Phase 3 Step 7: If a restaurant does not accept a food order within
 * `acceptance_deadline`, this worker auto-cancels the order and refunds
 * the buyer if payment was already captured.
 *
 * Run interval: every 2 minutes (food orders are time-sensitive).
 * Batch size: 20 per tick to avoid long-running transactions.
 */

const mongoose = require('mongoose');
const Order = require('../models/Order.model');
const Vendor = require('../models/Vendor.model');
const { sendNotification } = require('../utils/notifier');
const { clawbackFoodRefund } = require('./payment/settle.service');
const { withLock } = require('../utils/locks');

const RUN_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const LOCK_TTL_SECONDS = Math.ceil(RUN_INTERVAL_MS / 1000) + 30;
const BATCH_SIZE = 20;

let timer = null;

const processTimedOutOrder = async (order, app) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Re-fetch within transaction to avoid race with concurrent accepts
    const locked = await Order.findOne({
      _id: order._id,
      food_status: 'pending_acceptance',
      acceptance_deadline: { $lte: new Date() },
    }).session(session);

    if (!locked) {
      // Already accepted or cancelled by another process
      await session.abortTransaction();
      return false;
    }

    const now = new Date();

    locked.food_status   = 'timed_out';
    locked.order_status  = 'cancelled';
    locked.status_logs   = locked.status_logs || [];
    locked.status_logs.push({
      status:    'timed_out',
      actor_id:  null,
      timestamp: now,
      note:      'Order auto-cancelled: restaurant did not accept within the required window.',
    });

    // If the buyer already paid (wallet or captured gateway), clawback from vendor wallet.
    // IMPORTANT: do NOT catch errors here — a clawback failure must abort the entire
    // transaction so the order stays in 'pending_acceptance' and the worker retries next tick.
    // Swallowing the error would commit a cancel without a refund (silent buyer fund loss).
    if (locked.payment_status === 'paid') {
      await clawbackFoodRefund(locked, locked.total_amount, session, 'Acceptance timeout — automatic refund');
      locked.payment_status = 'refunded';
      locked.order_status   = 'refunded';
    }

    await locked.save({ session });
    await session.commitTransaction();

    // Background notifications (non-blocking)
    setImmediate(async () => {
      try {
        // Notify buyer
        await sendNotification(app, locked.customer_id, {
          title:   'Order Cancelled — No Response',
          message: 'Your food order was cancelled because the restaurant did not respond in time. Any payment has been refunded.',
          type:    'order_status',
          metadata: { target_id: locked._id, link: `/orders/${locked._id}` },
        });

        // Notify restaurant vendor
        const vendor = await Vendor.findById(locked.vendor_id).select('user_id').lean();
        if (vendor) {
          await sendNotification(app, vendor.user_id, {
            title:   'Order Missed — Auto Cancelled',
            message: `Order #${locked._id.toString().slice(-6).toUpperCase()} was cancelled because it was not accepted in time. The buyer has been refunded.`,
            type:    'order_status',
            metadata: { target_id: locked._id, link: `/vendor/orders/${locked._id}` },
          });
        }
      } catch (notifyErr) {
        console.error('[foodAcceptanceTimeout] notification failed:', notifyErr.message);
      }
    });

    return true;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('[foodAcceptanceTimeout] failed to process order', order._id, ':', error.message);
    return false;
  } finally {
    session.endSession();
  }
};

const processFoodAcceptanceTimeouts = async (app) => {
  const result = await withLock('worker:food-timeout', LOCK_TTL_SECONDS, async () => {
    let processed = 0;
    const now = new Date();
    const candidates = await Order.find({
      food_status:        'pending_acceptance',
      acceptance_deadline: { $lte: now },
    })
      .select('_id customer_id vendor_id food_status order_status payment_status total_amount shipping_fee status_logs acceptance_deadline escrow_enabled')
      .sort('acceptance_deadline')
      .limit(BATCH_SIZE)
      .lean();

    for (const order of candidates) {
      const cancelled = await processTimedOutOrder(order, app);
      if (cancelled) processed += 1;
    }
    return { processed, skipped: false };
  }).catch((error) => {
    console.error('[foodAcceptanceTimeout] scan failed:', error.message);
    return { processed: 0, skipped: false };
  });

  return result ?? { processed: 0, skipped: true };
};

const startFoodAcceptanceTimeoutWorker = (app) => {
  if (timer) return;

  // First run after 60 s so the server is fully initialised before hitting the DB
  setTimeout(() => {
    processFoodAcceptanceTimeouts(app).catch((err) => {
      console.error('[foodAcceptanceTimeout] initial run failed:', err.message);
    });
  }, 60 * 1000);

  timer = setInterval(() => {
    processFoodAcceptanceTimeouts(app).catch((err) => {
      console.error('[foodAcceptanceTimeout] interval failed:', err.message);
    });
  }, RUN_INTERVAL_MS);

  if (timer.unref) timer.unref();
};

const stopFoodAcceptanceTimeoutWorker = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};

module.exports = { processFoodAcceptanceTimeouts, startFoodAcceptanceTimeoutWorker, stopFoodAcceptanceTimeoutWorker };
