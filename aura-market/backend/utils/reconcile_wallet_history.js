/**
 * utils/reconcile_wallet_history.js
 * Retroactively creates 'payout' transactions for vendors for all active/pending orders.
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: './.env' });

const Order = require('../models/Order.model');
const Transaction = require('../models/Transaction.model');
const Vendor = require('../models/Vendor.model');

const generateTxRef = () => `AURA-TX-MIGRATED-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find orders that are paid but might not have vendor transactions
    const orders = await Order.find({ 
      payment_status: { $in: ['paid', 'completed'] },
      order_status: { $nin: ['cancelled'] }
    });

    console.log(`Checking ${orders.length} orders for missing vendor transactions.`);

    for (const order of orders) {
      const vendor = await Vendor.findById(order.vendor_id);
      if (!vendor) continue;

      // Check if a payout/incoming transaction already exists for this order & vendor
      const existingTx = await Transaction.findOne({
        order_id: order._id,
        user_id: vendor.user_id,
        type: { $in: ['payout', 'escrow_release'] }
      });

      if (!existingTx) {
        console.log(`Creating missing transaction record for Order #${order._id.toString().slice(-6)} | Vendor: ${vendor.store_name}`);
        
        const isCompleted = order.order_status === 'completed';
        
        await Transaction.create({
          user_id: vendor.user_id,
          type: 'payout',
          amount: order.total_amount, // Gross amount for migration clarity
          reference: generateTxRef(),
          status: isCompleted ? 'completed' : 'pending',
          description: isCompleted 
            ? `Income for Order #${order._id.toString().slice(-6).toUpperCase()} (Reconciled)`
            : `Incoming Payment Held (Order #${order._id.toString().slice(-6).toUpperCase()})`,
          order_id: order._id,
          createdAt: order.createdAt // Keep original timing
        });
      }
    }

    console.log('🎉 Reconstruction complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
