/**
 * services/legacyWithdrawals.service.js
 * Auradime — Recovery for withdrawals stranded by the retired
 * POST /wallet/withdraw endpoint.
 *
 * That endpoint debited the user's balance and wrote a pending 'withdrawal'
 * Transaction but never created a WithdrawalRequest, so the payout never
 * reached the admin queue (/withdrawals/admin). Recovery refunds the amount
 * so the user can request it again through the reviewed flow. Paying out is
 * deliberately NOT automated: it moves real money and needs admin review.
 *
 * Used by scripts/legacy-withdrawals.js.
 */

const mongoose = require('mongoose');
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const { creditBalance } = require('./wallet.service');

/**
 * The exact signature of a stranded legacy withdrawal:
 *  - pending withdrawal
 *  - no linked WithdrawalRequest (current flow sets metadata.withdrawal_request_id)
 *  - not an admin direct payout (metadata.admin_direct)
 *  - carries the legacy request shape (gateway_response.method)
 */
const LEGACY_FILTER = {
  type: 'withdrawal',
  status: 'pending',
  'metadata.withdrawal_request_id': { $exists: false },
  'metadata.admin_direct': { $ne: true },
  'gateway_response.method': { $exists: true },
};

/** All stranded legacy withdrawals, oldest first, with the owner's contact. */
async function findLegacyPendingWithdrawals() {
  const rows = await Transaction.find(LEGACY_FILTER).sort({ createdAt: 1 }).lean();
  const users = await User.find({ _id: { $in: rows.map((r) => r.user_id) } }, 'name email wallet_balance').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return rows.map((r) => ({
    _id: r._id,
    reference: r.reference,
    amount: r.amount,
    createdAt: r.createdAt,
    description: r.description,
    user: byId.get(String(r.user_id)) || { _id: r.user_id },
  }));
}

/**
 * Refund one stranded legacy withdrawal atomically. Idempotent: anything that
 * is no longer a pending legacy withdrawal is left untouched.
 * @returns {Promise<{refunded: boolean, amount?: number, balance?: number, reason?: string}>}
 */
async function refundLegacyWithdrawal(transactionId, { note = 'Returned: withdrawal could not be processed' } = {}) {
  const session = await mongoose.startSession();
  let result = { refunded: false, reason: 'not_pending_legacy' };
  try {
    await session.withTransaction(async () => {
      // Claim it inside the transaction: only one run can flip pending → rejected.
      // Pipeline update: legacy rows have metadata: null (schema default), and
      // a plain $set on 'metadata.x' fails on a null parent.
      const tx = await Transaction.findOneAndUpdate(
        { _id: transactionId, ...LEGACY_FILTER },
        [{
          $set: {
            status: 'rejected',
            metadata: {
              $mergeObjects: [
                { $ifNull: ['$metadata', {}] },
                { legacy_refund: { refunded_at: '$$NOW', note } },
              ],
            },
          },
        }],
        { session, returnDocument: 'after', updatePipeline: true }
      );
      if (!tx) {
        result = { refunded: false, reason: 'not_pending_legacy' };
        return;
      }
      const user = await creditBalance(tx.user_id, tx.amount, session);
      result = { refunded: true, amount: tx.amount, balance: user?.wallet_balance, userId: tx.user_id };
    });
  } finally {
    await session.endSession();
  }

  if (result.refunded) {
    await Notification.create({
      recipient: result.userId,
      title: 'Withdrawal returned to your wallet',
      message: `Your withdrawal of ${Number(result.amount).toLocaleString()} XAF could not be processed and has been returned to your wallet. Please submit it again from your wallet.`,
      type: 'wallet_update',
      metadata: { link: '/wallet', wallet_balance: result.balance },
    }).catch(() => {});
  }
  const { userId, ...publicResult } = result;
  return publicResult;
}

module.exports = { LEGACY_FILTER, findLegacyPendingWithdrawals, refundLegacyWithdrawal };
