const path = require('path');
const backendDir = path.resolve(__dirname, '..', 'backend');
module.paths.unshift(path.join(backendDir, 'node_modules'));
require('dotenv').config({ path: path.join(backendDir, '.env') });
const mongoose = require('mongoose');

async function reconcile() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require(path.join(backendDir, 'models', 'User.model'));
  const Transaction = require(path.join(backendDir, 'models', 'Transaction.model'));
  const Order = require(path.join(backendDir, 'models', 'Order.model'));
  const Vendor = require(path.join(backendDir, 'models', 'Vendor.model'));

  const user = await User.findOne({ email: 'ashoctavia118@gmail.com' }).lean();
  console.log('=== USER ===');
  console.log('ID:', user._id, '| Name:', user.name, '| Balance:', user.wallet_balance);

  // ALL transactions for this user, sorted by date
  const allTxns = await Transaction.find({ user_id: user._id })
    .sort({ createdAt: 1 })
    .lean();

  console.log('\n=== ALL TRANSACTIONS (chronological) ===');
  console.log('Total:', allTxns.length);

  let runningBalance = 0;
  for (const t of allTxns) {
    // Determine if this transaction credits or debits the user's wallet
    let balanceEffect = 0;
    if (t.status === 'completed') {
      if (['deposit', 'refund', 'payout', 'credit'].includes(t.type)) {
        balanceEffect = t.amount; // credits
      } else if (['payment', 'withdrawal'].includes(t.type)) {
        balanceEffect = -t.amount; // debits
      }
    }
    // subscription completed = payment (debit)
    if (t.type === 'subscription' && t.status === 'completed') {
      balanceEffect = -t.amount;
    }

    runningBalance += balanceEffect;

    console.log(JSON.stringify({
      date: t.createdAt,
      type: t.type,
      amount: t.amount,
      status: t.status,
      gateway: t.gateway,
      reference: t.reference,
      description: (t.description || '').substring(0, 80),
      balanceEffect: balanceEffect !== 0 ? (balanceEffect > 0 ? `+${balanceEffect}` : `${balanceEffect}`) : '0 (no effect)',
      runningBalance,
      order_id: t.order_id || null,
    }));
  }

  console.log('\n=== BALANCE RECONCILIATION ===');
  console.log('Calculated balance from transactions:', runningBalance);
  console.log('Actual wallet_balance in DB:', user.wallet_balance);
  console.log('Difference:', user.wallet_balance - runningBalance);

  // Also check completed orders as vendor — how much should they have earned?
  const vendor = await Vendor.findOne({ user_id: user._id }).lean();
  if (vendor) {
    const completedOrders = await Order.find({
      vendor_id: vendor._id,
      order_status: 'completed',
      payment_status: 'paid',
    }).select('_id total_amount subtotal shipping_fee food_status createdAt new_restaurant_hold payment_method').lean();

    console.log('\n=== COMPLETED ORDERS (as vendor) ===');
    console.log('Total:', completedOrders.length);
    let totalEarned = 0;
    completedOrders.forEach(o => {
      console.log(JSON.stringify({
        _id: o._id,
        total_amount: o.total_amount,
        subtotal: o.subtotal,
        shipping_fee: o.shipping_fee,
        food_status: o.food_status,
        new_restaurant_hold: o.new_restaurant_hold,
        payment_method: o.payment_method,
        createdAt: o.createdAt,
      }));
      totalEarned += o.total_amount || 0;
    });
    console.log('Total earned (gross, before fees):', totalEarned);

    // Completed payout transactions
    const completedPayouts = await Transaction.find({
      user_id: user._id,
      type: 'payout',
      status: 'completed',
    }).sort({ createdAt: 1 }).lean();
    console.log('\n=== COMPLETED PAYOUTS ===');
    let totalPaidOut = 0;
    completedPayouts.forEach(t => {
      console.log(JSON.stringify({
        date: t.createdAt,
        amount: t.amount,
        reference: t.reference,
        description: (t.description || '').substring(0, 80),
        order_id: t.order_id,
      }));
      totalPaidOut += t.amount;
    });
    console.log('Total completed payouts:', totalPaidOut);

    // All clawback/payment transactions (debits from vendor)
    const debits = await Transaction.find({
      user_id: user._id,
      type: 'payment',
      status: 'completed',
    }).sort({ createdAt: 1 }).lean();
    console.log('\n=== COMPLETED DEBITS (payment type) ===');
    let totalDebited = 0;
    debits.forEach(t => {
      console.log(JSON.stringify({
        date: t.createdAt,
        amount: t.amount,
        reference: t.reference,
        description: (t.description || '').substring(0, 80),
      }));
      totalDebited += t.amount;
    });
    console.log('Total debited:', totalDebited);

    console.log('\n=== SUMMARY ===');
    console.log('Completed payouts (credits):', totalPaidOut);
    console.log('Completed debits (clawbacks):', totalDebited);
    console.log('Net from payouts:', totalPaidOut - totalDebited);
    console.log('Actual balance:', user.wallet_balance);
  }

  await mongoose.disconnect();
}
reconcile().catch(e => { console.error(e); process.exit(1); });
