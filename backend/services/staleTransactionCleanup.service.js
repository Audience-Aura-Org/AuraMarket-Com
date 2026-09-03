/**
 * services/staleTransactionCleanup.service.js
 * Auradime — Stale Pending Transaction Reconciliation Worker
 *
 * Runs every 30 minutes. Finds pending gateway transactions that have been
 * waiting too long (no webhook received) and resolves them by polling the
 * gateway API for the authoritative status.
 *
 *   PawaPay deposits  → poll PawaPay deposit API
 *   PayUnit deposits  → poll PayUnit payment-status API
 *   Eversend deposits → poll Eversend transaction API
 *
 *   Withdrawal payouts (PawaPay / Eversend) → poll payout status API
 *
 * For each:
 *   SUCCESSFUL → settle (credit wallet, settle orders, or mark withdrawal completed)
 *   FAILED     → mark failed, cancel associated orders / restore balance
 *   PENDING after > EXPIRE_AFTER_MS → mark expired
 *
 * All operations are idempotent: findOneAndUpdate with status guards prevents
 * double-processing if two worker ticks overlap.
 */

'use strict';

const mongoose  = require('mongoose');
const Transaction        = require('../models/Transaction.model');
const Order              = require('../models/Order.model');
const User               = require('../models/User.model');
const WithdrawalRequest  = require('../models/WithdrawalRequest.model');
const pawapay            = require('./payment/gateways/pawapay.gateway');
const payunit            = require('./payunit.service');
const eversend           = require('./eversend.service');
const { settleOrders }   = require('./payment/settle.service');
const { creditBalance }  = require('./wallet.service');
const webhookHealth      = require('./webhookHealthMonitor.service');

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
 * Settle a confirmed deposit transaction (any gateway).
 * Handles both order-payment and direct wallet-deposit flows.
 */
const settleDeposit = async (txn, app, gateway) => {
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
      await session.abortTransaction();
      return false;
    }

    if (claimed.order_ids?.length > 0) {
      await settleOrders(
        claimed.user_id.toString(),
        claimed.order_ids.map(String),
        session,
        app,
        true,  // skipBalanceDeduct — funds came via gateway, not wallet
        process.env.WEB_CLIENT_URL || '',
        gateway
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
    webhookHealth.record('cronSettled', gateway);
    console.log(`[StaleCleanup] Settled ${gateway} deposit txn ${txn._id} (${txn.amount} XAF)`);
    return true;
  } catch (err) {
    await session.abortTransaction();
    console.error(`[StaleCleanup] Failed to settle ${gateway} txn ${txn._id}:`, err.message);
    return false;
  } finally {
    session.endSession();
  }
};

/**
 * Mark a deposit transaction as failed and cancel associated orders.
 */
const failDeposit = async (txn, gatewayResponse, reason) => {
  const updated = await Transaction.findOneAndUpdate(
    { _id: txn._id, status: { $in: ['pending', 'processing'] } },
    { $set: { status: 'failed', gateway_response: gatewayResponse } },
    { new: true }
  );
  if (updated?.order_ids?.length) {
    await cancelStaleOrders(updated.order_ids, reason);
  }
  return !!updated;
};

/**
 * Hard-expire a deposit transaction that has been pending too long.
 */
const expireDeposit = async (txn, reason) => {
  const expired = await Transaction.findOneAndUpdate(
    { _id: txn._id, status: { $in: ['pending', 'processing'] } },
    { $set: { status: 'expired', gateway_response: { note: reason } } },
    { new: true }
  );
  if (expired?.order_ids?.length) {
    await cancelStaleOrders(expired.order_ids, reason);
  }
  return !!expired;
};

// ---------------------------------------------------------------------------
// Gateway-specific status resolution
// ---------------------------------------------------------------------------

const resolvePawapayDeposit = async (txn) => {
  const depositId = txn.gateway_transaction_id || txn.metadata?.depositId;
  if (!depositId) return null;
  const result = await pawapay.getDepositStatus(depositId);
  return { status: pawapay.normalizeStatus(result?.status), raw: result };
};

const resolvePayunitDeposit = async (txn) => {
  if (!txn.reference) return null;
  const result = await payunit.getPaymentStatus(txn.reference);
  const status = payunit.normalizeStatus(result?.data);
  return { status, raw: result?.data || result?.raw };
};

const resolveEversendDeposit = async (txn) => {
  const gatewayTxId = txn.gateway_transaction_id;
  if (!gatewayTxId) return null;
  const result = await eversend.getTransactionStatus(gatewayTxId);
  const txData = result?.data || result;
  const status = (txData?.status || '').toUpperCase();
  const normalized = status === 'SUCCESSFUL' || status === 'SUCCESS' ? 'SUCCESSFUL'
    : status === 'FAILED' || status === 'CANCELLED' ? 'FAILED'
    : 'PENDING';
  return { status: normalized, raw: txData };
};

// ---------------------------------------------------------------------------
// Main sweep
// ---------------------------------------------------------------------------

const runCleanup = async (app) => {
  const now = new Date();
  const staleThreshold  = new Date(now - STALE_AFTER_MS);
  const expireThreshold = new Date(now - EXPIRE_AFTER_MS);

  const stats = { settled: 0, failed: 0, expired: 0, withdrawalSettled: 0, withdrawalFailed: 0 };

  // ── 1. Deposit reconciliation — all gateways ────────────────────────────

  const gatewayResolvers = {
    pawapay: resolvePawapayDeposit,
    payunit: resolvePayunitDeposit,
    eversend: resolveEversendDeposit,
  };

  for (const [gateway, resolve] of Object.entries(gatewayResolvers)) {
    const staleTxns = await Transaction.find({
      gateway,
      status:    { $in: ['pending', 'processing'] },
      type:      { $in: ['deposit', 'payment'] },
      createdAt: { $lt: staleThreshold },
    }).select('_id user_id gateway_transaction_id metadata order_ids amount createdAt reference').lean();

    for (const txn of staleTxns) {
      try {
        const result = await resolve(txn);
        if (!result) continue; // no gateway ID to query

        if (result.status === 'SUCCESSFUL') {
          if (await settleDeposit(txn, app, gateway)) stats.settled++;

        } else if (result.status === 'FAILED') {
          if (await failDeposit(txn, result.raw, `${gateway} deposit failed — stale cleanup.`)) stats.failed++;
          console.log(`[StaleCleanup] Marked ${gateway} txn ${txn._id} as failed`);

        } else if (txn.createdAt < expireThreshold) {
          if (await expireDeposit(txn, `Expired by stale cleanup after 24 h (${gateway}).`)) stats.expired++;
          console.log(`[StaleCleanup] Expired ${gateway} txn ${txn._id} (still PENDING after 24 h)`);
        }
        // else: still genuinely PENDING and within the 24 h window — leave it
      } catch (err) {
        console.error(`[StaleCleanup] Error polling ${gateway} for txn ${txn._id}:`, err.message);
      }
    }
  }

  // ── 2. Withdrawal payout reconciliation ─────────────────────────────────
  //    Check approved/processing withdrawals that have a gateway transaction ID

  const staleWithdrawals = await WithdrawalRequest.find({
    status: { $in: ['approved', 'processing'] },
    eversend_transaction_id: { $exists: true, $ne: null },
    updatedAt: { $lt: staleThreshold },
  }).lean();

  for (const wr of staleWithdrawals) {
    const payoutGateway = wr.payout_gateway || (wr.eversend_transaction_id ? 'eversend' : null);
    const gatewayTxId = wr.eversend_transaction_id;
    if (!payoutGateway || !gatewayTxId) continue;
    // PayUnit withdrawals are manual cashout — no API to query
    if (payoutGateway === 'payunit') continue;

    try {
      let normalizedStatus = 'PENDING';

      if (payoutGateway === 'pawapay') {
        const result = await pawapay.getPayoutStatus(gatewayTxId);
        normalizedStatus = pawapay.normalizePawaPayoutStatus(result?.status);
      } else {
        // eversend
        const result = await eversend.getTransactionStatus(gatewayTxId);
        const txData = result?.data || result;
        const rawStatus = (txData?.status || '').toUpperCase();
        normalizedStatus = rawStatus === 'SUCCESSFUL' || rawStatus === 'SUCCESS' ? 'SUCCESSFUL'
          : rawStatus === 'FAILED' || rawStatus === 'CANCELLED' ? 'FAILED'
          : 'PENDING';
      }

      if (normalizedStatus === 'SUCCESSFUL') {
        // Mark withdrawal completed
        const updated = await WithdrawalRequest.findOneAndUpdate(
          { _id: wr._id, status: { $in: ['approved', 'processing'] } },
          { $set: { status: 'completed', eversend_status: 'SUCCESSFUL' } },
          { new: true }
        );
        if (updated) {
          // Also mark linked transaction as completed
          await Transaction.findOneAndUpdate(
            { 'metadata.withdrawal_request_id': wr._id.toString(), status: { $ne: 'completed' } },
            { $set: { status: 'completed' } }
          );
          stats.withdrawalSettled++;
          webhookHealth.record('cronSettled', payoutGateway);
          console.log(`[StaleCleanup] Marked ${payoutGateway} withdrawal ${wr._id} as completed`);
        }

      } else if (normalizedStatus === 'FAILED') {
        const updated = await WithdrawalRequest.findOneAndUpdate(
          { _id: wr._id, status: { $in: ['approved', 'processing'] } },
          { $set: { status: 'failed', eversend_status: 'FAILED', failure_reason: `${payoutGateway} payout failed — reconciliation.` } },
          { new: true }
        );
        if (updated) {
          // Restore balance if it was deducted
          if (updated.balance_deducted) {
            await User.findByIdAndUpdate(updated.requested_by, {
              $inc: { wallet_balance: updated.amount },
            });
            console.log(`[StaleCleanup] Restored ${updated.amount} XAF to user ${updated.requested_by} (failed withdrawal)`);
          }
          // Mark linked transaction as failed
          await Transaction.findOneAndUpdate(
            { 'metadata.withdrawal_request_id': wr._id.toString(), status: { $ne: 'completed' } },
            { $set: { status: 'failed' } }
          );
          stats.withdrawalFailed++;
          console.log(`[StaleCleanup] Marked ${payoutGateway} withdrawal ${wr._id} as failed`);
        }
      }
      // PENDING — leave it, will be checked next sweep
    } catch (err) {
      console.error(`[StaleCleanup] Error polling ${payoutGateway} for withdrawal ${wr._id}:`, err.message);
    }
  }

  // ── 3. Summary ──────────────────────────────────────────────────────────

  const totalProcessed = stats.settled + stats.failed + stats.expired + stats.withdrawalSettled + stats.withdrawalFailed;
  if (totalProcessed > 0) {
    console.log(
      `[StaleCleanup] Sweep complete — deposits: settled=${stats.settled} failed=${stats.failed} expired=${stats.expired} | ` +
      `withdrawals: settled=${stats.withdrawalSettled} failed=${stats.withdrawalFailed}`
    );
  }

  // Log webhook health summary each sweep
  webhookHealth.logSummary();
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
