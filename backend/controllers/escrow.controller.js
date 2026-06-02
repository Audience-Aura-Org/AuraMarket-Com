/**
 * controllers/escrow.controller.js
 * Auradime — Escrow Service & Management Controller
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
const Shipment = require('../models/Shipment.model');
const logisticsService = require('../services/logistics.service');
const {
  syncShipmentsToOrderStatus,
  getOrderFulfillmentSnapshot,
  notifyOrderStatusChange,
} = require('../services/orderSync.service');
const Cart = require('../models/Cart.model');
const { sendNotification } = require('../utils/notifier');
const { calculatePlatformFees, describeFee } = require('../utils/platformFees');
const crypto = require('crypto');
const mongoose = require('mongoose');

const generateTxRef = () => `AURA-ESCROW-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
const AUTO_RELEASE_WINDOW_MS = 6 * 60 * 60 * 1000;

const appendShipmentActivity = (orderId, status, note, updatedBy, session = null) =>
  Shipment.updateMany(
    { order_id: orderId },
    {
      $push: {
        shipment_logs: {
          status,
          updated_by: updatedBy,
          timestamp: new Date(),
          note,
        },
      },
    },
    session ? { session } : undefined
  );

const markEscrowDelivered = (escrow, deliveredAt = new Date()) => {
  if (!escrow.delivered_at) escrow.delivered_at = deliveredAt;
  if (!escrow.auto_release_at) {
    escrow.auto_release_at = new Date(escrow.delivered_at.getTime() + AUTO_RELEASE_WINDOW_MS);
  }
};

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
    const settings = await PlatformSettings.getSettings(session);
    const { vendorPayout } = calculatePlatformFees(vendorBaseAmount, settings, {
      includeEscrowFee: true
    });
    const feeDescription = describeFee(settings, { includeEscrowFee: true });

    await Transaction.create([{
      user_id: user._id,
      type: 'payment',
      amount: order.total_amount,
      reference: generateTxRef(),
      status: 'completed',
      gateway: 'escrow',
      description: `Funds secured in Escrow for Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order_id: order._id,
    }, {
      user_id: vendorAccount.user_id,
      type: 'payout',
      amount: vendorPayout,
      reference: `IN-${generateTxRef()}`,
      status: 'pending',
      gateway: 'escrow',
      description: `Incoming Payment Held (Order #${order._id.toString().slice(-6).toUpperCase()}, ${feeDescription})`,
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

  const settings = await PlatformSettings.getSettings(session);
  const { platformFee, vendorPayout } = calculatePlatformFees(escrow.amount, settings, {
    includeEscrowFee: true
  });
  const feeDescription = describeFee(settings, { includeEscrowFee: true });

  // Transfer vendor funds
  vendorUser.wallet_balance += vendorPayout;
  await vendorUser.save({ session });

  settings.platform_wallet_balance = (settings.platform_wallet_balance || 0) + platformFee;
  await settings.save({ session });

  // Update Vendor Payout Transaction
  await Transaction.findOneAndUpdate(
    { order_id: order._id, user_id: vendorUser._id, type: 'payout', status: 'pending' },
    {
      status: 'completed',
      amount: vendorPayout,
      description: `${req.autoRelease ? 'Escrow Auto-Released' : 'Escrow Released'} (${feeDescription} deducted).`
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
    gateway: 'platform',
    description: `${req.autoRelease ? 'Auto-released platform commission' : 'Platform Commission'} from Order #${order._id.toString().slice(-6).toUpperCase()}`,
    order_id: order._id,
  }], { session, ordered: true });

  escrow.status = 'released';
  escrow.release_date = new Date();
  await escrow.save({ session });

  order.order_status = 'completed';
  await order.save({ session });

  await syncShipmentsToOrderStatus(order, 'completed', {
    session,
    updatedBy: req.user._id,
    note: 'Delivery confirmed by customer via Escrow Handshake. Shipment closed.',
  });
  await appendShipmentActivity(
    order._id,
    'completed',
    'Customer released escrow funds. Order settlement completed.',
    req.user._id,
    session
  );

  // ── FALLBACK: Credit logistics fee if not already settled by logistics controller ──
  // (Covers edge case where logistics controller didn't fire or escrow.logistics_settled wasn't set)
  if (
    order.shipping_method === 'logistics_partner' &&
    order.logistics_company_id &&
    order.shipping_fee > 0 &&
    !escrow.logistics_settled
  ) {
    const { creditLogistics } = require('../services/payment/settle.service');
    await creditLogistics(order, session);
  }

  // Notifications
  const vendor = await Vendor.findById(order.vendor_id);
  const orderWithVendor = order.toObject();
  orderWithVendor.vendor_id = vendor;

  // Notify Logistics (order complete)
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

  // Notify Vendor of payout
  sendNotification(req.app, vendorUser._id, {
    title: req.autoRelease ? 'Escrow Auto-Released' : 'Funds Released',
    message: `${req.autoRelease ? 'The 6-hour dispute window closed.' : 'Customer confirmed delivery.'} ${vendorPayout.toLocaleString()} XAF has been released to your wallet for Order #${order._id.toString().slice(-6).toUpperCase()}.`,
    type: 'wallet_update',
    metadata: { order_id: order._id },
    role: 'vendor'
  });

  // Notify Customer
  sendNotification(req.app, order.customer_id, {
    title: req.autoRelease ? 'Escrow Auto-Released' : 'Order Finalized',
    message: req.autoRelease
      ? `The 6-hour dispute window for order #${order._id.toString().slice(-6).toUpperCase()} closed with no active dispute, so escrow was released to the vendor.`
      : `Your order #${order._id.toString().slice(-6).toUpperCase()} has been completed and funds released to the vendor.`,
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

    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error('Order not found.');

    const escrow = await Escrow.findOne({ order_id: orderId }).session(session);
    const paymentIsSettled = order.payment_status === 'paid' || order.payment_method === 'pay_on_delivery';

    // ── CASE: Admin Override ────────────────────────────────────────────────
    if (req.user.role === 'admin') {
      if (escrow && order.payment_status !== 'paid') {
        throw new Error('Escrow cannot be released because this order payment is not paid.');
      }
      if (escrow) {
        await finalizeEscrowPayout(escrow, order, req, session);
      } else {
        order.order_status = 'completed';
        await order.save({ session });
        await syncShipmentsToOrderStatus(order, 'completed', {
          session,
          updatedBy: req.user._id,
          note: 'Admin override: order completed.',
        });
      }
      await session.commitTransaction();
      session.endSession();
      notifyOrderStatusChange(req.app, order, 'completed', {
        message: 'An admin finalized this order.',
      });
      const snapshot = await getOrderFulfillmentSnapshot(orderId);
      return res.status(200).json({
        success: true,
        message: 'Admin override: Protocol finalized.',
        data: { order: snapshot.order, shipments: snapshot.shipments, escrow: snapshot.escrow },
      });
    }

    // ── CASE: Non-Escrow Order ──────────────────────────────────────────────
    if (!escrow) {
      if (order.customer_id.toString() !== req.user._id.toString()) {
        throw new Error('Not authorized to release this order.');
      }
      if (!paymentIsSettled) {
        throw new Error('This order cannot be completed because payment is not settled.');
      }
      order.order_status = 'completed';
      await order.save({ session });
      await syncShipmentsToOrderStatus(order, 'completed', {
        session,
        updatedBy: req.user._id,
        note: 'Customer confirmed receipt (non-escrow).',
      });
      await session.commitTransaction();
      session.endSession();
      notifyOrderStatusChange(req.app, order, 'completed');
      const snapshot = await getOrderFulfillmentSnapshot(orderId);
      return res.status(200).json({
        success: true,
        message: 'Order marked as completed.',
        data: { order: snapshot.order, shipments: snapshot.shipments, escrow: snapshot.escrow },
      });
    }

    if (escrow.status === 'released') {
      escrow.vendor_confirmed = true;
      if (!orderFinalized || order.order_status !== 'completed') {
        order.order_status = 'completed';
      }

      await escrow.save({ session });
      await order.save({ session });
      await appendShipmentActivity(
        order._id,
        'completed',
        'Vendor confirmed delivery after escrow had already been released. Order marked complete for record keeping.',
        req.user._id,
        session
      );

      await session.commitTransaction();
      session.endSession();

      notifyOrderStatusChange(req.app, order, 'completed', {
        message: `Order #${order._id.toString().slice(-6).toUpperCase()} is complete. Escrow was already released.`,
      });

      const snapshot = await getOrderFulfillmentSnapshot(orderId);
      return res.status(200).json({
        success: true,
        message: 'Order completed. Escrow funds had already been released.',
        data: { order: snapshot.order, shipments: snapshot.shipments, escrow: snapshot.escrow },
      });
    }
    if (order.payment_status !== 'paid') {
      throw new Error('Escrow cannot be released because this order payment is not paid.');
    }

    // ── CASE: Customer Confirmation ──────────────────────────────────────────
    if (escrow.buyer_id.toString() !== req.user._id.toString()) {
      throw new Error('Only the customer or an admin can initiate this release.');
    }

    escrow.customer_confirmed = true;
    await finalizeEscrowPayout(escrow, order, req, session);

    await session.commitTransaction();
    session.endSession();

    notifyOrderStatusChange(req.app, order, 'completed', {
      message: 'Your order is complete and funds have been released to the vendor.',
      vendorMessage: `Customer confirmed receipt. Funds released for Order #${order._id.toString().slice(-6).toUpperCase()}.`,
    });

    const snapshot = await getOrderFulfillmentSnapshot(orderId);

    return res.status(200).json({
      success: true,
      message: 'Escrow released successfully. Funds are now available in the vendor node.',
      data: { order: snapshot.order, shipments: snapshot.shipments, escrow: snapshot.escrow },
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
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

    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error('Order not found.');

    const vendorRecord = await Vendor.findOne({ user_id: req.user._id }).session(session);
    if (!vendorRecord || order.vendor_id.toString() !== vendorRecord._id.toString()) {
      throw new Error('Not authorized to confirm delivery for this order.');
    }

    const escrow = await Escrow.findOne({ order_id: orderId }).session(session);
    if (order.payment_status !== 'paid' && order.payment_method !== 'pay_on_delivery') {
      throw new Error('Delivery cannot be confirmed until payment is settled.');
    }
    const latestShipment = await Shipment.findOne({ order_id: orderId }).sort('-createdAt').session(session);
    const shipmentDelivered = latestShipment?.status === 'delivered';
    const orderFinalized = ['delivered', 'completed'].includes(order.order_status);

    // Logistics orders are carrier-confirmed during transit, but old/finalized escrow
    // orders still need a vendor-visible release prompt if funds remain held.
    if (
      order.shipping_method === 'logistics_partner' &&
      order.logistics_company_id &&
      !shipmentDelivered &&
      !orderFinalized &&
      order.order_status !== 'shipped'
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'Delivery confirmation for logistics orders is handled by the carrier. You will be paid once the carrier marks the shipment as delivered.'
      });
    }

    // ── CASE: Non-Escrow Order ──────────────────────────────────────────────
    if (!escrow) {
      order.order_status = 'delivered';
      await order.save({ session });
      await syncShipmentsToOrderStatus(order, 'delivered', {
        session,
        updatedBy: req.user._id,
        note: 'Vendor marked order as delivered.',
      });
      await session.commitTransaction();
      session.endSession();

      notifyOrderStatusChange(req.app, order, 'delivered');

      // Notify Customer
      sendNotification(req.app, order.customer_id, {
        title: 'Package Delivered',
        message: `Vendor has marked Order #${order._id.toString().slice(-6).toUpperCase()} as delivered.`,
        type: 'order_status',
        metadata: { order_id: order._id },
        role: 'customer'
      });

      const snapshot = await getOrderFulfillmentSnapshot(orderId);
      return res.status(200).json({
        success: true,
        message: 'Delivery confirmed and order status updated.',
        data: { order: snapshot.order, shipments: snapshot.shipments, escrow: snapshot.escrow },
      });
    }

    if (escrow.status === 'released') throw new Error('Escrow funds are already released.');

    // ── CASE: Escrow Confirmation ───────────────────────────────────────────
    escrow.vendor_confirmed = true;
    markEscrowDelivered(escrow);
    if (!orderFinalized) order.order_status = 'delivered';

    await escrow.save({ session });
    await order.save({ session });

    if (!orderFinalized) {
      await syncShipmentsToOrderStatus(order, 'delivered', {
        session,
        updatedBy: req.user._id,
        note: 'Vendor marked order as delivered. Awaiting customer confirmation.',
      });
    }

    await session.commitTransaction();
    session.endSession();

    if (!orderFinalized) {
      notifyOrderStatusChange(req.app, order, 'delivered', {
        message: `The vendor marked Order #${order._id.toString().slice(-6).toUpperCase()} as delivered. Please confirm receipt.`,
      });
    }

    // Notify Customer to prompt them for the final release click
    sendNotification(req.app, escrow.buyer_id, {
      title: 'Vendor Confirmed Delivery',
      message: `The vendor for Order #${order._id.toString().slice(-6).toUpperCase()} has marked it as delivered. Please confirm receipt to release funds.`,
      type: 'order_status',
      metadata: { order_id: order._id },
      role: 'customer'
    });

    const snapshot = await getOrderFulfillmentSnapshot(orderId);

    return res.status(200).json({ 
      success: true, 
      message: 'Delivery confirmed. Awaiting customer to release escrowed funds.',
      data: { order: snapshot.order, shipments: snapshot.shipments, escrow: snapshot.escrow },
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
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

    await syncShipmentsToOrderStatus(order, 'cancelled', {
      session,
      updatedBy: req.user._id,
      note: 'Escrow refunded; shipments cancelled.',
    });

    await session.commitTransaction();
    session.endSession();

    notifyOrderStatusChange(req.app, order, 'cancelled', {
      message: `Order #${order._id.toString().slice(-6).toUpperCase()} was cancelled and refunded.`,
    });

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
  finalizeEscrowPayout,
  markEscrowDelivered,
  AUTO_RELEASE_WINDOW_MS,
};
