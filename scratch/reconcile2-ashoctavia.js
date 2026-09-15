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
  const vendor = await Vendor.findOne({ user_id: user._id }).lean();
  console.log('User:', user._id, '| Balance:', user.wallet_balance);

  // Check the 3 clawback orders — were vendors actually credited?
  const clawbackOrderIds = [
    '6a8b3db6308e021a99946297', // Clawback 2000
    '6a8b3e08308e021a999462b8', // Clawback 500
    '6a91b9810f7918c7033e91c1', // Clawback 500
  ];

  console.log('\n=== CLAWBACK ORDER DETAILS ===');
  for (const oid of clawbackOrderIds) {
    const order = await Order.findById(oid).select('_id total_amount subtotal shipping_fee order_status payment_status food_status new_restaurant_hold payment_method createdAt').lean();
    console.log(JSON.stringify(order, null, 2));
  }

  // Check: was the vendor ever CREDITED for these orders? (completed payout)
  console.log('\n=== ALL PAYOUT TXNS FOR CLAWBACK ORDERS ===');
  for (const oid of clawbackOrderIds) {
    const txns = await Transaction.find({ order_id: oid, user_id: user._id }).lean();
    txns.forEach(t => console.log(JSON.stringify({
      order_id: oid,
      type: t.type,
      amount: t.amount,
      status: t.status,
      reference: t.reference,
      description: (t.description || '').substring(0, 100),
      createdAt: t.createdAt,
    })));
  }

  // What should the correct balance be?
  // Credits: completed payouts where vendor actually received money
  const completedPayouts = await Transaction.find({
    user_id: user._id,
    type: 'payout',
    status: 'completed',
  }).lean();
  const totalCredits = completedPayouts.reduce((s, t) => s + t.amount, 0);

  // Debits: completed payments/clawbacks/subscriptions that actually debited wallet
  // Note: subscriptions via external gateways (payunit) do NOT debit wallet
  const completedDebits = await Transaction.find({
    user_id: user._id,
    type: 'payment',
    status: 'completed',
  }).lean();
  const totalDebits = completedDebits.reduce((s, t) => s + t.amount, 0);

  // Check for any wallet deposits
  const deposits = await Transaction.find({
    user_id: user._id,
    type: 'deposit',
    status: 'completed',
  }).lean();
  const totalDeposits = deposits.reduce((s, t) => s + t.amount, 0);

  // Check for any wallet withdrawals
  const withdrawals = await Transaction.find({
    user_id: user._id,
    type: 'withdrawal',
    status: 'completed',
  }).lean();
  const totalWithdrawals = withdrawals.reduce((s, t) => s + t.amount, 0);

  console.log('\n=== CORRECT BALANCE CALCULATION ===');
  console.log('Completed payouts (credited to wallet):', totalCredits);
  console.log('Completed debits/clawbacks (debited from wallet):', totalDebits);
  console.log('Completed deposits:', totalDeposits);
  console.log('Completed withdrawals:', totalWithdrawals);

  const correctBalance = totalCredits - totalDebits + totalDeposits - totalWithdrawals;
  console.log('Calculated balance:', correctBalance);
  console.log('Actual DB balance:', user.wallet_balance);
  console.log('Adjustment needed:', correctBalance < user.wallet_balance ? 'None (DB is higher)' : `+${correctBalance - user.wallet_balance}`);

  // Now identify which clawbacks were bogus (new_restaurant_hold = vendor never credited)
  console.log('\n=== BOGUS CLAWBACK ANALYSIS ===');
  let bogusTotal = 0;
  for (const debit of completedDebits) {
    if (!debit.order_id) continue;
    const order = await Order.findById(debit.order_id).select('new_restaurant_hold total_amount').lean();
    if (order && order.new_restaurant_hold) {
      // Check if vendor was ever credited for this order
      const creditForOrder = await Transaction.findOne({
        user_id: user._id,
        order_id: debit.order_id,
        type: 'payout',
        status: 'completed',
      }).lean();
      if (!creditForOrder) {
        console.log(`BOGUS: Clawback of ${debit.amount} for Order ${debit.order_id} (new_restaurant_hold, vendor never credited)`);
        console.log(`  Order total: ${order.total_amount}, Ref: ${debit.reference}`);
        bogusTotal += debit.amount;
      }
    }
  }
  console.log('Total bogus clawbacks:', bogusTotal);
  console.log('Vendor should be reimbursed:', bogusTotal);
  console.log('Correct balance:', user.wallet_balance + bogusTotal);

  await mongoose.disconnect();
}
reconcile().catch(e => { console.error(e); process.exit(1); });
