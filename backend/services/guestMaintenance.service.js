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
const MAX_FAILED_PAYOUTS = 3;   // then an admin handles it by hand
const IDLE_GUEST_DAYS = 7;
const SWEEP_MS = 5 * 60 * 1000;
const PURGE_MS = 24 * 60 * 60 * 1000;

/**
 * The number that paid: the latest completed collection's phone. Never the
 * delivery contact, which the buyer types freely (a gift recipient, or a
 * number used to cash out someone else's money).
 */
const guestPhone = async (guestId) => {
  const tx = await Transaction.findOne({
    user_id: guestId, type: { $in: ['payment', 'deposit'] }, status: 'completed', 'metadata.phone': { $nin: [null, ''] },
  }).sort({ createdAt: -1 }).select('metadata.phone').lean();
  return tx?.metadata?.phone || null;
};

const sweepGuestRefunds = async (app = null) => {
  const settings = await PlatformSettings.getSettings();
  if (settings.withdrawals_maintenance_mode) return 0;
  const minimum = Math.max(MIN_REFUND_PAYOUT, Number(settings.min_withdrawal_amount) || 0);
  const guests = await User.find({ is_guest: true, is_active: true, wallet_balance: { $gte: minimum } })
    .select('_id wallet_balance').sort({ updatedAt: 1 }).limit(50).lean();
  let created = 0;
  for (const guest of guests) {
    try {
      const open = await WithdrawalRequest.exists({ requested_by: guest._id, status: { $in: ['pending', 'approved'] } });
      if (open) continue;
      // A number that keeps failing is not retried every 5 minutes forever.
      const failures = await WithdrawalRequest.countDocuments({ requested_by: guest._id, status: { $in: ['failed', 'rejected'] } });
      if (failures >= MAX_FAILED_PAYOUTS) continue;
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
          if (amount < minimum) return;
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
  let removed = 0;
  let after = null;
  // Page by _id: guests that bought stay forever, so a plain limit would rescan them every day.
  for (let page = 0; page < 40; page += 1) {
    const candidates = await User.find({ is_guest: true, createdAt: { $lt: cutoff }, ...(after ? { _id: { $gt: after } } : {}) })
      .select('_id').sort({ _id: 1 }).limit(500).lean();
    if (!candidates.length) break;
    after = candidates[candidates.length - 1]._id;
    for (const { _id } of candidates) {
      if (await Order.exists({ customer_id: _id })) continue;
      if (await Transaction.exists({ user_id: _id })) continue;
      const res = await User.deleteOne({ _id, is_guest: true });
      removed += res.deletedCount;
    }
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
