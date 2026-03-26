/**
 * controllers/wallet.controller.js
 * Aura Market — Wallet & Transaction Management
 */

const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const Order = require('../models/Order.model');
const Escrow = require('../models/Escrow.model');
const Vendor = require('../models/Vendor.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logisticsService = require('../services/logistics.service');
const { sendNotification } = require('../utils/notifier');

// Helper to generate a unique transaction reference
const generateTxRef = () => `AURA-TX-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

// ─────────────────────────────────────────────
// @route   GET /api/wallet
// @desc    Get current user's wallet balance
// @access  Private
// ─────────────────────────────────────────────
const getWalletBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('wallet_balance role');
    let pendingEscrow = 0;

    if (user.role === 'vendor') {
      const vendor = await Vendor.findOne({ user_id: user._id });
      if (vendor) {
        const stats = await Escrow.aggregate([
          { $match: { vendor_id: vendor._id, status: 'held' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        pendingEscrow = stats[0]?.total || 0;
      }
    }

    res.status(200).json({ 
      success: true, 
      data: { 
        balance: user.wallet_balance,
        pending_escrow: pendingEscrow
      } 
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/wallet/transactions
// @desc    Get user's transaction history
// @access  Private
// ─────────────────────────────────────────────
const getTransactionHistory = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ user_id: req.user._id })
      .sort('-createdAt');

    res.status(200).json({ success: true, count: transactions.length, data: { transactions } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/wallet/deposit
// @desc    Initialize a deposit (simulated)
// @access  Private
// ─────────────────────────────────────────────
const initiateDeposit = async (req, res, next) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deposit amount.' });
    }

    // In a real flow, this initiates a Paystack/Flutterwave session
    // For now, we simulate a direct success:
    const transaction = await Transaction.create({
      user_id: req.user._id,
      type: 'deposit',
      amount,
      reference: generateTxRef(),
      status: 'completed', // Simulated auto-completion
      description: 'Wallet deposit via Card/Mobile Money',
    });

    // Update User Wallet
    const user = await User.findById(req.user._id);
    user.wallet_balance += amount;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Deposit successful (Simulated)',
      data: { transaction, new_balance: user.wallet_balance },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/wallet/withdraw
// @desc    Request a withdrawal (Admin approval required)
// @access  Private
// ─────────────────────────────────────────────
const requestWithdrawal = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount } = req.body;
    const user = await User.findById(req.user._id).session(session);

    if (amount <= 0 || user.wallet_balance < amount) {
      throw new Error('Insufficient wallet balance or invalid amount.');
    }

    // Deduct from wallet immediately to prevent double spending
    user.wallet_balance -= amount;
    await user.save({ session });

    // Create pending withdrawal transaction
    const transaction = await Transaction.create([{
      user_id: req.user._id,
      type: 'withdrawal',
      amount,
      reference: generateTxRef(),
      status: 'pending', // Requires admin approval
      description: 'Wallet withdrawal request',
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted for approval.',
      data: { transaction: transaction[0], remaining_balance: user.wallet_balance },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.message.includes('Insufficient')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/wallet/admin/withdrawals/:id
// @desc    Admin: Approve or Reject a withdrawal
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const processWithdrawal = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { action } = req.body; // 'approve' or 'reject'
    const transaction = await Transaction.findById(req.params.id).session(session);

    if (!transaction || transaction.type !== 'withdrawal' || transaction.status !== 'pending') {
      throw new Error('Invalid or already processed withdrawal request.');
    }

    if (action === 'approve') {
      transaction.status = 'completed';
      // In production, trigger external payout API here mapping to vendor's bank account
    } else if (action === 'reject') {
      transaction.status = 'rejected';
      // Refund the wallet since we deducted it during the request phase
      const user = await User.findById(transaction.user_id).session(session);
      user.wallet_balance += transaction.amount;
      await user.save({ session });
    } else {
      throw new Error("Invalid action. Use 'approve' or 'reject'.");
    }

    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: `Withdrawal successfully ${action}ed.`,
      data: { transaction },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.message.includes('Invalid')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/wallet/pay-order
// @desc    Pay for an order using Wallet Balance
// @access  Private
// ─────────────────────────────────────────────
const payOrderWithWallet = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { order_id } = req.body;
    
    const order = await Order.findById(order_id).session(session);
    if (!order) throw new Error('Order not found.');
    if (order.customer_id.toString() !== req.user._id.toString()) throw new Error('Not your order.');
    if (order.payment_status !== 'pending') throw new Error(`Order is already ${order.payment_status}.`);
    if (order.payment_method !== 'wallet') throw new Error('Order payment method is not configured for wallet.');

    const user = await User.findById(req.user._id).session(session);

    if (user.wallet_balance < order.total_amount) {
      throw new Error('Insufficient wallet balance to cover this order.');
    }

    // 1. Deduct customer balance
    user.wallet_balance -= order.total_amount;
    await user.save({ session });

    // 2. Log transaction
    await Transaction.create([{
      user_id: user._id,
      type: 'payment',
      amount: order.total_amount,
      reference: generateTxRef(),
      status: 'completed',
      description: `Payment for Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order_id: order._id,
    }], { session });

    // 3. Mark order as Paid
    order.payment_status = 'paid';
    
    // Auto-progress order_status ONLY if no Escrow is involved
    // Assuming 'wallet' direct payments skip Escrow. 
    order.order_status = 'processing'; 
    await order.save({ session });

    // Auto-create shipment tickets when logistics delivery is selected
    if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
      const quartier = order.shipping_address?.quartier;
      if (quartier) {
        await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
        const logisticsFirm = await LogisticsCompany.findById(order.logistics_company_id).session(session);
        if (logisticsFirm) {
          await sendNotification(req.app, logisticsFirm.user_id, {
            title: 'New Shipment Assigned',
            message: `You have a new shipment for order #${order._id.toString().slice(-6).toUpperCase()}.`,
            type: 'system_alert',
            metadata: { order_id: order._id, link: '/logistics/dashboard' },
            sendEmail: true,
            emailLink: `${process.env.WEB_CLIENT_URL}/logistics/dashboard`,
            orderDetails: order,
            role: 'logistics'
          });
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Order paid successfully via Wallet.',
      data: { order, remaining_balance: user.wallet_balance },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getWalletBalance,
  getTransactionHistory,
  initiateDeposit,
  requestWithdrawal,
  processWithdrawal,
  payOrderWithWallet,
};
