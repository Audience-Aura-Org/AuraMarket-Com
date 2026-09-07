/**
 * utils/walletSocket.js
 * Shared helper for emitting wallet balance updates over Socket.IO.
 *
 * Always fetches the user's live post-update wallet_balance from the DB and
 * includes it in the payload so the client TopNav can update instantly
 * without a second GET /wallet round-trip (mirrors the emitWalletCredit
 * pattern used in payment.controller.js for PawaPay/PayUnit webhooks).
 *
 * Usage:
 *   const { emitWalletUpdate } = require('../utils/walletSocket');
 *   await emitWalletUpdate(io, userId, { type: 'refund', reference: orderId });
 */

const User = require('../models/User.model');

/**
 * @param {Object}  io      - Socket.IO server instance (from app.get('io'))
 * @param {*}       userId  - User's MongoDB ObjectId or string
 * @param {Object}  [extra] - Extra fields merged into the payload (type, reference, amount, …)
 */
const emitWalletUpdate = async (io, userId, extra = {}) => {
  if (!io || !userId) return;
  try {
    const u = await User.findById(userId).select('wallet_balance').lean();
    const room = userId.toString();
    const payload = {
      ...extra,
      ...(Number.isFinite(u?.wallet_balance) ? { balance: u.wallet_balance } : {}),
    };
    io.to(room).emit('wallet:credited', payload);
    io.to(`user:${room}`).emit('wallet:credited', payload);
  } catch (_) { /* socket emit is always best-effort */ }
};

module.exports = { emitWalletUpdate };
