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
const PlatformSettings = require('../models/PlatformSettings.model');
const Message = require('../models/Message.model');
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
// @route   GET /api/wallet/config
// @desc    Get wallet rules (withdrawal fee/minimum)
// @access  Private
// ─────────────────────────────────────────────
const getWalletConfig = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();
    res.status(200).json({
      success: true,
      data: {
        withdrawal_fee: Number(settings.withdrawal_fee || 0),
        min_withdrawal_amount: Number(settings.min_withdrawal_amount || 0),
      }
    });
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
    const { amount, method, details } = req.body;
    const user = await User.findById(req.user._id).session(session);
    const settings = await PlatformSettings.getSettings();
    const minWithdrawal = Number(settings?.min_withdrawal_amount || 1000);
    const withdrawalFee = Number(settings?.withdrawal_fee || 0);
    const requestedAmount = Number(amount || 0);
    const totalDebit = requestedAmount + withdrawalFee;

    if (!requestedAmount || requestedAmount < minWithdrawal) {
      throw new Error(`Minimum withdrawal amount is ${minWithdrawal.toLocaleString()} XAF.`);
    }

    if (user.wallet_balance < totalDebit) {
      throw new Error('Insufficient wallet balance.');
    }

    const ALLOWED_METHODS = ['mtn', 'orange'];
    if (!method || !ALLOWED_METHODS.includes(method)) {
      throw new Error('Invalid withdrawal method. Choose MTN MoMo or Orange Money.');
    }

    if (!details?.account_number) {
      throw new Error('Phone number is required for mobile money withdrawal.');
    }

    // Deduct from wallet immediately to prevent double spending
    user.wallet_balance -= totalDebit;
    await user.save({ session });

    // Create a descriptive label
    const methodLabels = { mtn: 'MTN MoMo', orange: 'Orange Money', bank: 'Bank Transfer' };
    const methodLabel = methodLabels[method] || method.toUpperCase();
    const accountRef = details?.account_number ? ` (${details.account_number})` : '';

    // Create pending withdrawal transaction
    const transaction = await Transaction.create([{
      user_id: req.user._id,
      type: 'withdrawal',
      amount: requestedAmount,
      reference: generateTxRef(),
      status: 'pending', // Requires admin approval
      description: `Withdrawal to ${methodLabel}${accountRef}`,
      gateway_response: {
        method,
        details,
        fee_amount: withdrawalFee,
        total_debited: totalDebit,
        payout_amount: requestedAmount,
        requested_at: new Date()
      } // Store structured data
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted for approval.',
      data: {
        transaction: transaction[0],
        remaining_balance: user.wallet_balance,
        fee_amount: withdrawalFee,
        total_debited: totalDebit
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.message.includes('Insufficient') || error.message.includes('required')) {
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
      const payoutService = require('../services/payout.service');
      const details = transaction.gateway_response?.details || {};
      const method = transaction.gateway_response?.method || 'mtn';
      const payoutAmount = Number(transaction.gateway_response?.payout_amount || transaction.amount);
      const feeAmount = Number(transaction.gateway_response?.fee_amount || 0);

      try {
        const payout = await payoutService.triggerMobilePayout(
          payoutAmount,
          details.account_number,
          method
        );

        if (payout.success) {
          transaction.status = 'completed';
          transaction.description += ` | Ref: ${payout.reference}`;
          transaction.gateway_response = { 
            ...transaction.gateway_response, 
            payout_ref: payout.reference, 
            processed_at: new Date() 
          };

          if (feeAmount > 0) {
            const settings = await PlatformSettings.getSettings();
            settings.platform_wallet_balance += feeAmount;
            await settings.save({ session });
          }
        } else {
          throw new Error(payout.message || 'Payout failed at gateway');
        }
      } catch (payoutErr) {
        console.error('[Withdrawal Approval] Payout Engine Error:', payoutErr.message);
        throw new Error(`Payout Failed: ${payoutErr.message}`);
      }
    } else if (action === 'reject') {
      transaction.status = 'rejected';
      // Refund the wallet since we deducted it during the request phase
      const user = await User.findById(transaction.user_id).session(session);
      const totalDebited = Number(transaction.gateway_response?.total_debited || transaction.amount);
      user.wallet_balance += totalDebited;
      await user.save({ session });
    } else if (action === 'hold') {
      // For now, hold just confirms it's pending but perhaps we add a flag
      transaction.status = 'pending';
      transaction.description += ' (On Hold by Admin)';
    } else {
      throw new Error("Invalid action. Use 'approve', 'reject', or 'hold'.");
    }

    // Audit Log
    const { logAction } = require('./audit.controller');
    await logAction(
      req.user._id, 
      'withdrawal_process', 
      'transaction', 
      transaction._id, 
      { action, amount: transaction.amount }
    );

    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Notify User via Notification System
    setImmediate(async () => {
        try {
            const statusLabel = action === 'approve' ? 'Processed' : action === 'reject' ? 'Rejected' : 'Held';
            const actionVerb = action === 'approve' ? 'processed' : action === 'reject' ? 'rejected and refunded' : 'placed on hold';
            const msgText = `Your withdrawal of ${transaction.amount.toLocaleString()} XAF has been ${actionVerb}. Reference: ${transaction.reference}`;

            // 1. Send Standard Notification
            await sendNotification(req.app, transaction.user_id, {
                title: `Withdrawal ${statusLabel}`,
                message: msgText,
                type: 'wallet_update',
                metadata: { transaction_id: transaction._id, link: '/wallet' },
                sendEmail: true
            });

            // 2. Send Chat Message from Admin to User (System Comm as Message)
            const chatMsg = await Message.create({
                sender_id: req.user._id,
                receiver_id: transaction.user_id,
                text: `📢 [SYSTEM] ${msgText}`,
                metadata: { type: 'system_wallet', transaction_id: transaction._id }
            });

            const io = req.app.get('io');
            if (io) {
                const populated = await Message.findById(chatMsg._id)
                    .populate('sender_id', 'name avatar role branding')
                    .populate('receiver_id', 'name avatar role branding');
                
                io.to(transaction.user_id.toString()).emit('receive_message', populated);
                io.to(req.user._id.toString()).emit('sent_message_echo', populated);
            }
        } catch (notifierErr) {
            console.error('Withdrawal Notifier/Chat Error:', notifierErr);
        }
    });

    res.status(200).json({
      success: true,
      message: `Withdrawal successfully ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'held'}.`,
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
    
    // 4. Handle Funds (Escrow vs Direct)
    const settings = await PlatformSettings.getSettings();
    const platformFee = (order.total_amount * settings.commission_rate) / 100;
    const vendorPayout = order.total_amount - platformFee;

    if (order.escrow_enabled) {
      // Create Escrow Record (Held)
      await Escrow.create([{
        order_id: order._id,
        vendor_id: order.vendor_id,
        customer_id: order.customer_id,
        amount: order.total_amount,
        status: 'held'
      }], { session });

      // Log pending payout for Vendor
      const vendorRecord = await Vendor.findById(order.vendor_id).session(session);
      await Transaction.create([{
        user_id: vendorRecord.user_id,
        type: 'payout',
        amount: vendorPayout,
        reference: `PAYOUT-PEND-${order._id.toString().slice(-6).toUpperCase()}`,
        status: 'pending',
        description: `Pending payout for Order #${order._id.toString().slice(-6).toUpperCase()} (Escrow)`,
        order_id: order._id,
      }], { session });

      order.order_status = 'placed'; // Reset to placed while in escrow? 
      // Actually, if paid, it should be processing.
      order.order_status = 'processing';
    } else {
      // Direct Payout (No Escrow)
      const vendorRecord = await Vendor.findById(order.vendor_id).session(session);
      const vendorUser = await User.findById(vendorRecord.user_id).session(session);
      
      // Transfer to Vendor
      vendorUser.wallet_balance += vendorPayout;
      await vendorUser.save({ session });

      // Transfer Fee to Platform
      settings.platform_wallet_balance += platformFee;
      await settings.save({ session });

      // Log completed payout for Vendor
      await Transaction.create([{
        user_id: vendorUser._id,
        type: 'payout',
        amount: vendorPayout,
        reference: `PAYOUT-DIRECT-${order._id.toString().slice(-6).toUpperCase()}`,
        status: 'completed',
        description: `Direct payout for Order #${order._id.toString().slice(-6).toUpperCase()} (No Escrow)`,
        order_id: order._id,
      }], { session });

      // Log Platform Revenue
      await Transaction.create([{
        user_id: vendorUser._id, // Linked to vendor for trace
        type: 'payment',
        amount: platformFee,
        reference: `REV-DIR-${Date.now()}`,
        status: 'completed',
        description: `Commission from Order #${order._id.toString().slice(-6).toUpperCase()}`,
        order_id: order._id,
      }], { session });

      order.order_status = 'processing';
    }

    await order.save({ session });

    // Auto-create shipment tickets when logistics delivery is selected
    if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
      const quartier = order.shipping_address?.quartier;
      if (quartier) {
        await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
        const logisticsFirm = await LogisticsCompany.findById(order.logistics_company_id).session(session);
        if (logisticsFirm) {
          const orderWithVendor = order.toObject();
          const v = await Vendor.findById(order.vendor_id).session(session);
          orderWithVendor.vendor_id = v;

          await sendNotification(req.app, logisticsFirm.user_id, {
            title: 'New Shipment Assigned',
            message: `You have a new shipment for order #${order._id.toString().slice(-6).toUpperCase()}.`,
            type: 'system_alert',
            metadata: { order_id: order._id, link: '/logistics/dashboard' },
            sendEmail: true,
            emailLink: `${process.env.WEB_CLIENT_URL}/logistics/dashboard`,
            orderDetails: orderWithVendor,
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

const getAllWithdrawals = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { type: 'withdrawal' };
    if (status && status !== 'all') query.status = status;

    const withdrawals = await Transaction.find(query)
      .populate('user_id', 'name email phone avatar')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: withdrawals.length, data: { withdrawals } });
  } catch (error) {
    next(error);
  }
};

const getEscrowTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({
      user_id: req.user._id,
      type: 'payout',
      status: 'pending'
    })
    .populate('order_id', 'order_status products total_amount')
    .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: { transactions }
    });
  } catch (error) { next(error); }
};

const getPlatformFinancialStats = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();
    
    const [escrowStats, withdrawalStats] = await Promise.all([
      Escrow.aggregate([
        { $match: { status: 'held' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { type: 'withdrawal', status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        total_platform_revenue: settings.platform_wallet_balance || 0,
        total_escrow_held: escrowStats[0]?.total || 0,
        total_pending_withdrawals: withdrawalStats[0]?.total || 0,
        commission_rate: settings.commission_rate
      }
    });
  } catch (error) { next(error); }
};

module.exports = {
  getWalletBalance,
  getWalletConfig,
  getTransactionHistory,
  initiateDeposit,
  requestWithdrawal,
  processWithdrawal,
  getAllWithdrawals,
  payOrderWithWallet,
  getEscrowTransactions,
  getPlatformFinancialStats,
};
