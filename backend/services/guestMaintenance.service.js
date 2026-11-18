/**
 * services/guestMaintenance.service.js
 * Instant Buy Now guests have no wallet screen, so:
 *  - sweepGuestRefunds (every 5 min): a refunded balance of 500 XAF or more is
 *    sent back to the guest's Mobile Money number through a normal withdrawal
 *    request (same payout flow, approval and automation as everyone else).
 *  - purgeIdleGuests (daily): guest accounts older than 7 days that never
 *    placed an order are deleted.
 */
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Transaction = require('../models/Transaction.model');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { createWithdrawalRecord } = require('./withdrawalRecord.service');
const { withLock } = require('../utils/locks');

const MIN_REFUND_PAYOUT = 500; // WithdrawalRequest minimum
const IDLE_GUEST_DAYS = 7;
const SWEEP_MS = 5 * 60 * 1000;
const PURGE_MS = 24 * 60 * 60 * 1000;

/** The number the guest paid with: their latest order's contact phone, else the collection's. */
const guestPhone = async (guestId) => {
  const order = await Order.findOne({ customer_id: guestId, 'shipping_address.phone': { $nin: [null, ''] } })
    .sort({ createdAt: -1 }).select('shipping_address.phone').lean();
  if (order) return order.shipping_address.phone;
  const tx = await Transaction.findOne({ user_id: guestId, 'metadata.phone': { $nin: [null, ''] } })
    .sort({ createdAt: -1 }).select('metadata.phone').lean();
  return tx?.metadata?.phone || null;
};

const sweepGuestRefunds = async (app = null) => {
  const guests = await User.find({ is_guest: true, is_active: true, wallet_balance: { $gte: MIN_REFUND_PAYOUT } })
    .select('_id wallet_balance').limit(50).lean();
  let created = 0;
  for (const guest of guests) {
    try {
      const open = await WithdrawalRequest.exists({ requested_by: guest._id, status: { $in: ['pending', 'approved'] } });
      if (open) continue;
      const phone = await guestPhone(guest._id);
      if (!phone) continue;
      const session = await mongoose.startSession();
      let record;
      try {
        await session.withTransaction(async () => {
          const platformSettings = await PlatformSettings.getSettings(session);
          // Re-read inside the transaction so a concurrent change is not double-paid.
          const fresh = await User.findById(guest._id).select('wallet_balance').session(session).lean();
          const amount = Math.floor(Number(fresh?.wallet_balance || 0));
          if (amount < MIN_REFUND_PAYOUT) return;
          record = await createWithdrawalRecord({
            userId: guest._id,
            role: 'user',
            amount,
            currency: 'XAF',
            withdrawal_method: 'momo',
            recipient_details: { phone_number: phone, first_name: 'Guest', last_name: 'Buyer', country: 'CM' },
            note: 'Automatic refund to the Mobile Money number used for an Instant Buy Now order.',
            platformSettings,
          }, session);
        });
      } finally {
        await session.endSession();
      }
      if (!record) continue;
      created += 1;
      if (record.withdrawalRequest.auto_approval_epoch) {
        setImmediate(() => require('./pawaWithdrawalApproval.service').processAutomaticWithdrawals(app)
          .catch((e) => console.error('[guestMaintenance] automation:', e.message)));
      }
    } catch (e) {
      console.error('[guestMaintenance] refund sweep failed for', String(guest._id), e.message);
    }
  }
  return created;
};

const purgeIdleGuests = async () => {
  const cutoff = new Date(Date.now() - IDLE_GUEST_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await User.find({ is_guest: true, createdAt: { $lt: cutoff } }).select('_id').limit(500).lean();
  let removed = 0;
  for (const { _id } of candidates) {
    if (await Order.exists({ customer_id: _id })) continue;
    if (await Transaction.exists({ user_id: _id })) continue;
    const res = await User.deleteOne({ _id, is_guest: true });
    removed += res.deletedCount;
  }
  return removed;
};

let timers = [];
const startGuestMaintenanceWorker = (app) => {
  if (timers.length) return;
  const sweep = () => withLock('worker:guest-refund-sweep', 240, () => sweepGuestRefunds(app))
    .catch((e) => console.error('[guestMaintenance] sweep:', e.message));
  const purge = () => withLock('worker:guest-purge', 3600, () => purgeIdleGuests())
    .catch((e) => console.error('[guestMaintenance] purge:', e.message));
  timers = [setInterval(sweep, SWEEP_MS), setInterval(purge, PURGE_MS)];
  timers.forEach((t) => t.unref?.());
};

module.exports = { sweepGuestRefunds, purgeIdleGuests, startGuestMaintenanceWorker };
