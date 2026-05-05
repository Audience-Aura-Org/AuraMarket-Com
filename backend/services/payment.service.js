/**
 * services/payment.service.js
 * Aura Market — Payment & Fund Release Service
 */

const Escrow = require('../models/Escrow.model');
const Order = require('../models/Order.model');
const User = require('../models/User.model');
const Vendor = require('../models/Vendor.model');
const Transaction = require('../models/Transaction.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { sendNotification } = require('../utils/notifier');

/**
 * Internal helper to release held escrow funds to a vendor.
 * Works inside a mongoose session.
 */
const releaseFundsInternal = async (orderId, session, app = null) => {
  const escrow = await Escrow.findOne({ order_id: orderId }).session(session);
  if (!escrow || escrow.status !== 'held') {
    return { success: false, message: 'No held funds found or already released.' };
  }

  const order = await Order.findById(orderId).session(session);
  const vendorAccount = await Vendor.findById(escrow.vendor_id).session(session);
  const vendorUser = await User.findById(vendorAccount.user_id).session(session);

  // 1. Calculate Commission
  const settings = await PlatformSettings.getSettings();
  const platformFee = (escrow.amount * settings.commission_rate) / 100;
  const vendorPayout = escrow.amount - platformFee;

  // 2. Transfer Funds
  vendorUser.wallet_balance += vendorPayout;
  await vendorUser.save({ session });

  // 3. Update Platform Earnings
  settings.platform_wallet_balance += platformFee;
  await settings.save({ session });

  // 4. Update Transaction Logs
  await Transaction.findOneAndUpdate(
    { order_id: order._id, user_id: vendorUser._id, type: 'payout', status: 'pending' },
    {
      status: 'completed',
      amount: vendorPayout,
      description: `Escrow Released (Fee ${settings.commission_rate}% deducted).`
    },
    { session }
  );

  // 5. Log Platform Revenue (Linked to Admin)
  // We'll create a system reference here
  await Transaction.create([{
    user_id: vendorUser._id, // Just linking for trace, though it's platform revenue
    type: 'payment', 
    amount: platformFee,
    reference: `REV-AUTO-${Date.now()}`,
    status: 'completed',
    description: `Platform Commission from Order #${order._id.toString().slice(-6).toUpperCase()}`,
    order_id: order._id,
  }], { session, ordered: true });

  // 6. Update Escrow status
  escrow.status = 'released';
  escrow.release_date = new Date();
  await escrow.save({ session });

  // 7. Update Order status
  order.order_status = 'completed';
  await order.save({ session });

  // 8. Notifications (Non-blocking if app is provided)
  if (app) {
    setImmediate(async () => {
        try {
            sendNotification(app, vendorAccount.user_id, {
                title: 'Funds Released',
                message: `Payout for Order #${order._id.toString().slice(-6).toUpperCase()} is now available in your wallet.`,
                type: 'wallet_update',
                metadata: { order_id: order._id, link: '/wallet' },
                sendEmail: true
            });
            
            sendNotification(app, order.customer_id, {
                title: 'Order Completed',
                message: `Successfully released funds to vendor for order #${order._id.toString().slice(-6).toUpperCase()}.`,
                type: 'order_status',
                metadata: { order_id: order._id, link: `/orders/${order._id}` }
            });
        } catch (notifierErr) {
            console.error('Payment Service Notifier Error:', notifierErr);
        }
    });
  }

  return { success: true, vendorPayout, platformFee };
};

module.exports = {
  releaseFundsInternal
};
