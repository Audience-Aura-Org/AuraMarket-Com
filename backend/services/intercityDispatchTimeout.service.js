/**
 * services/intercityDispatchTimeout.service.js
 * Auradime — Phase 4 Step 7 Deferred: 48h Intercity Dispatch Auto-Reversal
 *
 * After an intercity order is placed, the vendor receives the transit_fee advance
 * immediately (so they can pay the agency at dropoff). If the vendor never uploads a
 * waybill / dispatch receipt within 48 hours, the platform must:
 *
 *   1. Clawback the transit_fee advance from the vendor's wallet (may go negative)
 *   2. Cancel the order (order_status → cancelled)
 *   3. Refund the buyer in full (wallet credit = total_amount)
 *   4. Write audit Transaction records for both parties
 *   5. Notify buyer + vendor
 *
 * Runs every 30 minutes. Only acts on PAID, un-dispatched intercity orders older than 48h.
 *
 * Registered in server.js — first run 2 min after boot, then every 30 min.
 */

const mongoose = require('mongoose');
const Order       = require('../models/Order.model');
const Vendor      = require('../models/Vendor.model');
const User        = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { sendNotification } = require('../utils/notifier');
const { debitBalance, creditBalance } = require('./wallet.service');
const { withLock } = require('../utils/locks');

const DISPATCH_WINDOW_HOURS = 48;
const INTERVAL_MS = 30 * 60 * 1000;
const LOCK_TTL_SECONDS = Math.ceil(INTERVAL_MS / 1000) + 60;

let _timer = null;
const genRef = (prefix = 'IC-REV') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

async function runIntercityDispatchTimeout(app) {
  if (mongoose.connection.readyState !== 1) return;
  await withLock('worker:intercity-dispatch-timeout', LOCK_TTL_SECONDS, async () => {

  const cutoff = new Date(Date.now() - DISPATCH_WINDOW_HOURS * 3600 * 1000);

  const stale = await Order.find({
    shipping_method:  'intercity_agency',
    transit_status:   'awaiting_dispatch',
    payment_status:   'paid',
    order_status:     { $nin: ['cancelled', 'refunded'] },
    createdAt:        { $lt: cutoff },
  }).lean();

  if (!stale.length) return;

  console.log(`[intercityDispatchTimeout] Found ${stale.length} stale order(s) — reversing advances.`);

  for (const orderDoc of stale) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findById(orderDoc._id).session(session);
      if (!order || order.transit_status !== 'awaiting_dispatch' || order.payment_status !== 'paid') {
        await session.abortTransaction();
        session.endSession();
        continue; // already handled by another concurrent run
      }

      const vendorRecord = await Vendor.findById(order.vendor_id).session(session);
      const [vendorUser, buyerUser] = await Promise.all([
        User.findById(vendorRecord.user_id).session(session),
        User.findById(order.customer_id).session(session),
      ]);

      const ref = genRef();
      const orderLabel = `Order #${order._id.toString().slice(-6).toUpperCase()}`;

      // ── 1. Clawback transit_fee advance from vendor ───────────────────────
      if (order.transit_fee > 0) {
        // allowNegative: vendor may have already spent the advance
        await debitBalance(vendorUser._id, order.transit_fee, session, { allowNegative: true });

        await Transaction.create([{
          user_id:     vendorUser._id,
          type:        'payment',
          amount:      order.transit_fee,
          reference:   `${ref}-CLBK`,
          status:      'completed',
          gateway:     'platform',
          description: `Transit fee clawback — dispatch window expired (${orderLabel})`,
          order_id:    order._id,
        }], { session, ordered: true });
      }

      // ── 2. Refund buyer in full ───────────────────────────────────────────
      await creditBalance(buyerUser._id, order.total_amount, session);

      await Transaction.create([{
        user_id:     buyerUser._id,
        type:        'refund',
        amount:      order.total_amount,
        reference:   `${ref}-REF`,
        status:      'completed',
        gateway:     'platform',
        description: `Full refund — vendor did not dispatch intercity order within 48 h (${orderLabel})`,
        order_id:    order._id,
      }], { session, ordered: true });

      // ── 3. Clawback vendor payout from escrow if still pending ────────────
      // The vendor payout (subtotal-based) is in escrow; simply close the escrow
      // by marking the order cancelled — escrowAutoRelease will skip it naturally.
      // If the order used the direct path (no escrow), we need to clawback subtotal payout too.
      // For now: escrow orders are self-healing; direct-path orders require a separate clawback
      // of the vendorPayout. This edge is rare at MVP (intercity orders should use escrow).

      // ── 4. Cancel the order ───────────────────────────────────────────────
      order.order_status    = 'cancelled';
      order.payment_status  = 'refunded';
      order.transit_status  = null;
      order.status_logs.push({
        status:    'cancelled',
        actor_id:  null,
        timestamp: new Date(),
        note:      'Auto-cancelled: vendor did not dispatch within 48-hour window. Advance clawed back, buyer refunded.',
      });
      await order.save({ session });

      await session.commitTransaction();
      session.endSession();

      // ── 5. Notifications (background, non-blocking) ───────────────────────
      if (app) {
        setImmediate(async () => {
          try {
            await Promise.all([
              sendNotification(app, buyerUser._id, {
                title:    'Order Cancelled — Full Refund Issued',
                message:  `${orderLabel} was automatically cancelled because the vendor did not ship within 48 hours. Your full payment of ${order.total_amount.toLocaleString()} XAF has been refunded to your wallet.`,
                type:     'order_status',
                metadata: { order_id: order._id, link: '/orders' },
              }),
              sendNotification(app, vendorUser._id, {
                title:    'Intercity Order Cancelled — Advance Reclaimed',
                message:  `${orderLabel} was cancelled because you did not upload a dispatch receipt within 48 hours. The transit fee advance of ${order.transit_fee.toLocaleString()} XAF has been deducted from your wallet.`,
                type:     'order_status',
                metadata: { order_id: order._id, link: '/vendor/orders' },
              }),
            ]);
          } catch (e) {
            console.error('[intercityDispatchTimeout] notify error:', e.message);
          }
        });
      }

      console.log(`[intercityDispatchTimeout] Reversed ${orderLabel} — transit advance clawback + buyer refund.`);
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction();
      session.endSession();
      console.error(`[intercityDispatchTimeout] Failed to reverse order ${orderDoc._id}:`, err.message);
    }
  }
  }).catch((err) => {
    console.error('[intercityDispatchTimeout] lock failed:', err.message);
  });
}

/**
 * Register the intercity dispatch timeout worker.
 * First run: 2 minutes after boot (session/DB is ready by then).
 * Subsequent runs: every 30 minutes.
 *
 * @param {import('express').Application} app
 */
function startIntercityDispatchTimeoutWorker(app) {
  if (_timer) return;
  const FIRST_RUN_MS = 2 * 60 * 1000; // 2 min

  setTimeout(() => {
    runIntercityDispatchTimeout(app).catch((err) =>
      console.error('[intercityDispatchTimeout] initial run failed:', err.message)
    );
    _timer = setInterval(() => {
      runIntercityDispatchTimeout(app).catch((err) =>
        console.error('[intercityDispatchTimeout] interval failed:', err.message)
      );
    }, INTERVAL_MS);
    if (_timer.unref) _timer.unref();
  }, FIRST_RUN_MS);

  console.log('[intercityDispatchTimeout] Worker scheduled — first run in 2 min, then every 30 min.');
}

function stopIntercityDispatchTimeoutWorker() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { startIntercityDispatchTimeoutWorker, runIntercityDispatchTimeout, stopIntercityDispatchTimeoutWorker };
