const path = require('path');
const backendDir = path.resolve(__dirname, '..', 'backend');
module.paths.unshift(path.join(backendDir, 'node_modules'));
require('dotenv').config({ path: path.join(backendDir, '.env') });
const mongoose = require('mongoose');

async function investigate() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require(path.join(backendDir, 'models', 'User.model'));
  const Escrow = require(path.join(backendDir, 'models', 'Escrow.model'));
  const Order = require(path.join(backendDir, 'models', 'Order.model'));
  const Transaction = require(path.join(backendDir, 'models', 'Transaction.model'));
  const Vendor = require(path.join(backendDir, 'models', 'Vendor.model'));

  const user = await User.findOne({ email: 'ashoctavia118@gmail.com' }).select('_id name email wallet_balance role').lean();
  console.log('=== USER ===');
  console.log(JSON.stringify(user, null, 2));

  // Find vendor doc for this user
  const vendor = await Vendor.findOne({ user_id: user._id }).select('_id store_name verified').lean();
  console.log('\n=== VENDOR DOC ===');
  console.log(JSON.stringify(vendor, null, 2));

  if (!vendor) { console.log('No vendor doc found'); await mongoose.disconnect(); return; }

  // Escrows where this vendor is the vendor
  const escrows = await Escrow.find({ vendor_id: vendor._id })
    .populate('order_id', 'order_status payment_status total_amount food_status shipping_method escrow_enabled createdAt delivered_at new_restaurant_hold')
    .populate('buyer_id', 'name email')
    .sort({ createdAt: -1 })
    .lean();
  console.log('\n=== ESCROWS (as vendor) ===');
  console.log('Total:', escrows.length);
  escrows.forEach(e => {
    console.log(JSON.stringify({
      _id: e._id,
      status: e.status,
      amount: e.amount,
      auto_released: e.auto_released,
      released_by: e.released_by,
      customer_confirmed: e.customer_confirmed,
      vendor_confirmed: e.vendor_confirmed,
      logistics_settled: e.logistics_settled,
      createdAt: e.createdAt,
      auto_release_at: e.auto_release_at,
      delivered_at: e.delivered_at,
      release_date: e.release_date,
      order: e.order_id ? {
        _id: e.order_id._id,
        order_status: e.order_id.order_status,
        payment_status: e.order_id.payment_status,
        food_status: e.order_id.food_status,
        total_amount: e.order_id.total_amount,
        escrow_enabled: e.order_id.escrow_enabled,
        new_restaurant_hold: e.order_id.new_restaurant_hold,
        delivered_at: e.order_id.delivered_at,
        createdAt: e.order_id.createdAt,
      } : 'NO ORDER',
      buyer: e.buyer_id ? `${e.buyer_id.name} (${e.buyer_id.email})` : 'N/A',
    }, null, 2));
  });

  // Orders where this vendor is the vendor (non-terminal)
  const stuckOrders = await Order.find({
    vendor_id: vendor._id,
    order_status: { $in: ['placed', 'processing', 'shipped', 'refund_pending', 'delivered'] }
  }).select('_id order_status payment_status payment_method total_amount escrow_enabled food_status new_restaurant_hold delivered_at createdAt customer_id')
    .populate('customer_id', 'name email')
    .sort({ createdAt: -1 }).lean();
  console.log('\n=== NON-TERMINAL ORDERS (as vendor) ===');
  console.log('Total:', stuckOrders.length);
  stuckOrders.forEach(o => console.log(JSON.stringify({
    _id: o._id,
    order_status: o.order_status,
    payment_status: o.payment_status,
    payment_method: o.payment_method,
    total_amount: o.total_amount,
    escrow_enabled: o.escrow_enabled,
    food_status: o.food_status,
    new_restaurant_hold: o.new_restaurant_hold,
    delivered_at: o.delivered_at,
    createdAt: o.createdAt,
    customer: o.customer_id ? `${o.customer_id.name} (${o.customer_id.email})` : 'N/A',
  }, null, 2)));

  // Order status summary (as vendor)
  const orderSummary = await Order.aggregate([
    { $match: { vendor_id: vendor._id } },
    { $group: { _id: '$order_status', count: { $sum: 1 }, totalAmount: { $sum: '$total_amount' } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\n=== ORDER STATUS SUMMARY (as vendor) ===');
  orderSummary.forEach(o => console.log(JSON.stringify(o)));

  // Escrow status summary (as vendor)
  const escrowSummary = await Escrow.aggregate([
    { $match: { vendor_id: vendor._id } },
    { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\n=== ESCROW STATUS SUMMARY (as vendor) ===');
  escrowSummary.forEach(e => console.log(JSON.stringify(e)));

  // Pending payout transactions
  const pendingPayouts = await Transaction.find({
    user_id: user._id,
    status: 'pending',
    type: 'payout'
  }).select('_id type amount status gateway reference description order_id createdAt')
    .populate('order_id', 'order_status payment_status food_status delivered_at')
    .sort({ createdAt: -1 }).lean();
  console.log('\n=== PENDING PAYOUT TRANSACTIONS ===');
  console.log('Total:', pendingPayouts.length);
  pendingPayouts.forEach(t => console.log(JSON.stringify({
    ...t,
    order: t.order_id ? {
      _id: t.order_id._id,
      order_status: t.order_id.order_status,
      payment_status: t.order_id.payment_status,
      food_status: t.order_id.food_status,
      delivered_at: t.order_id.delivered_at,
    } : 'N/A',
  }, null, 2)));

  await mongoose.disconnect();
}
investigate().catch(e => { console.error(e); process.exit(1); });
