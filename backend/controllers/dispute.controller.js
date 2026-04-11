/**
 * controllers/dispute.controller.js
 * Aura Market — Dispute Resolution Controller
 */

const Dispute = require('../models/Dispute.model');
const Order = require('../models/Order.model');
const User = require('../models/User.model');
const Vendor = require('../models/Vendor.model');
const Escrow = require('../models/Escrow.model');
const Transaction = require('../models/Transaction.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const mongoose = require('mongoose');

// @route   POST /api/disputes
// @desc    Customer raises a dispute for an order
// @access  Private (Role: customer)
const createDispute = async (req, res, next) => {
  try {
    const { sendNotification } = require('../utils/notifier');
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

    // Notify Vendor
    const vendor = await Vendor.findById(order.vendor_id);
    if (vendor) {
      await sendNotification(req.app, vendor.user_id, {
        title: 'Dispute Raised',
        message: `A dispute has been raised for Order #${order._id.toString().slice(-6)}.`,
        type: 'system_alert'
      });
    }

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
      .populate('initiator_id', 'name email avatar')
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

      // 2. Logic for Escrow: credit back to buyer wallet
      if (escrow && escrow.status === 'held') {
        const buyer = await User.findById(escrow.buyer_id).session(session);
        buyer.wallet_balance += escrow.amount;
        await buyer.save({ session });

        // Record refund transaction
        await Transaction.create([{
          user_id: buyer._id,
          type: 'refund',
          amount: escrow.amount,
          reference: generateTxRef(),
          status: 'completed',
          description: `Dispute Resolution: Full Refund for Order #${order._id.toString().slice(-6).toUpperCase()}`,
          order_id: order._id,
        }], { session });

        escrow.status = 'refunded';
        escrow.refund_reason = admin_notes || 'Dispute resolution: Full Refund';
        await escrow.save({ session });
      }

    } else if (resolution_type === 'release_payment') {
      // Release funds to vendor from escrow
      order.order_status = 'completed';
      
      if (escrow && escrow.status === 'held') {
        const vendorAccount = await Vendor.findById(escrow.vendor_id).session(session);
        const vendorUser = await User.findById(vendorAccount.user_id).session(session);
        const settings = await PlatformSettings.getSettings();
        
        const platformFee = (escrow.amount * settings.commission_rate) / 100;
        const vendorPayout = escrow.amount - platformFee;

        vendorUser.wallet_balance += vendorPayout;
        await vendorUser.save({ session });

        // Update Platform Earnings
        settings.platform_wallet_balance += platformFee;
        await settings.save({ session });

        // Update/Create Vendor Payout Transaction
        await Transaction.findOneAndUpdate(
          { order_id: order._id, user_id: vendorUser._id, type: 'payout', status: 'pending' },
          { 
            status: 'completed', 
            amount: vendorPayout, 
            description: `Admin Dispute Release (Fee ${settings.commission_rate}% deducted).` 
          },
          { session, returnDocument: 'after', upsert: true }
        );

        escrow.status = 'released';
        escrow.release_date = new Date();
        await escrow.save({ session });
      }
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
      .populate('initiator_id', 'name email avatar')
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

