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
const Cart = require('../models/Cart.model');
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

    const vendorBaseAmount = (order.shipping_method === 'logistics_partner' && order.logistics_company_id)
      ? order.subtotal
      : order.total_amount;

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
      amount: vendorBaseAmount,
      reference: `IN-${generateTxRef()}`,
      status: 'pending', // IMPORTANT: Status is pending
      description: `Incoming Payment Held (Order #${order._id.toString().slice(-6).toUpperCase()})`,
      order_id: order._id,
    }], { session, ordered: true });

    // 4. Create the Escrow Vault log
    const [escrow] = await Escrow.create([{
      order_id: order._id,
      buyer_id: order.customer_id,
      vendor_id: order.vendor_id,
      amount: vendorBaseAmount,
      status: 'held',
    }], { session, ordered: true });

    // 5. Update Order Statuses
    order.payment_status = 'paid'; // The system got the money
    order.order_status = 'processing'; // Vendor can begin shipping
    await order.save({ session });

    // Clear cart after funds are secured in escrow
    const cart = await Cart.findOne({ user_id: req.user._id }).session(session);
    if (cart) {
      cart.items = [];
      await cart.save({ session });
    }

    // Auto-create shipment tickets when logistics delivery is selected
    const quartier = order.shipping_address?.quartier;
    if (order.shipping_method === 'logistics_partner' && order.logistics_company_id && quartier) {
      await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
    }

    await session.commitTransaction();
    session.endSession();

    // BACKGROUND DISPATCH (Post-Transaction)
    const quartier = order.shipping_address?.quartier;
    if (order.shipping_method === 'logistics_partner' && order.logistics_company_id && quartier) {
      const logisticsFirm = await LogisticsCompany.findById(order.logistics_company_id);
      if (logisticsFirm) {
        sendNotification(req.app, logisticsFirm.user_id, {
          title: 'New Shipment Assigned',
          message: `You have new delivery work for Order #${order._id.toString().slice(-6).toUpperCase()}.`,
          type: 'system_alert',
          metadata: { order_id: order._id },
          sendEmail: true,
          overrideEmail: logisticsFirm.contact_email,
          emailLink: `${process.env.WEB_CLIENT_URL}/logistics/dashboard`,
          orderDetails: order.toObject(), // Simplified for now
          role: 'logistics'
        });
      }
    }

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
/**
 * Internal helper to finalize the transfer of funds from Escrow to Vendor wallet.
 * This should only be called once all conditions (Mutual Agreement or Admin Override) are met.
 */
const finalizeEscrowPayout = async (escrow, order, req, session) => {
  const vendorAccount = await Vendor.findById(escrow.vendor_id).session(session);
  const vendorUser = await User.findById(vendorAccount.user_id).session(session);

  const settings = await PlatformSettings.getSettings();
  const platformFee = (escrow.amount * settings.commission_rate) / 100;
  const vendorPayout = escrow.amount - platformFee;

  // Transfer funds
  vendorUser.wallet_balance += vendorPayout;
  await vendorUser.save({ session });

  settings.platform_wallet_balance += platformFee;
  await settings.save({ session });

  // Update Vendor Payout Transaction
  await Transaction.findOneAndUpdate(
    { order_id: order._id, user_id: vendorUser._id, type: 'payout', status: 'pending' },
    {
      status: 'completed',
      amount: vendorPayout,
      description: `Escrow Released (Fee ${settings.commission_rate}% deducted).`
    },
    { session }
  );

  // Log Platform Revenue
  await Transaction.create([{
    user_id: req.user._id,
    type: 'payment',
    amount: platformFee,
    reference: `REV-${generateTxRef()}`,
    status: 'completed',
    description: `Platform Commission from Order #${order._id.toString().slice(-6).toUpperCase()}`,
    order_id: order._id,
  }], { session, ordered: true });

  escrow.status = 'released';
  escrow.release_date = new Date();
  await escrow.save({ session });

  order.order_status = 'completed';
  await order.save({ session });

  // Notifications
  const vendor = await Vendor.findById(order.vendor_id);
  const orderWithVendor = order.toObject();
  orderWithVendor.vendor_id = vendor;

  // Notify Logistics
  if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
    const logisticsFirm = await LogisticsCompany.findById(order.logistics_company_id);
    if (logisticsFirm) {
      sendNotification(req.app, logisticsFirm.user_id, {
        title: 'Order Completed & Settled',
        message: `The lifecycle for Order #${order._id.toString().slice(-6).toUpperCase()} is now complete.`,
        type: 'system_alert',
        sendEmail: true,
        overrideEmail: logisticsFirm.contact_email,
        metadata: { order_id: order._id },
        orderDetails: orderWithVendor,
        role: 'logistics'
      });
    }
  }

  // Notify Customer
  sendNotification(req.app, order.customer_id, {
    title: 'Order Finalized',
    message: `Your order #${order._id.toString().slice(-6).toUpperCase()} has been completed and funds released to vendor.`,
    type: 'order_status',
    sendEmail: true,
    orderDetails: orderWithVendor,
    role: 'customer'
  });
};

// ─────────────────────────────────────────────
// @route   POST /api/escrow/release/:orderId
// @desc    Customer confirms receipt & agrees to release funds.
// @access  Private (Role: customer OR admin)
// ─────────────────────────────────────────────
const releaseFunds = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;

    const escrow = await Escrow.findOne({ order_id: orderId }).session(session);
    if (!escrow) throw new Error('Escrow vault not found for this order.');
    if (escrow.status === 'released') throw new Error('Escrow funds are already released.');

    const order = await Order.findById(orderId).session(session);

    // ── CASE: Admin Override ────────────────────────────────────────────────
    if (req.user.role === 'admin') {
      await finalizeEscrowPayout(escrow, order, req, session);
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({ success: true, message: 'Admin override: Escrow released immediately.' });
    }

    // ── CASE: Customer Confirmation ──────────────────────────────────────────
    if (escrow.buyer_id.toString() !== req.user._id.toString()) {
      throw new Error('Only the customer or an admin can initiate this release.');
    }

    // Aura Signature: Escrow is released immediately upon customer acceptance. 
    // No mutual agreement bottleneck required for the payout to finalize.
    await finalizeEscrowPayout(escrow, order, req, session);
    
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ 
      success: true, 
      message: 'Escrow released successfully. Funds are now available in the vendor node.' 
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/escrow/confirm-delivery/:orderId
// @desc    Vendor confirms they have delivered & requests fund release.
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const vendorConfirmRelease = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;

    const escrow = await Escrow.findOne({ order_id: orderId }).session(session);
    if (!escrow) throw new Error('Escrow vault not found.');
    if (escrow.status === 'released') throw new Error('Escrow funds are already released.');

    const vendorRecord = await Vendor.findOne({ user_id: req.user._id }).session(session);
    if (!vendorRecord || escrow.vendor_id.toString() !== vendorRecord._id.toString()) {
      throw new Error('Not authorized to confirm delivery for this order.');
    }

    const order = await Order.findById(orderId).session(session);

    escrow.vendor_confirmed = true;
    
    // We maintain the 'held' or 'pending_release' status until the CUSTOMER approves.
    // The vendor's confirmation acts as a trigger/notification for the customer.
    await escrow.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Notify Customer to prompt them for the final release click
    sendNotification(req.app, escrow.buyer_id, {
      title: 'Vendor Confirmed Delivery',
      message: `The vendor for Order #${order._id.toString().slice(-6).toUpperCase()} has marked it as delivered. Please review and confirm receipt to release the funds.`,
      type: 'order_status',
      metadata: { order_id: order._id, link: '/profile?tab=orders' },
      role: 'customer'
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Delivery confirmed. The customer has been notified to release the funds.' 
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
    }], { session, ordered: true });

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

// ─────────────────────────────────────────────
// @route   POST /api/escrow/deny/:orderId
// @desc    Customer or Vendor denies release/fulfillment → Launches Dispute
// @access  Private
// ─────────────────────────────────────────────
const denyEscrow = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { reason, description } = req.body;

    const escrow = await Escrow.findOne({ order_id: orderId }).session(session);
    if (!escrow) throw new Error('Escrow vault not found.');
    if (['released', 'refunded', 'disputed'].includes(escrow.status)) {
      throw new Error(`Escrow cannot be denied in its current state: ${escrow.status}`);
    }

    const order = await Order.findById(orderId).session(session);
    
    // Check if user is buyer or vendor
    const isBuyer = escrow.buyer_id.toString() === req.user._id.toString();
    const vendorRecord = await Vendor.findOne({ user_id: req.user._id }).session(session);
    const isVendor = vendorRecord && escrow.vendor_id.toString() === vendorRecord._id.toString();

    if (!isBuyer && !isVendor && req.user.role !== 'admin') {
      throw new Error('Not authorized to contest this escrow.');
    }

    // 1. Update Escrow Status
    escrow.status = 'disputed';
    await escrow.save({ session });

    // 2. Create Dispute Record
    const Dispute = require('../models/Dispute.model');
    const dispute = await Dispute.create([{
      order_id: order._id,
      initiator_id: req.user._id,
      reason: reason || 'other',
      description: description || `Release denied by ${req.user.role}. Auto-escalated to Admin.`,
      status: 'pending'
    }], { session, ordered: true });

    // 3. Update Order Status
    order.order_status = 'refund_pending'; // Standard status for disputed orders
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // 4. Notify Admin
    const { sendNotification } = require('../utils/notifier');
    const adminUsers = await User.find({ role: 'admin' }).select('_id');
    for (const admin of adminUsers) {
      sendNotification(req.app, admin._id, {
        title: 'New Escrow Dispute',
        message: `A dispute has been launched for Order #${order._id.toString().slice(-6)}.`,
        type: 'system_alert',
        metadata: { order_id: order._id, dispute_id: dispute[0]._id, link: '/admin/disputes' }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Escrow denied. A formal dispute has been opened for Admin review.',
      data: { dispute: dispute[0] }
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
  vendorConfirmRelease,
  denyEscrow,
  refundFunds,
  getEscrowLogs,
};
