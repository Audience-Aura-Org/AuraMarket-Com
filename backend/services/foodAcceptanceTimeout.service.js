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

const RUN_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const BATCH_SIZE = 20;

let running = false;
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
    // If payment_status is still 'pending' (e.g. gateway flow not yet completed), no money moved.
    // Full refund including shipping_fee — no rider was dispatched so no service was rendered.
    if (locked.payment_status === 'paid') {
      try {
        await clawbackFoodRefund(locked, locked.total_amount, session, 'Acceptance timeout — automatic refund');
        locked.payment_status = 'refunded';
        locked.order_status   = 'refunded';
      } catch (refundErr) {
        // Vendor record may have been deleted after payment was captured.
        // Still cancel the order so it leaves pending_acceptance and stops retrying.
        // Log the failure so admins can process the refund manually.
        console.error('[foodAcceptanceTimeout] clawback failed for order', locked._id, ':', refundErr.message);
        locked.status_logs.push({
          status:    'refund_failed',
          actor_id:  null,
          timestamp: now,
          note:      `Automatic refund failed — manual action required. Error: ${refundErr.message}`,
        });
        // Notify admins so the refund is not silently lost
        setImmediate(async () => {
          try {
            const { notifyAdmins } = require('../utils/notifier');
            await notifyAdmins(app, {
              title:    'Food Order Refund Failed',
              message:  `Order #${locked._id.toString().slice(-6).toUpperCase()} was auto-cancelled but the refund clawback failed: ${refundErr.message}. Manual refund required.`,
              type:     'system_alert',
              metadata: { target_id: locked._id, link: `/admin/orders/${locked._id}` },
            });
          } catch (_) {}
        });
      }
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
  if (running) return { processed: 0, skipped: true };
  running = true;
  let processed = 0;

  try {
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
  } catch (error) {
    console.error('[foodAcceptanceTimeout] scan failed:', error.message);
  } finally {
    running = false;
  }

  return { processed, skipped: false };
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

module.exports = { processFoodAcceptanceTimeouts, startFoodAcceptanceTimeoutWorker };
