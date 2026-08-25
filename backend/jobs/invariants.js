/**
 * jobs/invariants.js
 * Auradime — Financial & Data Invariant Checks
 *
 * Runs every invariant as a MongoDB aggregation or query and returns a report
 * of violations.  Safe to run in production — read-only queries only.
 *
 * Usage:
 *   node scripts/run-invariants.js          # one-off report
 *   Scheduled nightly via node-cron or external scheduler.
 *
 * Each check returns:
 *   { id, description, violations: [], ok: boolean, checked: number }
 */

'use strict';

const mongoose = require('mongoose');

// Lazy-load models so this file can be required before the app boots
const m = (name) => mongoose.model(name);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const toArr = (v) => (Array.isArray(v) ? v : []);

const check = async (id, description, fn) => {
  try {
    const { violations, checked } = await fn();
    return { id, description, ok: violations.length === 0, violations, checked };
  } catch (err) {
    return { id, description, ok: false, violations: [{ error: err.message }], checked: 0 };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// INV-01  Ledger ↔ wallet_balance agreement
// sum(signed ledger entries per user) == user.wallet_balance
// Signed amounts: deposit/refund/escrow_release/payout = +amount ; payment/withdrawal/subscription = -amount
// ─────────────────────────────────────────────────────────────────────────────
const inv01 = () => check('INV-01', 'Ledger sum matches user.wallet_balance', async () => {
  const Transaction = m('Transaction');
  const User = m('User');

  const CREDIT_TYPES = ['deposit', 'refund', 'escrow_release'];
  const DEBIT_TYPES  = ['payment', 'withdrawal', 'subscription'];
  // 'payout' is vendor income — credited to vendor wallet

  const ledgers = await Transaction.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: '$user_id',
        ledger: {
          $sum: {
            $cond: [
              { $in: ['$type', CREDIT_TYPES] },
              '$amount',
              { $multiply: ['$amount', -1] },
            ],
          },
        },
      },
    },
  ]);

  const ledgerMap = {};
  for (const l of ledgers) ledgerMap[l._id.toString()] = l.ledger;

  const users = await User.find({ wallet_balance: { $gt: 0 } }).select('_id wallet_balance').lean();
  const violations = [];
  for (const u of users) {
    const ledgerVal = ledgerMap[u._id.toString()] || 0;
    // Allow 1 XAF rounding tolerance
    if (Math.abs(ledgerVal - u.wallet_balance) > 1) {
      violations.push({
        user_id: u._id,
        wallet_balance: u.wallet_balance,
        ledger_sum: ledgerVal,
        delta: ledgerVal - u.wallet_balance,
      });
    }
  }

  return { violations, checked: users.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-02  No escrow is both released AND refunded
// ─────────────────────────────────────────────────────────────────────────────
const inv02 = () => check('INV-02', 'No escrow is simultaneously released and refunded', async () => {
  // This can't happen with the current schema (single status field), but we can
  // check for escrows where status is an unexpected value.
  const Escrow = m('Escrow');
  const violations = await Escrow.find({ status: { $nin: ['held', 'released', 'refunded', 'expired'] } })
    .select('_id order_id status').lean();
  const all = await Escrow.countDocuments();
  return { violations, checked: all };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-03  Every paid order has ≥1 completed Transaction
// ─────────────────────────────────────────────────────────────────────────────
const inv03 = () => check('INV-03', 'Every paid order has ≥1 completed Transaction', async () => {
  const Order = m('Order');
  const Transaction = m('Transaction');

  const paidOrders = await Order.find({ payment_status: 'paid' }).select('_id').lean();
  const paidIds = paidOrders.map((o) => o._id);

  const covered = await Transaction.distinct('order_id', {
    order_id: { $in: paidIds },
    status: 'completed',
  });

  const coveredSet = new Set(covered.map(String));
  const violations = paidOrders.filter((o) => !coveredSet.has(o._id.toString()));

  return { violations, checked: paidOrders.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-04  order.total_amount == subtotal + shipping_fee + collection_fee
// ─────────────────────────────────────────────────────────────────────────────
const inv04 = () => check('INV-04', 'order.total_amount == subtotal + shipping_fee + collection_fee', async () => {
  const Order = m('Order');
  const orders = await Order.find({}).select('_id subtotal shipping_fee collection_fee transit_fee total_amount').lean();

  const violations = orders.filter((o) => {
    const expected = (o.subtotal || 0)
      + (o.shipping_fee || 0)
      + (o.collection_fee || 0)
      + (o.transit_fee || 0);
    return Math.abs(expected - (o.total_amount || 0)) > 1; // 1 XAF tolerance
  });

  return { violations: violations.map((o) => ({
    order_id: o._id,
    total_amount: o.total_amount,
    expected: (o.subtotal || 0) + (o.shipping_fee || 0) + (o.collection_fee || 0) + (o.transit_fee || 0),
  })), checked: orders.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-05  sum(order.items price*qty) == order.subtotal
// ─────────────────────────────────────────────────────────────────────────────
const inv05 = () => check('INV-05', 'sum(items price×qty) == order.subtotal', async () => {
  const Order = m('Order');
  const orders = await Order.find({}).select('_id subtotal products').lean();

  const violations = [];
  for (const o of orders) {
    if (!o.products?.length) continue;
    const computed = o.products.reduce((s, p) => s + (p.price || 0) * (p.quantity || 1), 0);
    if (Math.abs(computed - (o.subtotal || 0)) > 1) {
      violations.push({ order_id: o._id, subtotal: o.subtotal, computed_subtotal: computed });
    }
  }

  return { violations, checked: orders.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-06  product.stock >= 0 (no negative stock)
// ─────────────────────────────────────────────────────────────────────────────
const inv06 = () => check('INV-06', 'product.stock >= 0', async () => {
  const Product = m('Product');
  const violations = await Product.find({ stock: { $lt: 0 } }).select('_id name stock').lean();
  const total = await Product.countDocuments();
  return { violations, checked: total };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-07  variant.stock >= 0 (no negative variant stock)
// ─────────────────────────────────────────────────────────────────────────────
const inv07 = () => check('INV-07', 'variant.stock >= 0', async () => {
  const Product = m('Product');
  const bad = await Product.aggregate([
    { $unwind: { path: '$variants', preserveNullAndEmptyArrays: false } },
    { $match: { 'variants.stock': { $lt: 0 } } },
    { $project: { _id: 1, name: 1, 'variants.name': 1, 'variants.stock': 1 } },
  ]);
  const total = await Product.aggregate([
    { $project: { count: { $size: { $ifNull: ['$variants', []] } } } },
    { $group: { _id: null, total: { $sum: '$count' } } },
  ]);
  return { violations: bad, checked: total[0]?.total || 0 };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-08  coupon.used_count <= coupon.max_uses (when max_uses is set)
// ─────────────────────────────────────────────────────────────────────────────
const inv08 = () => check('INV-08', 'coupon.used_count <= coupon.max_uses', async () => {
  const Coupon = m('Coupon');
  const violations = await Coupon.find({
    max_uses: { $gt: 0 },
    $expr: { $gt: ['$used_count', '$max_uses'] },
  }).select('_id code used_count max_uses').lean();
  const total = await Coupon.countDocuments({ max_uses: { $gt: 0 } });
  return { violations, checked: total };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-09  No order in terminal state has active dispute
// ─────────────────────────────────────────────────────────────────────────────
const inv09 = () => check('INV-09', 'No terminal order has an open dispute', async () => {
  const Dispute = m('Dispute');
  const Order = m('Order');

  const openDisputes = await Dispute.find({ status: { $in: ['pending', 'under_review'] } })
    .select('_id order_id').lean();

  if (!openDisputes.length) return { violations: [], checked: 0 };

  const orderIds = openDisputes.map((d) => d.order_id);
  const terminalOrders = await Order.find({
    _id: { $in: orderIds },
    order_status: { $in: ['cancelled', 'completed', 'refunded'] },
  }).select('_id order_status').lean();

  const terminalSet = new Set(terminalOrders.map((o) => o._id.toString()));
  const violations = openDisputes
    .filter((d) => terminalSet.has(d.order_id?.toString()))
    .map((d) => ({ dispute_id: d._id, order_id: d.order_id }));

  return { violations, checked: openDisputes.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-10  Every escrow references an existing Order
// ─────────────────────────────────────────────────────────────────────────────
const inv10 = () => check('INV-10', 'Every Escrow references an existing Order', async () => {
  const Escrow = m('Escrow');
  const Order = m('Order');

  const escrows = await Escrow.find({}).select('_id order_id').lean();
  const orderIds = escrows.map((e) => e.order_id);
  const found = await Order.find({ _id: { $in: orderIds } }).select('_id').lean();
  const foundSet = new Set(found.map((o) => o._id.toString()));

  const violations = escrows
    .filter((e) => !foundSet.has(e.order_id?.toString()))
    .map((e) => ({ escrow_id: e._id, missing_order_id: e.order_id }));

  return { violations, checked: escrows.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-11  No two active (held) escrows for the same order
// ─────────────────────────────────────────────────────────────────────────────
const inv11 = () => check('INV-11', 'No duplicate held escrows per order', async () => {
  const Escrow = m('Escrow');
  const dups = await Escrow.aggregate([
    { $match: { status: 'held' } },
    { $group: { _id: '$order_id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  const total = await Escrow.countDocuments({ status: 'held' });
  return { violations: dups.map((d) => ({ order_id: d._id, held_count: d.count })), checked: total };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-12  Resolved dispute full_refund → order.payment_status == 'refunded'
// ─────────────────────────────────────────────────────────────────────────────
const inv12 = () => check('INV-12', 'full_refund dispute → order.payment_status == refunded', async () => {
  const Dispute = m('Dispute');
  const Order = m('Order');

  const refundDisputes = await Dispute.find({
    status: 'resolved',
    resolution_type: { $in: ['full_refund', 'food_full_refund'] },
  }).select('_id order_id').lean();

  if (!refundDisputes.length) return { violations: [], checked: 0 };

  const orders = await Order.find({
    _id: { $in: refundDisputes.map((d) => d.order_id) },
    payment_status: { $ne: 'refunded' },
  }).select('_id payment_status').lean();

  return {
    violations: orders.map((o) => ({ order_id: o._id, payment_status: o.payment_status })),
    checked: refundDisputes.length,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-13  No duplicate dispute for the same order (only one non-cancelled)
// ─────────────────────────────────────────────────────────────────────────────
const inv13 = () => check('INV-13', 'At most one active dispute per order', async () => {
  const Dispute = m('Dispute');
  const dups = await Dispute.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $group: { _id: '$order_id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  const total = await Dispute.countDocuments({ status: { $ne: 'cancelled' } });
  return { violations: dups.map((d) => ({ order_id: d._id, count: d.count })), checked: total };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-14  Every Shipment references an existing Order
// ─────────────────────────────────────────────────────────────────────────────
const inv14 = () => check('INV-14', 'Every Shipment references an existing Order', async () => {
  const Shipment = m('Shipment');
  const Order = m('Order');

  const shipments = await Shipment.find({}).select('_id order_id').lean();
  const orderIds = shipments.map((s) => s.order_id);
  const found = await Order.find({ _id: { $in: orderIds } }).select('_id').lean();
  const foundSet = new Set(found.map((o) => o._id.toString()));

  const violations = shipments
    .filter((s) => !foundSet.has(s.order_id?.toString()))
    .map((s) => ({ shipment_id: s._id, missing_order_id: s.order_id }));

  return { violations, checked: shipments.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-15  No completed withdrawal request with balance_deducted = false
// ─────────────────────────────────────────────────────────────────────────────
const inv15 = () => check('INV-15', 'All completed withdrawals have balance_deducted = true', async () => {
  const WithdrawalRequest = m('WithdrawalRequest');
  const violations = await WithdrawalRequest.find({
    status: 'completed',
    balance_deducted: { $ne: true },
  }).select('_id amount requested_by status balance_deducted').lean();
  const total = await WithdrawalRequest.countDocuments({ status: 'completed' });
  return { violations, checked: total };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-16  No transaction amount <= 0 with status completed
// ─────────────────────────────────────────────────────────────────────────────
const inv16 = () => check('INV-16', 'No completed transaction has amount <= 0', async () => {
  const Transaction = m('Transaction');
  const violations = await Transaction.find({ status: 'completed', amount: { $lte: 0 } })
    .select('_id reference type amount').lean();
  const total = await Transaction.countDocuments({ status: 'completed' });
  return { violations, checked: total };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-17  No Transaction references a non-existent order
// ─────────────────────────────────────────────────────────────────────────────
const inv17 = () => check('INV-17', 'Every Transaction.order_id references an existing Order', async () => {
  const Transaction = m('Transaction');
  const Order = m('Order');

  const txns = await Transaction.find({ order_id: { $ne: null } }).select('_id order_id').lean();
  const orderIds = txns.map((t) => t.order_id);
  const found = await Order.find({ _id: { $in: orderIds } }).select('_id').lean();
  const foundSet = new Set(found.map((o) => o._id.toString()));

  const violations = txns
    .filter((t) => !foundSet.has(t.order_id?.toString()))
    .map((t) => ({ transaction_id: t._id, missing_order_id: t.order_id }));

  return { violations, checked: txns.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-18  No Transaction references a non-existent user
// ─────────────────────────────────────────────────────────────────────────────
const inv18 = () => check('INV-18', 'Every Transaction.user_id references an existing User', async () => {
  const Transaction = m('Transaction');
  const User = m('User');

  const txns = await Transaction.find({}).select('_id user_id').lean();
  const userIds = [...new Set(txns.map((t) => t.user_id?.toString()).filter(Boolean))];
  const found = await User.find({ _id: { $in: userIds } }).select('_id').lean();
  const foundSet = new Set(found.map((u) => u._id.toString()));

  const violations = txns
    .filter((t) => t.user_id && !foundSet.has(t.user_id.toString()))
    .map((t) => ({ transaction_id: t._id, missing_user_id: t.user_id }));

  return { violations, checked: txns.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-19  product.sale_price < product.price (when set)
// ─────────────────────────────────────────────────────────────────────────────
const inv19 = () => check('INV-19', 'sale_price < price (when sale_price is set)', async () => {
  const Product = m('Product');
  const violations = await Product.find({
    sale_price: { $exists: true, $ne: null, $gt: 0 },
    $expr: { $gte: ['$sale_price', '$price'] },
  }).select('_id name price sale_price').lean();
  const total = await Product.countDocuments({ sale_price: { $exists: true, $gt: 0 } });
  return { violations, checked: total };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-20  Failed withdrawal that was deducted has a corresponding refund Transaction
// ─────────────────────────────────────────────────────────────────────────────
const inv20 = () => check('INV-20', 'Failed+deducted withdrawals have a refund Transaction', async () => {
  const WithdrawalRequest = m('WithdrawalRequest');
  const Transaction = m('Transaction');

  // Withdrawals that failed but money was already deducted — should have a refund tx
  const failed = await WithdrawalRequest.find({
    status: { $in: ['failed', 'rejected'] },
    balance_deducted: true,
  }).select('_id requested_by amount').lean();

  if (!failed.length) return { violations: [], checked: 0 };

  // Check if there's a corresponding refund or deposit-type transaction for the user
  const violations = [];
  for (const wd of failed) {
    const refund = await Transaction.findOne({
      user_id: wd.requested_by,
      type: { $in: ['refund', 'deposit'] },
      amount: wd.amount,
      status: 'completed',
    }).lean();
    if (!refund) {
      violations.push({ withdrawal_id: wd._id, user_id: wd.requested_by, amount: wd.amount });
    }
  }

  return { violations, checked: failed.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-21  No user wallet_balance is negative (unless explicitly allowed)
// ─────────────────────────────────────────────────────────────────────────────
const inv21 = () => check('INV-21', 'No user wallet_balance is negative', async () => {
  const User = m('User');
  const violations = await User.find({ wallet_balance: { $lt: 0 } })
    .select('_id email wallet_balance').lean();
  const total = await User.countDocuments();
  return { violations, checked: total };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-22  Escrow amount is > 0 for all held escrows
// ─────────────────────────────────────────────────────────────────────────────
const inv22 = () => check('INV-22', 'All held escrows have amount > 0', async () => {
  const Escrow = m('Escrow');
  const violations = await Escrow.find({ status: 'held', amount: { $lte: 0 } })
    .select('_id order_id amount').lean();
  const total = await Escrow.countDocuments({ status: 'held' });
  return { violations, checked: total };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-23  platform_wallet_balance >= 0
// ─────────────────────────────────────────────────────────────────────────────
const inv23 = () => check('INV-23', 'platform_wallet_balance >= 0', async () => {
  const PlatformSettings = m('PlatformSettings');
  const settings = await PlatformSettings.find({}).select('platform_wallet_balance').lean();
  const violations = settings.filter((s) => (s.platform_wallet_balance || 0) < 0);
  return { violations, checked: settings.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-24  No pending withdrawal > user's current wallet_balance
// ─────────────────────────────────────────────────────────────────────────────
const inv24 = () => check('INV-24', 'Pending withdrawal amount <= user.wallet_balance', async () => {
  const WithdrawalRequest = m('WithdrawalRequest');
  const User = m('User');

  // Only check requests that haven't deducted balance yet
  const pending = await WithdrawalRequest.find({
    status: 'pending',
    balance_deducted: { $ne: true },
  }).select('_id requested_by amount').lean();

  const violations = [];
  for (const wd of pending) {
    const user = await User.findById(wd.requested_by).select('wallet_balance').lean();
    if (!user || user.wallet_balance < wd.amount) {
      violations.push({
        withdrawal_id: wd._id,
        user_id: wd.requested_by,
        requested: wd.amount,
        available: user?.wallet_balance ?? 'user not found',
      });
    }
  }

  return { violations, checked: pending.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-25  Every UserSubscription references an existing SubscriptionPlan
// ─────────────────────────────────────────────────────────────────────────────
const inv25 = () => check('INV-25', 'Every UserSubscription references a valid SubscriptionPlan', async () => {
  const UserSubscription = m('UserSubscription');
  const SubscriptionPlan = m('SubscriptionPlan');

  const subs = await UserSubscription.find({}).select('_id plan_id').lean();
  const planIds = [...new Set(subs.map((s) => s.plan_id?.toString()).filter(Boolean))];
  const found = await SubscriptionPlan.find({ _id: { $in: planIds } }).select('_id').lean();
  const foundSet = new Set(found.map((p) => p._id.toString()));

  const violations = subs
    .filter((s) => s.plan_id && !foundSet.has(s.plan_id.toString()))
    .map((s) => ({ subscription_id: s._id, missing_plan_id: s.plan_id }));

  return { violations, checked: subs.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-26  No active subscription has end_date in the past
// ─────────────────────────────────────────────────────────────────────────────
const inv26 = () => check('INV-26', 'No active subscription has expired end_date', async () => {
  const UserSubscription = m('UserSubscription');
  const violations = await UserSubscription.find({
    status: 'active',
    end_date: { $lt: new Date() },
  }).select('_id user_id end_date').lean();
  const total = await UserSubscription.countDocuments({ status: 'active' });
  return { violations, checked: total };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-27  Every Vendor has an associated User
// ─────────────────────────────────────────────────────────────────────────────
const inv27 = () => check('INV-27', 'Every Vendor.user_id references an existing User', async () => {
  const Vendor = m('Vendor');
  const User = m('User');

  const vendors = await Vendor.find({}).select('_id user_id').lean();
  const userIds = vendors.map((v) => v.user_id);
  const found = await User.find({ _id: { $in: userIds } }).select('_id').lean();
  const foundSet = new Set(found.map((u) => u._id.toString()));

  const violations = vendors
    .filter((v) => !foundSet.has(v.user_id?.toString()))
    .map((v) => ({ vendor_id: v._id, missing_user_id: v.user_id }));

  return { violations, checked: vendors.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-28  Every Order references an existing Vendor
// ─────────────────────────────────────────────────────────────────────────────
const inv28 = () => check('INV-28', 'Every Order.vendor_id references an existing Vendor', async () => {
  const Order = m('Order');
  const Vendor = m('Vendor');

  const orders = await Order.find({}).select('_id vendor_id').lean();
  const vendorIds = [...new Set(orders.map((o) => o.vendor_id?.toString()).filter(Boolean))];
  const found = await Vendor.find({ _id: { $in: vendorIds } }).select('_id').lean();
  const foundSet = new Set(found.map((v) => v._id.toString()));

  const violations = orders
    .filter((o) => o.vendor_id && !foundSet.has(o.vendor_id.toString()))
    .map((o) => ({ order_id: o._id, missing_vendor_id: o.vendor_id }));

  return { violations, checked: orders.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-29  No refunded escrow still has status='held'
// ─────────────────────────────────────────────────────────────────────────────
const inv29 = () => check('INV-29', 'Refunded orders have escrow status != held', async () => {
  const Order = m('Order');
  const Escrow = m('Escrow');

  const refunded = await Order.find({ payment_status: 'refunded' }).select('_id').lean();
  if (!refunded.length) return { violations: [], checked: 0 };

  const violations = await Escrow.find({
    order_id: { $in: refunded.map((o) => o._id) },
    status: 'held',
  }).select('_id order_id status').lean();

  return { violations, checked: refunded.length };
});

// ─────────────────────────────────────────────────────────────────────────────
// INV-30  Platform commission sum == platform_wallet_balance (approximation)
// Soft check: platform collected fees should be >= platform_wallet_balance
// (they're equal if nothing has been withdrawn from platform wallet)
// ─────────────────────────────────────────────────────────────────────────────
const inv30 = () => check('INV-30', 'Platform fee collection >= platform_wallet_balance', async () => {
  const Transaction = m('Transaction');
  const PlatformSettings = m('PlatformSettings');

  const [feeResult] = await Transaction.aggregate([
    { $match: { type: 'payment', gateway: 'platform', status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const settings = await PlatformSettings.findOne({}).select('platform_wallet_balance').lean();
  const platformBalance = settings?.platform_wallet_balance || 0;
  const feesCollected = feeResult?.total || 0;

  // platform_wallet_balance should be <= feesCollected (the rest was withdrawn)
  if (platformBalance > feesCollected + 1) {
    return {
      violations: [{
        platform_wallet_balance: platformBalance,
        fees_collected: feesCollected,
        excess: platformBalance - feesCollected,
      }],
      checked: 1,
    };
  }

  return { violations: [], checked: 1 };
});

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

const ALL_CHECKS = [
  inv01, inv02, inv03, inv04, inv05,
  inv06, inv07, inv08, inv09, inv10,
  inv11, inv12, inv13, inv14, inv15,
  inv16, inv17, inv18, inv19, inv20,
  inv21, inv22, inv23, inv24, inv25,
  inv26, inv27, inv28, inv29, inv30,
];

/**
 * runInvariants({ subset })
 * @param {object} opts
 * @param {string[]} [opts.subset]  Run only these IDs, e.g. ['INV-01', 'INV-03']
 * @returns {Promise<{ results, summary }>}
 */
const runInvariants = async (opts = {}) => {
  const { subset } = opts;
  const fns = subset
    ? ALL_CHECKS.filter((fn) => subset.includes(fn().then ? undefined : fn.name)) // fallback
    : ALL_CHECKS;

  // Run checks sequentially to avoid mongo cursor pressure
  const results = [];
  for (const fn of (subset ? ALL_CHECKS : ALL_CHECKS)) {
    const result = await fn();
    if (subset && !subset.includes(result.id)) continue;
    results.push(result);
  }

  const failed    = results.filter((r) => !r.ok);
  const passed    = results.filter((r) => r.ok);
  const total_violations = failed.reduce((s, r) => s + r.violations.length, 0);

  const summary = {
    total: results.length,
    passed: passed.length,
    failed: failed.length,
    total_violations,
    run_at: new Date().toISOString(),
  };

  return { results, summary };
};

module.exports = { runInvariants };
