const mongoose = require('mongoose');
const User = require('../models/User.model');
const UserSubscription = require('../models/UserSubscription.model');
const Plan = require('../models/SubscriptionPlan.model');
const Transaction = require('../models/Transaction.model');
const { creditBalance } = require('./wallet.service');
const { recordAudit } = require('../utils/auditTrail');
const fail = (message, statusCode = 409) => { throw Object.assign(new Error(message), { statusCode }); };

async function updateSubscription({ id, action, note, actorId }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const sub = await UserSubscription.findById(id).session(session);
      if (!sub) fail('Subscription not found.', 404);
      const owner = await User.findOneAndUpdate({ _id: sub.user_id }, { $inc: { subscription_revision: 1 } }, { session });
      if (!owner) fail('Subscription account no longer exists.');
      const before = sub.status;
      if (action === 'refund') {
        if (sub.status === 'refunded') { result = sub; return; }
        if (sub.amount_paid > 0) {
          const payment = await Transaction.findOne({ _id: sub.payment_transaction_id, user_id: sub.user_id,
            type: 'subscription', status: 'completed', currency: 'XAF', amount: sub.amount_paid }).session(session);
          if (!payment) fail('A matching completed XAF payment is required before a wallet refund.');
          const key = 'subscription-refund:' + payment._id;
          const existing = await Transaction.findOne({ idempotency_key: key }).session(session);
          if (!existing) {
            const user = await creditBalance(sub.user_id, payment.amount, session);
            if (!user) fail('Refund account not found.');
            await Transaction.create([{ user_id: sub.user_id, type: 'refund', amount: payment.amount, currency: 'XAF',
              status: 'completed', gateway: 'wallet', reference: 'SUB-REFUND-' + payment._id,
              idempotency_key: key, description: 'Subscription refund to Aura Wallet',
              metadata: { purpose: 'subscription_refund', subscription_id: sub._id, original_transaction_id: payment._id, actor_id: actorId },
            }], { session });
            sub.$locals.refundApplied = true;
          }
        }
        sub.status = 'refunded';
      } else if (action === 'cancel') sub.status = 'cancelled';
      else if (action === 'activate') {
        if (sub.status === 'refunded') fail('A refunded subscription cannot be reactivated. Create a new activation instead.');
        if (sub.expires_at && sub.expires_at <= new Date()) fail('This subscription has expired. Set new dates through manual activation.');
        if (!await Plan.exists({ _id: sub.plan_id }).session(session)) fail('Subscription plan not found.');
        const other = await UserSubscription.findOne({ user_id: sub.user_id, role: sub.role, status: 'active', _id: { $ne: sub._id },
          $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }] }).session(session);
        if (other) fail('Another subscription is already active for this account.');
        sub.status = 'active'; sub.started_at ||= new Date(); sub.limited_since = null; sub.restriction_reason = null;
      }
      sub.history.push({ action, note, by: actorId, at: new Date() });
      await sub.save({ session });
      await recordAudit({ actorId, action: 'subscription_' + action, targetType: 'UserSubscription', targetId: sub._id,
        before: { status: before }, after: { status: sub.status }, session });
      result = sub;
    });
    return result;
  } finally { await session.endSession(); }
}
module.exports = { updateSubscription };
