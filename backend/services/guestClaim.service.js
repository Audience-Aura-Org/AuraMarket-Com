/**
 * services/guestClaim.service.js
 * Instant Buy Now: when someone signs in on the device that holds a guest
 * session, everything the guest bought moves into the real account and the
 * guest account is closed. One transaction: all of it moves or none does.
 */
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Transaction = require('../models/Transaction.model');
const Escrow = require('../models/Escrow.model');
const Dispute = require('../models/Dispute.model');
const Notification = require('../models/Notification.model');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const { debitBalance, creditBalance } = require('./wallet.service');

/** Moves guest records to userId inside `session`. Returns counts. */
const claimGuest = async (guestId, userId, session) => {
  const guest = await User.findOne({ _id: guestId, is_guest: true, is_active: true }).session(session);
  if (!guest) return { orders: 0, transactions: 0 };

  const opts = { session };
  const [orders, transactions] = await Promise.all([
    Order.updateMany({ customer_id: guestId }, { $set: { customer_id: userId } }, opts),
    Transaction.updateMany({ user_id: guestId }, { $set: { user_id: userId } }, opts),
  ]);
  await Escrow.updateMany({ buyer_id: guestId }, { $set: { buyer_id: userId } }, opts);
  await Dispute.updateMany({ initiator_id: guestId }, { $set: { initiator_id: userId } }, opts);
  await WithdrawalRequest.updateMany({ requested_by: guestId }, { $set: { requested_by: userId } }, opts);
  await Notification.updateMany({ recipient: guestId }, { $set: { recipient: userId } }, opts);

  const balance = Number(guest.wallet_balance || 0);
  if (balance > 0) {
    await debitBalance(guestId, balance, session);
    await creditBalance(userId, balance, session);
  }
  await User.updateOne({ _id: guestId }, { $set: { is_active: false, guest_claimed_by: userId } }, opts);
  return { orders: orders.modifiedCount, transactions: transactions.modifiedCount };
};

module.exports = { claimGuest };
