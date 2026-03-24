/**
 * controllers/escrow.controller.js
 * Aura Market — Escrow Service & Management Controller
 *
 * Customer pays → funds HELD → Vendor ships → Delivery confirmed → funds RELEASED.
 */

const Escrow = require('../models/Escrow.model');
const Order = require('../models/Order.model');
const User = require('../models/User.model');
const Vendor = require('../models/Vendor.model');
const Transaction = require('../models/Transaction.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const logisticsService = require('../services/logistics.service');
const { sendNotification } = require('../utils/notifier');
const crypto = require('crypto');
const mongoose = require('mongoose');

const generateTxRef = () => `AURA-ESCROW-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

// ─────────────────────────────────────────────
// @route   POST /api/escrow/hold
// @desc    Customer pays for an order via Escrow (Wallet → Escrow Vault)
// @access  Private (Role: customer)
// ─────────────────────────────────────────────
const holdFunds = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { order_id } = req.body;

    const order = await Order.findById(order_id).session(session);
    if (!order) throw new Error('Order not found.');
    if (order.customer_id.toString() !== req.user._id.toString()) throw new Error('Not authorized.');
    if (order.payment_method !== 'escrow') throw new Error('Order is not designated for escrow.');
    if (order.payment_status !== 'pending') throw new Error('Payment has already been processed.');

    const user = await User.findById(req.user._id).session(session);
    const vendorAccount = await Vendor.findById(order.vendor_id).session(session);

    // 1. Check if user holds enough wallet funds
    if (user.wallet_balance < order.total_amount) {
      throw new Error('Insufficient wallet balance to fund Escrow. Please deposit first.');
    }

    // 2. Deduct from customer
    user.wallet_balance -= order.total_amount;
    await user.save({ session });

    // 3. Log initial payment transaction (Customer view)
    await Transaction.create([{
      user_id: user._id,
      type: 'payment',
      amount: order.total_amount,
      reference: generateTxRef(),
      status: 'completed',
      description: `Funds secured in Escrow for Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order_id: order._id,
    }, {
      user_id: vendorAccount.user_id, // Link to vendor's user model
      type: 'payout', // Or a new type 'incoming'
      amount: order.total_amount,
      reference: `IN-${generateTxRef()}`,
      status: 'pending', // IMPORTANT: Status is pending
      description: `Incoming Payment Held (Order #${order._id.toString().slice(-6).toUpperCase()})`,
      order_id: order._id,
    }], { session });

    // 4. Create the Escrow Vault log
    const escrow = await Escrow.create([{
      order_id: order._id,
      buyer_id: order.customer_id,
      vendor_id: order.vendor_id,
      amount: order.total_amount,
      status: 'held',
    }], { session });

    // 5. Update Order Statuses
    order.payment_status = 'paid'; // The system got the money
    order.order_status = 'processing'; // Vendor can begin shipping
    await order.save({ session });

    // If logistics partner is selected, create shipment assignment immediately after escrow hold.
    if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
      const quartier = order.shipping_address?.quartier;
      if (quartier) {
        await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
        const logisticsFirm = await LogisticsCompany.findById(order.logistics_company_id).session(session);
        if (logisticsFirm) {
          await sendNotification(req.app, logisticsFirm.user_id, {
            title: 'New Shipment Assigned',
            message: `You have new delivery work for Order #${order._id.toString().slice(-6).toUpperCase()}.`,
            type: 'system_alert',
            metadata: { order_id: order._id }
          });
        }
      }
    }

    // 6. Update Vendor sales tracking automatically (Real-time volume)
    if (vendorAccount) {
      vendorAccount.total_sales += 1;
      vendorAccount.total_revenue += order.total_amount;
      await vendorAccount.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Funds securely held in Escrow.',
      data: { escrow: escrow[0] },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/escrow/release/:orderId
// @desc    Release funds to Vendor (Fired manually by Customer upon delivery or auto-triggered later)
// @access  Private (Role: customer OR admin)
// ─────────────────────────────────────────────
const releaseFunds = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;

    const escrow = await Escrow.findOne({ order_id: orderId }).session(session);
    if (!escrow) throw new Error('Escrow vault not found for this order.');
    if (escrow.status !== 'held') throw new Error(`Escrow funds are already ${escrow.status}.`);

    // Only the buyer or an admin can forcefully release funds
    if (req.user.role !== 'admin' && escrow.buyer_id.toString() !== req.user._id.toString()) {
      throw new Error('Not authorized to release these funds.');
    }

    const order = await Order.findById(orderId).session(session);

    // 1. Fetch Vendor's User account string
    const vendorAccount = await Vendor.findById(escrow.vendor_id).session(session);
    const vendorUser = await User.findById(vendorAccount.user_id).session(session);

    // 2. Transfer the held funds strictly to the Vendor's wallet
    // Calculate Commission
    const settings = await PlatformSettings.getSettings();
    const platformFee = (escrow.amount * settings.commission_rate) / 100;
    const vendorPayout = escrow.amount - platformFee;

    vendorUser.wallet_balance += vendorPayout;
    await vendorUser.save({ session });

    // Update Platform Earnings
    settings.platform_wallet_balance += platformFee;
    await settings.save({ session });

    // 3. Mark the Vendor's pending payout as Completed
    await Transaction.findOneAndUpdate(
      { order_id: order._id, user_id: vendorUser._id, type: 'payout', status: 'pending' },
      { 
        status: 'completed', 
        amount: vendorPayout, 
        description: `Escrow Released (Fee ${settings.commission_rate}% deducted).` 
      },
      { session, new: true }
    );

    // Log Platform Revenue Transaction (linked to an admin or just a system log)
    // For now, let's just log it without a user_id or to a system 'admin' id if we have one.
    // Let's find an admin user to link it to, or just skip user_id for system transactions.
    await Transaction.create([{
      user_id: req.user._id, // The person who clicked 'release' (usually customer, but logged for audit)
      type: 'payment', // Or a new type 'revenue'
      amount: platformFee,
      reference: `REV-${generateTxRef()}`,
      status: 'completed',
      description: `Platform Commission from Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order_id: order._id,
    }], { session });

    // 4. Update Escrow status
    escrow.status = 'released';
    escrow.release_date = new Date();
    await escrow.save({ session });

    // 5. Update Order status cleanly
    order.order_status = 'completed';
    await order.save({ session });

    // 6. Order fulfillment complete
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Escrow released. Funds successfully transferred to the vendor.',
      data: { escrow },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/escrow/refund/:orderId
// @desc    Refund funds to Customer (Initiated by Vendor OR Admin on disputes)
// @access  Private (Role: vendor OR admin)
// ─────────────────────────────────────────────
const refundFunds = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const escrow = await Escrow.findOne({ order_id: orderId }).session(session);
    if (!escrow) throw new Error('Escrow vault not found.');
    if (escrow.status !== 'held') throw new Error(`Escrow funds cannot be refunded. Status: ${escrow.status}.`);

    // Check auth bounds carefully: Admins can force dispute refunds. Vendors can voluntarily cancel orders.
    const order = await Order.findById(orderId).session(session);
    if (req.user.role === 'vendor') {
      const activeVendor = await Vendor.findOne({ user_id: req.user._id }).session(session);
      if (order.vendor_id.toString() !== activeVendor._id.toString()) {
        throw new Error('Not authorized to refund this exterior order.');
      }
    }

    // 1. Credit Buyer's Wallet
    const buyerUser = await User.findById(escrow.buyer_id).session(session);
    buyerUser.wallet_balance += escrow.amount;
    await buyerUser.save({ session });

    // 2. Log Buyer's Refund Receipt
    await Transaction.create([{
      user_id: buyerUser._id,
      type: 'refund',
      amount: escrow.amount,
      reference: generateTxRef(),
      status: 'completed',
      description: `Escrow Refunded for Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order_id: order._id,
    }], { session });

    // 3. Break down Escrow model
    escrow.status = 'refunded';
    escrow.refund_reason = reason || 'Vendor cancellation / Admin dispute resolution';
    await escrow.save({ session });

    // 4. Conclude Order cleanly
    order.payment_status = 'refunded';
    order.order_status = 'cancelled';
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Escrow refunded. Funds returned to Customer wallet efficiently.',
      data: { escrow },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getEscrowLogs = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = status && status !== 'all' ? { status } : {};

    const logs = await Escrow.find(query)
      .populate('buyer_id', 'name email avatar')
      .populate('vendor_id', 'store_name')
      .populate('order_id', 'createdAt')
      .sort('-createdAt');

    const stats = await Escrow.aggregate([
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: { logs, stats }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  holdFunds,
  releaseFunds,
  refundFunds,
  getEscrowLogs,
};
