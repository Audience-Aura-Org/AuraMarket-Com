/**
 * services/staleTransactionCleanup.service.js
 * Auradime — Stale Pending Transaction Cleanup Worker
 *
 * Runs every 30 minutes. Finds pending gateway transactions that have been
 * waiting too long (no webhook received) and resolves them:
 *
 *   PawaPay deposits (have a queryable API):
 *     – Poll PawaPay for the true status.
 *     – COMPLETED → settle (credit wallet or settle orders).
 *     – FAILED    → mark failed, cancel associated orders.
 *     – PENDING after > EXPIRE_AFTER_MS → mark expired, cancel orders.
 *
 *   Other gateways (eversend, payunit — no status-poll path):
 *     – Mark expired after EXPIRE_AFTER_MS, cancel associated orders.
 *
 * All operations are idempotent: findOneAndUpdate with status guards prevents
 * double-processing if two worker ticks overlap.
 */

'use strict';

const mongoose  = require('mongoose');
const Transaction = require('../models/Transaction.model');
const Order       = require('../models/Order.model');
const User        = require('../models/User.model');
const pawapay     = require('./payment/gateways/pawapay.gateway');
const { settleOrders } = require('./payment/settle.service');
const { creditBalance } = require('./wallet.service');

const POLL_INTERVAL_MS = 30 * 60 * 1000;  // check every 30 min
const STALE_AFTER_MS   =  4 * 60 * 60 * 1000; // consider stale after 4 h
const EXPIRE_AFTER_MS  = 24 * 60 * 60 * 1000; // hard-expire after 24 h

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Cancel pending orders associated with a transaction so they don't remain
 * stuck in a non-terminal state.
 */
const cancelStaleOrders = async (orderIds = [], reason = 'Payment expired') => {
  if (!orderIds.length) return;
  await Order.updateMany(
    { _id: { $in: orderIds }, payment_status: 'pending' },
    {
      $set: {
        payment_status: 'failed',
        order_status:   'cancelled',
      },
      $push: {
        status_logs: {
          status:    'cancelled',
          actor_id:  null,
          timestamp: new Date(),
          note:      reason,
        },
      },
    }
  );

  // Also cancel food orders that are stuck in awaiting_payment
  await Order.updateMany(
    { _id: { $in: orderIds }, food_status: 'awaiting_payment', payment_status: 'failed' },
    {
      $set: { food_status: 'timed_out' },
      $push: {
        status_logs: {
          status:    'timed_out',
          actor_id:  null,
          timestamp: new Date(),
          note:      reason,
        },
      },
    }
  );
};

/**
 * Settle a single completed PawaPay deposit transaction.
 * Handles both order-payment and direct wallet-deposit flows.
 */
const settlePawaPayDeposit = async (txn, app) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Atomic claim — prevents race with a late-arriving webhook
    const claimed = await Transaction.findOneAndUpdate(
      { _id: txn._id, status: { $in: ['pending', 'processing'] } },
      { $set: { status: 'completed' } },
      { session, new: true }
    );
    if (!claimed) {
      // Already settled by a concurrent webhook
      await session.abortTransaction();
      return;
    }

    if (claimed.order_ids?.length > 0) {
      await settleOrders(
        claimed.user_id.toString(),
        claimed.order_ids.map(String),
        session,
        app,
        true,  // skipBalanceDeduct — funds came via gateway, not wallet
        process.env.WEB_CLIENT_URL || '',
        'pawapay'
      );
    } else {
      // Pure wallet deposit
      await User.findOneAndUpdate(
        { _id: claimed.user_id },
        { $inc: { wallet_balance: claimed.amount } },
        { session }
      );
    }

    await session.commitTransaction();
    console.log(`[StaleCleanup] Settled PawaPay deposit txn ${txn._id} (${txn.amount} XAF)`);
  } catch (err) {
    await session.abortTransaction();
    console.error(`[StaleCleanup] Failed to settle txn ${txn._id}:`, err.message);
  } finally {
    session.endSession();
  }
};

// ---------------------------------------------------------------------------
// Main sweep
// ---------------------------------------------------------------------------

const runCleanup = async (app) => {
  const now = new Date();
  const staleThreshold  = new Date(now - STALE_AFTER_MS);
  const expireThreshold = new Date(now - EXPIRE_AFTER_MS);

  // ── 1. PawaPay deposits — poll the API for authoritative status ──────────
  const stalePawapay = await Transaction.find({
    gateway: 'pawapay',
    status:  'pending',
    type:    { $in: ['deposit', 'payment'] },
    createdAt: { $lt: staleThreshold },
  }).select('_id user_id gateway_transaction_id metadata order_ids amount createdAt reference').lean();

  for (const txn of stalePawapay) {
    const depositId = txn.gateway_transaction_id || txn.metadata?.depositId;
    if (!depositId) continue;

    try {
      const result = await pawapay.getDepositStatus(depositId);
      const norm   = pawapay.normalizeStatus(result?.status);

      if (norm === 'SUCCESSFUL') {
        await settlePawaPayDeposit(txn, app);

      } else if (norm === 'FAILED') {
        const updated = await Transaction.findOneAndUpdate(
          { _id: txn._id, status: 'pending' },
          { $set: { status: 'failed', gateway_response: result } },
          { new: true }
        );
        if (updated?.order_ids?.length) {
          await cancelStaleOrders(updated.order_ids, 'PawaPay deposit failed — stale cleanup.');
        }
        console.log(`[StaleCleanup] Marked PawaPay txn ${txn._id} as failed (API status: ${result?.status})`);

      } else if (txn.createdAt < expireThreshold) {
        // Still PENDING after 24 h — hard expire
        const expired = await Transaction.findOneAndUpdate(
          { _id: txn._id, status: 'pending' },
          { $set: { status: 'expired', gateway_response: { note: 'Expired by stale cleanup after 24 h.' } } },
          { new: true }
        );
        if (expired?.order_ids?.length) {
          await cancelStaleOrders(expired.order_ids, 'PawaPay deposit expired — no response within 24 h.');
        }
        console.log(`[StaleCleanup] Expired PawaPay txn ${txn._id} (still PENDING after 24 h)`);
      }
      // else: still genuinely PENDING and within the 24 h window — leave it
    } catch (err) {
      console.error(`[StaleCleanup] Error polling PawaPay for txn ${txn._id}:`, err.message);
    }
  }

  // ── 2. Other gateways — expire hard after 24 h (no poll API available) ──
  const staleOther = await Transaction.find({
    gateway:   { $in: ['eversend', 'payunit'] },
    status:    'pending',
    type:      { $in: ['deposit', 'payment'] },
    createdAt: { $lt: expireThreshold },
  }).select('_id user_id order_ids amount createdAt gateway reference').lean();

  for (const txn of staleOther) {
    const expired = await Transaction.findOneAndUpdate(
      { _id: txn._id, status: 'pending' },
      { $set: { status: 'expired', gateway_response: { note: `Expired by stale cleanup after 24 h (${txn.gateway}).` } } },
      { new: true }
    );
    if (expired?.order_ids?.length) {
      await cancelStaleOrders(expired.order_ids, `${txn.gateway} payment expired — no confirmation within 24 h.`);
    }
    console.log(`[StaleCleanup] Expired ${txn.gateway} txn ${txn._id} after 24 h`);
  }

  if (stalePawapay.length + staleOther.length > 0) {
    console.log(`[StaleCleanup] Sweep complete — processed ${stalePawapay.length} PawaPay, ${staleOther.length} other.`);
  }
};

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

const startStaleTransactionCleanupWorker = (app) => {
  // Run once on startup (slightly delayed to let DB fully connect)
  setTimeout(() => runCleanup(app).catch(console.error), 2 * 60 * 1000);

  // Then repeat on interval
  setInterval(() => runCleanup(app).catch(console.error), POLL_INTERVAL_MS);

  console.log('[StaleCleanup] Stale transaction cleanup worker started (30 min interval).');
};

module.exports = { startStaleTransactionCleanupWorker };
