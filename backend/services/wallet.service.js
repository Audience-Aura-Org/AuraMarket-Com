/**
 * services/wallet.service.js
 * Auradime — authoritative wallet balance mutations.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const { recordAudit } = require('../utils/auditTrail');
const { toXAF } = require('../utils/money');
const logger = require('../utils/logger');

const generateRef = () => `AURA-TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

const isDuplicateIdempotencyKey = (error) => (
  error?.code === 11000
  && (error?.keyPattern?.idempotency_key || error?.keyValue?.idempotency_key)
);

/**
 * Atomically adjust a user's wallet balance and write its ledger entry.
 *
 * When an idempotency key is present, the pending ledger entry is inserted
 * first inside the same MongoDB transaction as the guarded balance update.
 * Its unique index is the durable claim: a replay cannot reach the `$inc`.
 */
const adjustBalance = async (userId, delta, session, meta = {}) => {
  const amount = toXAF(Math.abs(delta));
  if (amount === 0) {
    logger.warn(`[wallet.service] adjustBalance called with zero delta for user ${userId}`);
    return null;
  }

  const isDebit = Number(delta) < 0;
  const signedAmount = isDebit ? -amount : amount;
  const allowNegative = Boolean(meta.allowNegative);
  const reference = meta.reference || generateRef();
  const filter = isDebit && !allowNegative
    ? { _id: userId, wallet_balance: { $gte: amount } }
    : { _id: userId };

  const txData = {
    user_id: userId,
    type: meta.type || (isDebit ? 'withdrawal' : 'deposit'),
    amount,
    reference,
    status: 'pending',
    description: meta.description || (isDebit ? 'Debit' : 'Credit'),
    gateway: meta.gateway || null,
    order_id: meta.order_id || null,
    idempotency_key: meta.idempotency_key || null,
    metadata: meta.metadata || null,
  };

  const applyMutation = async (activeSession) => {
    // Claim first. A unique-key collision aborts before a balance is touched.
    const created = await Transaction.create([txData], { session: activeSession });
    const transaction = Array.isArray(created) ? created[0] : created;
    const updatedUser = await User.findOneAndUpdate(
      filter,
      { $inc: { wallet_balance: signedAmount } },
      { session: activeSession, new: true },
    );

    if (!updatedUser) {
      // Preserve the public insufficient-funds contract while leaving no stale
      // idempotency claim behind for a request that changed nothing.
      await Transaction.deleteOne({ _id: transaction._id }, { session: activeSession });
      return null;
    }

    await recordAudit({
      actorId: meta.actorId || userId,
      action: isDebit ? 'wallet_debit' : 'wallet_credit',
      targetType: 'User',
      targetId: userId,
      before: { wallet_balance: updatedUser.wallet_balance - signedAmount },
      after: { wallet_balance: updatedUser.wallet_balance },
      session: activeSession,
      meta: { reference, amount, description: meta.description, gateway: meta.gateway },
    });

    transaction.status = 'completed';
    await transaction.save({ session: activeSession });
    return { user: updatedUser, transaction };
  };

  if (session) {
    if (typeof session.inTransaction !== 'function' || !session.inTransaction()) {
      throw new Error('adjustBalance requires an active MongoDB transaction when a session is supplied.');
    }
    return applyMutation(session);
  }

  const ownedSession = await mongoose.startSession();
  try {
    let result;
    await ownedSession.withTransaction(async () => {
      result = await applyMutation(ownedSession);
    });
    return result;
  } catch (error) {
    // A completed first request owns the retry key. Return its result without
    // applying the balance mutation a second time.
    if (meta.idempotency_key && isDuplicateIdempotencyKey(error)) {
      const transaction = await Transaction.findOne({ idempotency_key: meta.idempotency_key }).lean();
      if (transaction) {
        const user = await User.findById(userId).select('wallet_balance').lean();
        return { user, transaction };
      }
    }
    throw error;
  } finally {
    await ownedSession.endSession();
  }
};

/**
 * Atomic wallet debit without a ledger record. The calling financial workflow
 * is responsible for writing its own transaction record in the same session.
 */
const debitBalance = async (userId, amount, session, opts = {}) => {
  const amt = toXAF(Math.abs(amount));
  const filter = opts.allowNegative
    ? { _id: userId }
    : { _id: userId, wallet_balance: { $gte: amt } };
  const updateOpts = session ? { session, new: true } : { new: true };
  return User.findOneAndUpdate(filter, { $inc: { wallet_balance: -amt } }, updateOpts);
};

/**
 * Atomic wallet credit without a ledger record. The calling financial workflow
 * is responsible for writing its own transaction record in the same session.
 */
const creditBalance = async (userId, amount, session) => {
  const amt = toXAF(Math.abs(amount));
  const opts = session ? { session, new: true } : { new: true };
  return User.findOneAndUpdate({ _id: userId }, { $inc: { wallet_balance: amt } }, opts);
};

module.exports = { adjustBalance, generateRef, debitBalance, creditBalance };
