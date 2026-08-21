/**
 * services/delayedRiderDispatch.service.js
 * Auradime — Phase 3 Step 12: Delayed Rider Dispatch
 *
 * When a food order is accepted (food_status → 'preparing'), the controller
 * computes:
 *   dispatch_delay = max(0, prep_time_minutes − avg_delivery_minutes) * 60 * 1000 ms
 *
 * If dispatch_delay > 0, the Shipment is NOT created immediately. Instead,
 * `order.rider_dispatch_at` is stamped with (now + dispatch_delay), and this
 * worker fires the Shipment creation once that time arrives.
 *
 * Goal: rider arrives at the restaurant exactly when the food is ready,
 * minimising hand-off wait time for both parties.
 *
 * Idempotency: Shipment.findOne({ order_id }) guards every create attempt.
 * Race condition: the first writer wins; subsequent workers abort their session.
 *
 * Run interval: every 60 s (food orders are time-sensitive).
 * Batch size:   20 per tick.
 * First run:    90 s after boot (server fully initialised).
 */

const mongoose  = require('mongoose');
const Order     = require('../models/Order.model');
const Shipment  = require('../models/Shipment.model');
const Vendor    = require('../models/Vendor.model');
const { sendNotification } = require('../utils/notifier');
const logisticsService = require('./logistics.service');
const { withLock } = require('../utils/locks');

const RUN_INTERVAL_MS = 60 * 1000;  // 1 minute
const LOCK_TTL_SECONDS = Math.ceil(RUN_INTERVAL_MS / 1000) + 30;
const BATCH_SIZE = 20;

let timer = null;

/**
 * Dispatch a single order's rider by creating the Shipment.
 * Wrapped in a Mongoose transaction so no partial writes occur.
 */
const dispatchRiderForOrder = async (order, app) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Re-fetch + lock within the transaction to avoid race with concurrent workers
    const locked = await Order.findOne({
      _id:              order._id,
      food_status:      'preparing',
      rider_dispatch_at: { $ne: null, $lte: new Date() },
      fulfilment_type:  'delivery',
    }).session(session);

    if (!locked) {
      // Already dispatched or order changed state
      await session.abortTransaction();
      return false;
    }

    // Idempotency guard — don't double-create Shipments
    const existingShipment = await Shipment.findOne({ order_id: locked._id }).session(session);
    if (existingShipment) {
      // Shipment already exists; clear the scheduled flag and exit
      locked.rider_dispatch_at = null;
      await locked.save({ session });
      await session.commitTransaction();
      return false;
    }

    // Resolve delivery quartier — use explicit quartier or fall back to zone name
    const deliveryQuartier = locked.shipping_address?.quartier || null;

    // Create the Shipment for this delivery order.
    // If creation fails, we still commit with rider_dispatch_at cleared so the
    // order does not retry infinitely. Admin is notified to assign manually.
    try {
      await logisticsService.createShipmentsForOrder(
        locked,
        deliveryQuartier,
        locked.logistics_company_id,
        session
      );
    } catch (shipErr) {
      console.error('[delayedRiderDispatch] shipment creation failed for order', locked._id, ':', shipErr.message);
      locked.status_logs = locked.status_logs || [];
      locked.status_logs.push({
        status:    'dispatch_failed',
        actor_id:  null,
        timestamp: new Date(),
        note:      `Rider dispatch failed — manual assignment required. Error: ${shipErr.message}`,
      });
      // Fall through: still clear rider_dispatch_at below so we don't retry forever.
      // Admin notification fires after commit.
      locked.rider_dispatch_at = null;
      await locked.save({ session });
      await session.commitTransaction();
      setImmediate(async () => {
        try {
          const { notifyAdmins } = require('../utils/notifier');
          await notifyAdmins(app, {
            title:    'Rider Dispatch Failed',
            message:  `Order #${locked._id.toString().slice(-6).toUpperCase()} could not be assigned a rider automatically: ${shipErr.message}. Manual assignment required.`,
            type:     'system_alert',
            metadata: { target_id: locked._id, link: `/admin/orders/${locked._id}` },
          });
        } catch (_) {}
      });
      return true; // counts as processed (no longer retrying)
    }

    // Clear the scheduled flag so this order is excluded from future scans
    locked.rider_dispatch_at = null;
    await locked.save({ session });
    await session.commitTransaction();

    // Background notifications (non-blocking)
    setImmediate(async () => {
      try {
        // Notify the restaurant that a rider has been dispatched
        const vendor = await Vendor.findById(locked.vendor_id).select('user_id').lean();
        if (vendor) {
          await sendNotification(app, vendor.user_id, {
            title:   'Rider Dispatched',
            message: `A rider has been dispatched for order #${locked._id.toString().slice(-6).toUpperCase()} and is on their way to pick up.`,
            type:    'order_status',
            metadata: { target_id: locked._id, link: `/vendor/orders/${locked._id}` },
          });
        }

        // Notify the buyer that their rider is on the way
        await sendNotification(app, locked.customer_id, {
          title:   'Rider On The Way',
          message: 'A rider has been dispatched to collect your food order. It will be with you soon!',
          type:    'order_status',
          metadata: { target_id: locked._id, link: `/orders/${locked._id}` },
        });
      } catch (notifyErr) {
        console.error('[delayedRiderDispatch] notification failed:', notifyErr.message);
      }
    });

    return true;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('[delayedRiderDispatch] failed to dispatch order', order._id, ':', error.message);
    return false;
  } finally {
    session.endSession();
  }
};

/**
 * Main tick — scan for orders whose delayed dispatch time has arrived.
 */
const runDelayedRiderDispatch = async (app) => {
  const result = await withLock('worker:delayed-rider-dispatch', LOCK_TTL_SECONDS, async () => {
  let dispatched = 0;

  try {
    const now = new Date();
    const candidates = await Order.find({
      food_status:       'preparing',
      rider_dispatch_at: { $ne: null, $lte: now },
      fulfilment_type:   'delivery',
      logistics_company_id: { $ne: null },
    })
      .select('_id customer_id vendor_id food_status logistics_company_id shipping_address rider_dispatch_at products fulfilment_type')
      .sort('rider_dispatch_at')
      .limit(BATCH_SIZE)
      .lean();

    for (const order of candidates) {
      const ok = await dispatchRiderForOrder(order, app);
      if (ok) dispatched += 1;
    }
  } catch (error) {
    console.error('[delayedRiderDispatch] scan failed:', error.message);
  }

  return { dispatched, skipped: false };
  }).catch((err) => {
    console.error('[delayedRiderDispatch] lock failed:', err.message);
    return { dispatched: 0, skipped: false };
  });

  return result ?? { dispatched: 0, skipped: true };
};

/**
 * Register the background worker.
 * Called once from server.js during boot.
 */
const startDelayedRiderDispatchWorker = (app) => {
  if (timer) return;

  // First run 90 s after boot to allow the server to fully initialise
  setTimeout(() => {
    runDelayedRiderDispatch(app).catch((err) => {
      console.error('[delayedRiderDispatch] initial run failed:', err.message);
    });
  }, 90 * 1000);

  timer = setInterval(() => {
    runDelayedRiderDispatch(app).catch((err) => {
      console.error('[delayedRiderDispatch] interval failed:', err.message);
    });
  }, RUN_INTERVAL_MS);

  if (timer.unref) timer.unref();
};

const stopDelayedRiderDispatchWorker = () => {
  if (timer) { clearInterval(timer); timer = null; }
};

module.exports = { runDelayedRiderDispatch, startDelayedRiderDispatchWorker, stopDelayedRiderDispatchWorker };
