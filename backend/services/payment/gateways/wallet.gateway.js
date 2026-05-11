/**
 * services/payment/gateways/wallet.gateway.js
 * Aura Market — Wallet-as-Payment Gateway
 *
 * Allows users to pay directly from their Aura wallet balance.
 * No external redirect — instant settlement.
 */

const User = require('../../../models/User.model');
const Transaction = require('../../../models/Transaction.model');
const mongoose = require('mongoose');
const { settleOrders } = require('../settle.service');
const { getWebUrl } = require('../../../utils/url');
const crypto = require('crypto');

const walletGateway = {
  id: 'wallet',
  label: 'Aura Wallet',
  description: 'Pay instantly using your Aura wallet balance. No redirects.',
  icon: '💳',
  currencies: [], // supports all currencies
  regions: [],
  enabled: true,
  fields: [], // No extra input needed — balance check is server-side

  /**
   * Initialize a wallet payment.
   * Validates balance and deducts immediately.
   * @param {Object} ctx - { user, amount, orderIds, req }
   */
  async initialize({ user, amount, orderIds = [], req }) {
    const dbUser = await User.findById(user._id);
    if (!dbUser) throw new Error('User not found.');
    if (dbUser.wallet_balance < amount) {
      throw new Error(`Insufficient wallet balance. Available: ${dbUser.wallet_balance.toLocaleString()} XAF.`);
    }

    const reference = `AURA-WAL-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Settle all orders immediately
      await settleOrders(user._id, orderIds, session, req?.app, false, getWebUrl(req));
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    return {
      reference,
      settled: true,
      instructions: 'Payment deducted from your Aura Wallet. Orders are now confirmed.',
    };
  },

  /**
   * Wallet payments are synchronous — always SUCCESSFUL if initialize() returned.
   */
  async verify(reference) {
    const tx = await Transaction.findOne({ reference });
    if (!tx) return { status: 'PENDING' };
    return { status: tx.status === 'completed' ? 'SUCCESSFUL' : 'FAILED', amount: tx.amount };
  },
};

module.exports = walletGateway;
