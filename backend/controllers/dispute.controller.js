/**
 * controllers/dispute.controller.js
 * Auradime — Dispute Resolution Controller
 */

const Dispute = require('../models/Dispute.model');
const Order = require('../models/Order.model');
const User = require('../models/User.model');
const Vendor = require('../models/Vendor.model');
const Store = require('../models/Store.model');
const Escrow = require('../models/Escrow.model');
const Transaction = require('../models/Transaction.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const mongoose = require('mongoose');
const { syncShipmentsToOrderStatus, notifyOrderStatusChange } = require('../services/orderSync.service');
const { applyCommissionOverride, calculatePlatformFees, describeFee } = require('../utils/platformFees');
const { clawbackFoodRefund } = require('../services/payment/settle.service');
const { creditBalance } = require('../services/wallet.service');

const getEffectivePlatformSettings = async (vendorId, session) => {
  const platformSettings = await PlatformSettings.getSettings(session);
  const store = await Store.findOne({ vendor_id: vendorId }).select('commission_rate').session(session);
  return {
    platformSettings,
    effectiveSettings: applyCommissionOverride(platformSettings, store?.commission_rate),
  };
};

// @route   POST /api/disputes
// @desc    Customer raises a dispute for an order
// @access  Private (Role: customer)
const createDispute = async (req, res, next) => {
  try {
    const { sendNotification, notifyAdmins } = require('../utils/notifier');
    const { order_id, reason, description, evidence_urls } = req.body;

    const order = await Order.findById(order_id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    // Auth check
    if (order.customer_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    // Check if dispute already exists
    const existingDispute = await Dispute.findOne({ order_id, status: { $ne: 'cancelled' } });
    if (existingDispute) {
      return res.status(400).json({ success: false, message: 'A dispute is already open for this order.' });
    }

    const dispute = await Dispute.create({
      order_id,
      initiator_id: req.user._id,
      reason,
      description,
      evidence_urls,
      status: 'pending',
    });

    // Update Order Status
    order.order_status = 'refund_pending';
    await order.save();

    notifyOrderStatusChange(req.app, order, 'refund_pending', {
      message: `A dispute has been opened for Order #${order._id.toString().slice(-6).toUpperCase()}.`,
    });

    // Notify Vendor
    const vendor = await Vendor.findById(order.vendor_id);
    if (vendor) {
      await sendNotification(req.app, vendor.user_id, {
        title: 'Dispute Raised',
        message: `A dispute has been raised for Order #${order._id.toString().slice(-6)}.`,
        type: 'system_alert',
        sendEmail: true,
        emailLink: `${process.env.WEB_CLIENT_URL}/vendor/orders/${order._id}`,
      });
    }

    // Notify all admins — disputes need immediate attention
    setImmediate(() => {
      notifyAdmins(req.app, {
        title:   'New Dispute Filed',
        message: `Customer ${req.user.name} opened a dispute on Order #${order._id.toString().slice(-6).toUpperCase()} — Reason: ${reason}. Immediate review required.`,
        type:    'system_alert',
        metadata: { dispute_id: dispute._id, order_id: order._id, link: `/admin/disputes` },
      }).catch(console.error);
    });

    res.status(201).json({
      success: true,
      data: { dispute },
      message: 'Dispute formal protocol initiated.'
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/disputes/admin
// @desc    Get all disputes for admin review
// @access  Private (Role: admin)
const getAdminDisputes = async (req, res, next) => {
  try {
    const disputes = await Dispute.find()
      .populate('order_id')
      .populate('initiator_id', 'name email avatar verification_status')
      .sort('-createdAt');

    res.status(200).json({ success: true, data: { disputes } });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/admin/disputes/:id/resolve
// @desc    Admin resolves a dispute
// @access  Private (Role: admin)
const resolveDispute = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { resolution_type, admin_notes } = req.body; // 'full_refund' | 'release_payment' | 'rejected'

    const dispute = await Dispute.findById(id).populate('order_id').session(session);
    if (!dispute) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Dispute not found.' });
    }

    if (dispute.status === 'resolved') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'This dispute has already been resolved.' });
    }

    const order = await Order.findById(dispute.order_id._id).session(session);
    const escrow = await Escrow.findOne({ order_id: order._id }).session(session);

    const generateTxRef = () => `AURA-DISPUTE-${require('crypto').randomBytes(6).toString('hex').toUpperCase()}`;

    // Process resolution logic
    if (resolution_type === 'full_refund') {
      // 1. Mark order as refunded
      order.order_status = 'refunded';
      order.payment_status = 'refunded';

      // 2. Logic for Escrow: credit back to buyer wallet.
      //    Use order.total_amount (what the buyer actually paid), not escrow.amount
      //    which only stores the vendor base portion after platform commission.
      if (escrow && escrow.status === 'held') {
        const disputeRefundAmount = order.total_amount || escrow.amount;
        const disputeUpdatedBuyer = await creditBalance(escrow.buyer_id, disputeRefundAmount, session);

        // Record refund transaction
        await Transaction.create([{
          user_id: escrow.buyer_id,
          type: 'refund',
          amount: disputeRefundAmount,
          reference: generateTxRef(),
          status: 'completed',
          description: `Dispute Resolution: Full Refund for Order #${order._id.toString().slice(-6).toUpperCase()}`,
          order_id: order._id,
        }], { session, ordered: true });

        escrow.status = 'refunded';
        escrow.refund_reason = admin_notes || 'Dispute resolution: Full Refund';
        await escrow.save({ session });

        // Cancel any vendor pending payout so it never settles to a refunded order.
        await Transaction.findOneAndUpdate(
          { order_id: order._id, type: 'payout', status: 'pending' },
          { $set: { status: 'cancelled', description: 'Cancelled: dispute resolved as full refund.' } },
          { session }
        );

        // Push instant balance update to buyer's top nav
        if (disputeUpdatedBuyer?.wallet_balance !== undefined) {
          setImmediate(() => {
            const io = req.app?.get?.('io');
            if (io) {
              const br = escrow.buyer_id.toString();
              const pl = { amount: disputeRefundAmount, balance: disputeUpdatedBuyer.wallet_balance, type: 'refund' };
              io.to(br).emit('wallet:credited', pl);
              io.to(`user:${br}`).emit('wallet:credited', pl);
            }
          });
        }
      }

      await syncShipmentsToOrderStatus(order, 'refunded', {
        session,
        updatedBy: req.user._id,
        note: 'Dispute resolved: full refund.',
      });

    } else if (resolution_type === 'release_payment') {
      // Release funds to vendor from escrow
      order.order_status = 'completed';
      
      if (escrow && escrow.status === 'held') {
        const vendorAccount = await Vendor.findById(escrow.vendor_id).session(session);
        const { platformSettings, effectiveSettings } = await getEffectivePlatformSettings(escrow.vendor_id, session);
        const { platformFee, vendorPayout } = calculatePlatformFees(escrow.amount, effectiveSettings, {
          includeEscrowFee: true
        });
        const feeDescription = describeFee(effectiveSettings, { includeEscrowFee: true });

        await creditBalance(vendorAccount.user_id, vendorPayout, session);

        // Update Platform Earnings only when a platform fee is actually collected.
        if (platformFee > 0) {
          platformSettings.platform_wallet_balance = (platformSettings.platform_wallet_balance || 0) + platformFee;
          await platformSettings.save({ session });
        }

        // Update/Create Vendor Payout Transaction
        await Transaction.findOneAndUpdate(
          { order_id: order._id, user_id: vendorAccount.user_id, type: 'payout', status: 'pending' },
          { 
            status: 'completed', 
            amount: vendorPayout, 
            description: `Admin Dispute Release (${feeDescription} deducted).`
          },
          { session, returnDocument: 'after', upsert: true }
        );

        escrow.status = 'released';
        escrow.release_date = new Date();
        await escrow.save({ session });
      }

      await syncShipmentsToOrderStatus(order, 'completed', {
        session,
        updatedBy: req.user._id,
        note: 'Dispute resolved: payment released to vendor.',
      });

    // ── Phase 3 Step 5c: Food refund resolutions ────────────────────────────
    // Food orders have no Escrow. Vendor was paid at capture. Clawback debits
    // the restaurant's wallet (which may go negative) and credits the buyer.
    } else if (resolution_type === 'food_full_refund') {
      const refundAmount = order.total_amount - (order.shipping_fee || 0); // refund order value, not delivery

      if (order.new_restaurant_hold) {
        // Vendor was on a hold — they were never credited. Cancel the pending payout
        // and credit the buyer directly without debiting the vendor's wallet.
        await Transaction.findOneAndUpdate(
          { order_id: order._id, type: 'payout', status: 'pending' },
          { $set: { status: 'cancelled', description: 'Cancelled: food dispute resolved as full refund (hold).' } },
          { session }
        );
        const crypto = require('crypto');
        await creditBalance(order.customer_id, refundAmount, session);
        await Transaction.create([{
          user_id:     order.customer_id,
          type:        'refund',
          amount:      refundAmount,
          reference:   `DISPUTE-FOOD-HOLD-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
          status:      'completed',
          gateway:     'platform',
          description: `Food order refund — Full refund (held payout cancelled) for Order #${order._id.toString().slice(-6).toUpperCase()}`,
          order_id:    order._id,
        }], { session, ordered: true });
        order.payment_status = 'refunded';
        order.order_status   = 'refunded';
        await order.save({ session });
      } else {
        await clawbackFoodRefund(order, refundAmount, session, admin_notes || 'Full refund (food dispute)');
      }

      await syncShipmentsToOrderStatus(order, 'refunded', {
        session,
        updatedBy: req.user._id,
        note: 'Food dispute resolved: full refund clawed back from restaurant.',
      });

    } else if (resolution_type === 'food_partial_refund') {
      const { partial_refund_amount } = req.body;
      if (!partial_refund_amount || partial_refund_amount <= 0 || partial_refund_amount > order.total_amount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'partial_refund_amount is required and must be between 1 and the order total.' });
      }
      await clawbackFoodRefund(order, partial_refund_amount, session, admin_notes || 'Partial refund (food dispute)');
      // Partial refund — order stays 'completed' (meal was partially consumed / delivered)
      order.order_status   = 'completed';
      order.payment_status = 'paid';
      await order.save({ session });

    } else if (resolution_type === 'food_no_refund') {
      // Admin reviewed and rejected — no money moves, update dispute only
      order.order_status = 'completed';
      await order.save({ session });
    }

    const { logAction } = require('./audit.controller');
    await logAction(
      req.user._id, 
      'dispute_resolve', 
      'dispute', 
      dispute._id, 
      { type: resolution_type, notes: admin_notes }
    );

    dispute.status = 'resolved';
    dispute.resolution_type = resolution_type;
    dispute.admin_notes = admin_notes;
    dispute.resolved_at = Date.now();
    
    await dispute.save({ session });
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    notifyOrderStatusChange(req.app, order, order.order_status, {
      message: `Dispute resolved: ${resolution_type.replace(/_/g, ' ')}.`,
    });

    // Send email to customer and vendor about the resolution outcome
    setImmediate(async () => {
      const { sendNotification: notify } = require('../utils/notifier');
      const resolutionLabel = {
        full_refund:        'Full refund issued',
        release_payment:    'Payment released to vendor',
        food_full_refund:   'Full refund issued',
        food_partial_refund:'Partial refund issued',
        food_no_refund:     'No refund — claim rejected',
        rejected:           'No refund — claim rejected',
      }[resolution_type] || resolution_type.replace(/_/g, ' ');

      // Customer
      try {
        await notify(req.app, order.customer_id, {
          title:   'Dispute Resolved',
          message: `Your dispute for Order #${order._id.toString().slice(-6).toUpperCase()} has been resolved: ${resolutionLabel}.${admin_notes ? ` Admin note: ${admin_notes}` : ''}`,
          type:    'order_status',
          sendEmail: true,
          emailLink: `${process.env.WEB_CLIENT_URL}/orders/${order._id}`,
          metadata: { order_id: order._id, link: `/orders/${order._id}` },
          role:    'customer',
        });
      } catch (_) {}

      // Vendor
      try {
        const vendor = await Vendor.findById(order.vendor_id).select('user_id').lean();
        if (vendor) {
          await notify(req.app, vendor.user_id, {
            title:   'Dispute Resolved',
            message: `The dispute for Order #${order._id.toString().slice(-6).toUpperCase()} has been resolved: ${resolutionLabel}.${admin_notes ? ` Admin note: ${admin_notes}` : ''}`,
            type:    'order_status',
            sendEmail: true,
            emailLink: `${process.env.WEB_CLIENT_URL}/vendor/orders/${order._id}`,
            metadata: { order_id: order._id, link: `/vendor/orders/${order._id}` },
            role:    'vendor',
          });
        }
      } catch (_) {}
    });

    res.status(200).json({
      success: true,
      message: `Dispute resolved with status: ${resolution_type}`,
      data: { dispute }
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// @route   GET /api/disputes/customer
// @desc    Get all disputes initiated by the customer
// @access  Private (Role: customer/user)
const getCustomerDisputes = async (req, res, next) => {
  try {
    const disputes = await Dispute.find({ initiator_id: req.user._id })
      .populate('order_id')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: disputes.length, data: { disputes } });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/disputes/vendor
// @desc    Get all disputes related to a vendor's orders
// @access  Private (Role: vendor)
const getVendorDisputes = async (req, res, next) => {
  try {
    if (!req.vendor) {
      return res.status(403).json({ success: false, message: 'Vendor access required.' });
    }

    // First find all orders related to this vendor
    const orders = await Order.find({ vendor_id: req.vendor._id }).select('_id');
    const orderIds = orders.map(o => o._id);

    // Then find any disputes tied to those orders
    const disputes = await Dispute.find({ order_id: { $in: orderIds } })
      .populate('order_id')
      .populate('initiator_id', 'name email avatar verification_status')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: disputes.length, data: { disputes } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDispute,
  getAdminDisputes,
  resolveDispute,
  getCustomerDisputes,
  getVendorDisputes
};

