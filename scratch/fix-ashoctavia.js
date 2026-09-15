const path = require('path');
const backendDir = path.resolve(__dirname, '..', 'backend');
module.paths.unshift(path.join(backendDir, 'node_modules'));
require('dotenv').config({ path: path.join(backendDir, '.env') });
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require(path.join(backendDir, 'models', 'User.model'));
  const Escrow = require(path.join(backendDir, 'models', 'Escrow.model'));
  const Order = require(path.join(backendDir, 'models', 'Order.model'));
  const Transaction = require(path.join(backendDir, 'models', 'Transaction.model'));
  const Vendor = require(path.join(backendDir, 'models', 'Vendor.model'));

  const user = await User.findOne({ email: 'ashoctavia118@gmail.com' }).select('_id wallet_balance').lean();
  const vendor = await Vendor.findOne({ user_id: user._id }).select('_id').lean();
  console.log('User:', user._id, 'wallet_balance:', user.wallet_balance);
  console.log('Vendor:', vendor._id);

  // ─── FIX 1: Mark 3 orphaned pending payout txns as failed ───────────
  // These payouts are for orders that are already refunded (food_status: timed_out)
  const orphanedTxnIds = [
    '6a91b9830f7918c7033e91c5', // Order #3E91C1 - refunded
    '6a8b3e09308e021a99946448', // Wait - let me double check these IDs
    '6a8b3db7308e021a9994629b', // Order #946297 - refunded
  ];

  // Actually, let me query properly to be safe — find all pending payout txns
  // for this user, then check if their orders are refunded/cancelled
  const pendingPayouts = await Transaction.find({
    user_id: user._id,
    status: 'pending',
    type: 'payout',
  }).lean();

  console.log('\n=== PENDING PAYOUTS TO CHECK ===');
  const toFail = [];
  for (const txn of pendingPayouts) {
    // Extract order_id from the transaction
    let orderId = txn.order_id;
    if (!orderId && txn.reference) {
      // Try to find order from reference pattern like "PAYOUT-HELD-...-XXXXXX"
      // or "IN-AURA-ESCROW-..."
    }

    let order = null;
    if (orderId) {
      order = await Order.findById(orderId).select('_id order_status payment_status food_status').lean();
    }

    const orderStatus = order ? order.order_status : 'NO ORDER LINKED';
    const isTerminal = order && ['refunded', 'cancelled', 'completed'].includes(order.order_status);
    const shouldFail = order && ['refunded', 'cancelled'].includes(order.order_status);

    console.log({
      txn_id: txn._id,
      amount: txn.amount,
      reference: txn.reference,
      order_id: orderId || 'NONE',
      order_status: orderStatus,
      food_status: order?.food_status || 'N/A',
      shouldFail,
    });

    if (shouldFail) {
      toFail.push(txn._id);
    }
  }

  console.log('\n=== MARKING ORPHANED PAYOUTS AS FAILED ===');
  console.log('Count:', toFail.length);
  if (toFail.length > 0) {
    const result = await Transaction.updateMany(
      { _id: { $in: toFail }, status: 'pending' },
      { $set: { status: 'failed', description_suffix: ' [auto-cleaned: order already refunded/cancelled]' } }
    );
    // description_suffix won't work, let's update individually
    for (const txnId of toFail) {
      const txn = await Transaction.findById(txnId);
      if (txn && txn.status === 'pending') {
        txn.status = 'failed';
        txn.description = (txn.description || '') + ' [auto-cleaned: order already refunded/cancelled]';
        await txn.save();
        console.log('  Failed:', txnId.toString());
      }
    }
  }

  // ─── FIX 2: Handle stuck order #79F2B8 (processing 16 days) ────────
  // This order: processing, paid, food_status: awaiting_payment, new_restaurant_hold=true
  // Created Aug 23 — clearly abandoned. The buyer paid but the restaurant never accepted.
  // We need to refund the buyer.
  const stuckOrderId = '6a8b44081cc31a4be579f2b8';
  const stuckOrder = await Order.findById(stuckOrderId).lean();

  if (stuckOrder && stuckOrder.order_status === 'processing') {
    console.log('\n=== FIXING STUCK ORDER #79F2B8 ===');
    console.log('Current status:', stuckOrder.order_status, stuckOrder.payment_status);
    console.log('Total amount:', stuckOrder.total_amount);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Refund escrow
      const escrow = await Escrow.findOne({ order_id: stuckOrderId });
      if (escrow && escrow.status === 'held') {
        escrow.status = 'refunded';
        escrow.refund_reason = 'Order stuck in processing for 16 days — restaurant never accepted. Auto-cleanup.';
        escrow.released_by = 'admin';
        await escrow.save({ session });
        console.log('  Escrow refunded:', escrow._id.toString());
      } else {
        console.log('  Escrow status:', escrow?.status || 'NOT FOUND');
      }

      // 2. Refund buyer wallet
      const refundAmount = stuckOrder.total_amount || (escrow ? escrow.amount : 0);
      if (refundAmount > 0 && stuckOrder.payment_status === 'paid') {
        await User.findByIdAndUpdate(
          stuckOrder.customer_id,
          { $inc: { wallet_balance: refundAmount } },
          { session }
        );
        console.log('  Buyer wallet credited:', refundAmount, 'to', stuckOrder.customer_id.toString());

        // 3. Create refund transaction for buyer
        await Transaction.create([{
          user_id: stuckOrder.customer_id,
          type: 'refund',
          amount: refundAmount,
          status: 'completed',
          gateway: 'wallet',
          reference: `REFUND-CLEANUP-${stuckOrderId.slice(-6).toUpperCase()}`,
          description: `Refund for stuck Order #${stuckOrderId.slice(-6).toUpperCase()} (restaurant never accepted, auto-cleanup)`,
          order_id: stuckOrderId,
        }], { session });
        console.log('  Refund transaction created for buyer');
      }

      // 4. Mark order as refunded
      await Order.findByIdAndUpdate(stuckOrderId, {
        $set: {
          order_status: 'refunded',
          payment_status: 'refunded',
        }
      }, { session });
      console.log('  Order marked as refunded');

      // 5. Mark vendor payout txn as failed
      const payoutResult = await Transaction.updateMany(
        { order_id: stuckOrderId, type: 'payout', status: 'pending' },
        { $set: { status: 'failed', description: 'Voided — order refunded (restaurant never accepted, auto-cleanup)' } },
        { session }
      );
      console.log('  Vendor payout txns failed:', payoutResult.modifiedCount);

      await session.commitTransaction();
      console.log('  Transaction committed successfully');
    } catch (err) {
      await session.abortTransaction();
      console.error('  Transaction aborted:', err.message);
    } finally {
      session.endSession();
    }
  } else {
    console.log('\n=== STUCK ORDER #79F2B8 ===');
    console.log('Not found or already resolved. Status:', stuckOrder?.order_status);
  }

  // ─── VERIFY ─────────────────────────────────────────────────────────
  console.log('\n=== POST-FIX VERIFICATION ===');

  const updatedUser = await User.findById(user._id).select('wallet_balance').lean();
  console.log('User wallet_balance:', updatedUser.wallet_balance);

  const remainingPending = await Transaction.find({
    user_id: user._id,
    status: 'pending',
    type: 'payout'
  }).select('_id amount reference').lean();
  console.log('Remaining pending payouts:', remainingPending.length);
  remainingPending.forEach(t => console.log(' ', t._id.toString(), t.amount, t.reference));

  const remainingHeldEscrows = await Escrow.find({
    vendor_id: vendor._id,
    status: 'held'
  }).select('_id amount order_id').lean();
  console.log('Remaining held escrows:', remainingHeldEscrows.length);
  remainingHeldEscrows.forEach(e => console.log(' ', e._id.toString(), e.amount));

  // Check buyer's updated balance
  if (stuckOrder) {
    const buyer = await User.findById(stuckOrder.customer_id).select('_id name email wallet_balance').lean();
    console.log('Buyer (refund recipient):', buyer?.name, buyer?.email, 'balance:', buyer?.wallet_balance);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

fix().catch(e => { console.error(e); process.exit(1); });
