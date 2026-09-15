const path = require('path');
const backendDir = path.resolve(__dirname, '..', 'backend');
// Prepend backend node_modules so require() finds dotenv, mongoose, etc.
module.paths.unshift(path.join(backendDir, 'node_modules'));
require('dotenv').config({ path: path.join(backendDir, '.env') });
const mongoose = require('mongoose');

async function investigate() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require(path.join(backendDir, 'models', 'User.model'));
  const Escrow = require(path.join(backendDir, 'models', 'Escrow.model'));
  const Order = require(path.join(backendDir, 'models', 'Order.model'));
  const Transaction = require(path.join(backendDir, 'models', 'Transaction.model'));

  // 1. Find user
  const user = await User.findOne({ email: 'ashoctavia118@gmail.com' }).select('_id name email wallet_balance role').lean();
  if (!user) { console.log('User not found'); process.exit(0); }
  console.log('=== USER ===');
  console.log(JSON.stringify(user, null, 2));

  // 2. All escrows where this user is buyer
  const escrows = await Escrow.find({ buyer_id: user._id })
    .populate('order_id', 'order_status payment_status total_amount food_status createdAt')
    .populate('vendor_id', 'store_name')
    .sort({ createdAt: -1 })
    .lean();
  console.log('\n=== ESCROWS (buyer) ===');
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
      order: e.order_id ? {
        _id: e.order_id._id,
        order_status: e.order_id.order_status,
        payment_status: e.order_id.payment_status,
        food_status: e.order_id.food_status,
        total_amount: e.order_id.total_amount,
        createdAt: e.order_id.createdAt,
      } : 'NO ORDER',
      vendor: e.vendor_id?.store_name || 'N/A',
    }, null, 2));
  });

  // 3. Orders with non-terminal statuses
  const orders = await Order.find({
    customer_id: user._id,
    order_status: { $in: ['placed', 'processing', 'shipped', 'refund_pending'] }
  }).select('_id order_status payment_status payment_method total_amount escrow_enabled food_status createdAt').sort({ createdAt: -1 }).lean();
  console.log('\n=== STUCK ORDERS (non-terminal) ===');
  console.log('Total:', orders.length);
  orders.forEach(o => console.log(JSON.stringify(o, null, 2)));

  // 4. Transactions with pending/failed
  const txns = await Transaction.find({
    user_id: user._id,
    status: { $in: ['pending', 'failed'] }
  }).select('_id type amount status gateway reference description createdAt').sort({ createdAt: -1 }).lean();
  console.log('\n=== PENDING/FAILED TRANSACTIONS ===');
  console.log('Total:', txns.length);
  txns.forEach(t => console.log(JSON.stringify(t, null, 2)));

  // 5. Summary of all orders
  const allOrders = await Order.aggregate([
    { $match: { customer_id: user._id } },
    { $group: { _id: '$order_status', count: { $sum: 1 }, totalAmount: { $sum: '$total_amount' } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\n=== ORDER STATUS SUMMARY ===');
  allOrders.forEach(o => console.log(JSON.stringify(o)));

  // 6. Escrow summary
  const escrowSummary = await Escrow.aggregate([
    { $match: { buyer_id: user._id } },
    { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    { $sort: { count: -1 } }
  ]);
  console.log('\n=== ESCROW STATUS SUMMARY ===');
  escrowSummary.forEach(e => console.log(JSON.stringify(e)));

  await mongoose.disconnect();
}
investigate().catch(e => { console.error(e); process.exit(1); });
