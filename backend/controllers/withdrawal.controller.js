/**
 * controllers/withdrawal.controller.js
 * Auradime — Withdrawal Request System (Eversend Payout)
 *
 * Flow:
 *   1. User/Vendor submits → status: "pending" (Immediate balance deduction & Pending Transaction)
 *   2. Admin approves → Eversend 2-step payout → Status completed
 *   3. Admin rejects → status: "rejected" (Refund balance, Status failed)
 *   4. Admin rechecks → sync Eversend status, refund if failed.
 */

const mongoose = require('mongoose');
const User = require('../models/User.model');
const Vendor = require('../models/Vendor.model');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const Transaction = require('../models/Transaction.model');
const eversend = require('../services/eversend.service');
const { sendNotification } = require('../utils/notifier');
const crypto = require('crypto');

const generateTxRef = () => `AURA-WD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

// ── 1. SUBMIT WITHDRAWAL REQUEST ─────────────────────────────────────────────
// @route  POST /api/withdrawals
// @access Private (user/vendor)
const submitWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, currency = 'XAF', withdrawalMethod, recipientDetails, note } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!['momo', 'bank', 'eversend'].includes(withdrawalMethod)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid withdrawal method. Choose momo, bank, or eversend.' });
    }

    if (!amount || amount < 1000) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is 1,000 XAF.' });
    }

    const { firstName, lastName, country } = recipientDetails || {};
    if (!firstName || !lastName || !country) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Recipient first name, last name, and country are required.' });
    }

    if (withdrawalMethod === 'momo' && !recipientDetails?.phoneNumber) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Phone number is required for Mobile Money withdrawal.' });
    }
    if (withdrawalMethod === 'bank' && (!recipientDetails?.bankCode || !recipientDetails?.accountNumber)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Bank code and account number are required for bank withdrawal.' });
    }
    if (withdrawalMethod === 'eversend' && !recipientDetails?.eversendTag && !recipientDetails?.beneficiaryId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Eversend tag or Beneficiary ID is required.' });
    }

    const user = await User.findById(userId).session(session);
    if (!user.is_active) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Your account is suspended. Withdrawals are disabled.' });
    }

    if (user.wallet_balance < amount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. You have ${user.wallet_balance.toLocaleString()} ${currency} available.`,
        data: { available: user.wallet_balance, required: amount }
      });
    }

    const existingPending = await WithdrawalRequest.findOne({
      requestedBy: userId,
      status: 'pending',
    }).session(session);
    
    if (existingPending) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request. Please wait for it to be processed.',
        data: { existing_id: existingPending._id, submitted_at: existingPending.createdAt }
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentRequest = await WithdrawalRequest.findOne({
      requestedBy: userId,
      createdAt: { $gte: oneDayAgo },
      status: { $in: ['approved', 'completed', 'failed', 'processing_error'] },
    }).session(session);
    
    if (recentRequest) {
      await session.abortTransaction();
      session.endSession();
      const nextAllowed = new Date(recentRequest.createdAt.getTime() + 24 * 60 * 60 * 1000);
      return res.status(429).json({
        success: false,
        message: `You can only submit one withdrawal per 24 hours. You may submit again after ${nextAllowed.toLocaleString()}.`,
      });
    }

    const role = ['vendor', 'logistics'].includes(userRole) ? userRole : 'user';

    // ── Immediate Balance Deduction
    user.wallet_balance -= amount;
    await user.save({ session });

    // ── Create request
    const [withdrawalRequest] = await WithdrawalRequest.create([{
      requestedBy: userId,
      role,
      amount,
      currency,
      withdrawalMethod,
      recipientDetails: {
        phoneNumber:   recipientDetails.phoneNumber   || null,
        bankCode:      recipientDetails.bankCode      || null,
        accountNumber: recipientDetails.accountNumber || null,
        eversendTag:   recipientDetails.eversendTag   || null,
        beneficiaryId: recipientDetails.beneficiaryId || null,
        firstName,
        lastName,
        country,
      },
      note: note || null,
      status: 'pending',
      balanceDeducted: true,
    }], { session, ordered: true });

    // ── Create Pending Transaction Immediately
    await Transaction.create([{
      user_id: userId,
      type: 'withdrawal',
      amount: amount,
      reference: generateTxRef(),
      status: 'pending',
      description: `Withdrawal via ${withdrawalMethod.toUpperCase()} to ${recipientDetails.phoneNumber || recipientDetails.accountNumber || recipientDetails.eversendTag || recipientDetails.beneficiaryId}`,
      gateway: 'eversend',
      currency: currency,
      metadata: { withdrawal_request_id: withdrawalRequest._id },
    }], { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    // ── Notify admins
    setImmediate(async () => {
      try {
        const admins = await User.find({ role: 'admin', is_active: true }).select('_id');
        await Promise.allSettled(admins.map(admin =>
          sendNotification(req.app, admin._id, {
            title: '💸 New Withdrawal Request',
            message: `${user.name || 'A user'} (${role}) has requested a withdrawal of ${amount.toLocaleString()} ${currency} via ${withdrawalMethod.toUpperCase()}.`,
            type: 'admin_alert',
            metadata: { withdrawal_id: withdrawalRequest._id, link: '/admin/withdrawals' },
            sendEmail: false,
          })
        ));

        await sendNotification(req.app, userId, {
          title: 'Withdrawal Request Submitted',
          message: `Your withdrawal request of ${amount.toLocaleString()} ${currency} has been submitted and is pending admin approval.`,
          type: 'wallet_update',
          metadata: { withdrawal_id: withdrawalRequest._id, link: '/wallet' },
          sendEmail: true,
        });
      } catch (err) {
        console.error('[Withdrawal] Notification error:', err.message);
      }
    });

    return res.status(201).json({
      success: true,
      message: `Your withdrawal request of ${amount.toLocaleString()} ${currency} has been submitted and is pending admin approval.`,
      data: { withdrawal: withdrawalRequest },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('[submitWithdrawal]', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ── 2. GET MY WITHDRAWALS ─────────────────────────────────────────────────────
const getMyWithdrawals = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { requestedBy: req.user._id };
    if (status && status !== 'all') query.status = status;

    const total = await WithdrawalRequest.countDocuments(query);
    const withdrawals = await WithdrawalRequest.find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      data: { withdrawals, total, page: Number(page), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[getMyWithdrawals]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── 3. ADMIN: GET ALL WITHDRAWALS ─────────────────────────────────────────────
const adminGetAllWithdrawals = async (req, res) => {
  try {
    const { status, role, currency, from, to, page = 1, limit = 30 } = req.query;
    const query = {};

    if (status && status !== 'all') query.status = status;
    if (role   && role   !== 'all') query.role = role;
    if (currency) query.currency = currency;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to)   query.createdAt.$lte = new Date(to);
    }

    const total = await WithdrawalRequest.countDocuments(query);
    const pendingCount = await WithdrawalRequest.countDocuments({ status: 'pending' });
    const withdrawals = await WithdrawalRequest.find(query)
      .populate('requestedBy', 'name email phone avatar role')
      .populate('reviewedBy', 'name email')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      data: { withdrawals, total, pendingCount, page: Number(page), pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[adminGetAllWithdrawals]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── 4. ADMIN: APPROVE WITHDRAWAL ──────────────────────────────────────────────
const adminApproveWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wr = await WithdrawalRequest.findById(req.params.id).session(session);

    if (!wr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Withdrawal request not found.' });
    }
    if (wr.status !== 'pending') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Cannot approve a request with status: ${wr.status}.` });
    }

    const user = await User.findById(wr.requestedBy).session(session);

    let quotationToken;
    try {
      const quotation = await eversend.getPayoutQuotation(
        wr.amount,
        wr.currency,
        wr.currency,
        wr.recipientDetails.country,
        wr.withdrawalMethod
      );
      
      const balanceAfter = quotation?.data?.quotation?.sourceCurrencyBalanceAfter;
      if (balanceAfter !== undefined && balanceAfter < 0) {
        throw new Error(`Insufficient funds in Eversend ${wr.currency} wallet.`);
      }
      
      quotationToken = quotation?.data?.token || quotation?.token;
      if (!quotationToken) throw new Error('No quotation token returned from Eversend.');
    } catch (quotErr) {
      await session.abortTransaction();
      session.endSession();
      console.error('[adminApproveWithdrawal] Quotation failed:', quotErr.message);
      return res.status(502).json({
        success: false,
        message: `Eversend quotation failed: ${quotErr.response?.data?.message || quotErr.message}. Please try again.`,
      });
    }

    let payoutResult;
    const { recipientDetails } = wr;
    const txRef = wr._id.toString();

    try {
      if (wr.withdrawalMethod === 'momo') {
        payoutResult = await eversend.executeMomoPayout(quotationToken, recipientDetails.phoneNumber, recipientDetails.firstName, recipientDetails.lastName, recipientDetails.country, txRef);
      } else if (wr.withdrawalMethod === 'bank') {
        payoutResult = await eversend.executeBankPayout(quotationToken, recipientDetails.bankCode, recipientDetails.accountNumber, recipientDetails.firstName, recipientDetails.lastName, recipientDetails.country, txRef);
      } else if (wr.withdrawalMethod === 'eversend') {
        if (recipientDetails.beneficiaryId) {
          payoutResult = await eversend.executeBeneficiaryPayout(quotationToken, recipientDetails.beneficiaryId, txRef);
        } else {
          payoutResult = await eversend.executeEversendPayout(quotationToken, recipientDetails.eversendTag, txRef);
        }
      }
    } catch (payoutErr) {
      // Payout failed — refund user
      wr.status = 'failed';
      wr.failureReason = payoutErr.response?.data?.message || payoutErr.message;
      wr.reviewedBy = req.user._id;
      wr.reviewedAt = new Date();
      wr.balanceDeducted = false;
      await wr.save({ session });
      
      user.wallet_balance += wr.amount;
      await user.save({ session });
      
      await Transaction.updateOne(
        { "metadata.withdrawal_request_id": wr._id },
        { status: 'failed' },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      setImmediate(async () => {
        try {
          await sendNotification(req.app, wr.requestedBy, {
            title: 'Payout Failed',
            message: `Your withdrawal was approved but the payout failed. Reason: ${wr.failureReason}. Your balance has been restored.`,
            type: 'wallet_update',
            metadata: { withdrawal_id: wr._id, link: '/wallet' },
            sendEmail: true,
          });
        } catch (e) { console.error(e.message); }
      });

      return res.status(502).json({
        success: false,
        message: `Eversend payout failed: ${wr.failureReason}. Withdrawal marked as failed. User balance restored.`,
      });
    }

    const eversendTxId = payoutResult?.data?.transactionId || payoutResult?.transactionId;
    const eversendStatus = payoutResult?.data?.status || payoutResult?.status || 'pending';

    wr.status = 'approved';
    wr.eversendTransactionId = eversendTxId;
    wr.eversendQuotationToken = quotationToken;
    wr.eversendStatus = eversendStatus;
    wr.reviewedBy = req.user._id;
    wr.reviewedAt = new Date();
    await wr.save({ session });

    // Update Transaction status
    await Transaction.updateOne(
      { "metadata.withdrawal_request_id": wr._id },
      { status: 'completed', gateway_transaction_id: eversendTxId },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    setImmediate(async () => {
      try {
        await sendNotification(req.app, wr.requestedBy, {
          title: 'Withdrawal Approved — Processing',
          message: `Your withdrawal of ${wr.amount.toLocaleString()} ${wr.currency} has been approved and is being processed. Eversend Ref: ${eversendTxId || wr._id}.`,
          type: 'wallet_update',
          metadata: { withdrawal_id: wr._id, link: '/wallet' },
          sendEmail: true,
        });
      } catch (e) { console.error(e.message); }
    });

    return res.status(200).json({
      success: true,
      message: 'Withdrawal approved. Payout sent to Eversend.',
      data: { withdrawal: wr, eversendTransactionId: eversendTxId },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('[adminApproveWithdrawal]', err);
    return res.status(500).json({ success: false, message: 'Server error during approval.' });
  }
};

// ── 5. ADMIN: REJECT WITHDRAWAL ───────────────────────────────────────────────
const adminRejectWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim().length < 5) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'A rejection reason (min 5 characters) is required.' });
    }

    const wr = await WithdrawalRequest.findById(req.params.id).session(session);
    if (!wr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Withdrawal request not found.' });
    }
    
    if (wr.status !== 'pending') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Cannot reject a request with status: ${wr.status}.` });
    }

    wr.status = 'rejected';
    wr.rejectionReason = rejectionReason.trim();
    wr.reviewedBy = req.user._id;
    wr.reviewedAt = new Date();
    
    // Refund balance
    const user = await User.findById(wr.requestedBy).session(session);
    if (user && wr.balanceDeducted) {
        user.wallet_balance += wr.amount;
        await user.save({ session });
        wr.balanceDeducted = false;
    }
    await wr.save({ session });
    
    await Transaction.updateOne(
      { "metadata.withdrawal_request_id": wr._id },
      { status: 'failed' },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    setImmediate(async () => {
      try {
        await sendNotification(req.app, wr.requestedBy, {
          title: 'Withdrawal Request Rejected',
          message: `Your withdrawal request of ${wr.amount.toLocaleString()} ${wr.currency} has been rejected. Reason: ${rejectionReason}. Funds restored.`,
          type: 'wallet_update',
          metadata: { withdrawal_id: wr._id, link: '/wallet' },
          sendEmail: true,
        });
      } catch (e) { console.error(e.message); }
    });

    return res.status(200).json({
      success: true,
      message: 'Withdrawal request rejected. Balance restored and User notified.',
      data: { withdrawal: wr },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('[adminRejectWithdrawal]', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── 6. ADMIN: RECHECK WITHDRAWAL ──────────────────────────────────────────────
const adminRecheckWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wr = await WithdrawalRequest.findById(req.params.id).session(session);

    if (!wr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Withdrawal request not found.' });
    }
    if (!wr.eversendTransactionId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'No Eversend transaction ID on this record. Cannot recheck.' });
    }

    let txData;
    try {
      const result = await eversend.getTransactionStatus(wr.eversendTransactionId);
      txData = result?.data || result;
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      return res.status(502).json({ success: false, message: `Eversend status check failed: ${e.message}` });
    }

    const eversendStatus = (txData?.status || '').toUpperCase();
    wr.eversendStatus = eversendStatus;

    if (eversendStatus === 'SUCCESSFUL') {
      wr.status = 'completed';
      await wr.save({ session });
      
      await Transaction.updateOne(
        { "metadata.withdrawal_request_id": wr._id },
        { status: 'completed' },
        { session }
      );
      
      await session.commitTransaction();
      session.endSession();

      setImmediate(async () => {
        try {
          await sendNotification(req.app, wr.requestedBy, {
            title: '✅ Withdrawal Successful',
            message: `Your withdrawal of ${wr.amount.toLocaleString()} ${wr.currency} has been confirmed successful.`,
            type: 'wallet_update',
            metadata: { withdrawal_id: wr._id, link: '/wallet' },
            sendEmail: true,
          });
        } catch (e) { console.error(e.message); }
      });

      return res.status(200).json({
        success: true,
        message: 'Withdrawal confirmed successful by Eversend.',
        data: { withdrawal: wr, eversendStatus }
      });

    } else if (eversendStatus === 'FAILED') {
      if (wr.balanceDeducted) {
        const user = await User.findById(wr.requestedBy).session(session);
        user.wallet_balance += wr.amount;
        await user.save({ session });
        wr.balanceDeducted = false;
      }
      wr.status = 'failed';
      wr.failureReason = txData?.reason || 'Eversend reported this payout as failed.';
      await wr.save({ session });
      
      await Transaction.updateOne(
        { "metadata.withdrawal_request_id": wr._id },
        { status: 'failed' },
        { session }
      );
      
      await session.commitTransaction();
      session.endSession();

      setImmediate(async () => {
        try {
          await sendNotification(req.app, wr.requestedBy, {
            title: '❌ Withdrawal Failed',
            message: `Your withdrawal payout failed on Eversend. Your balance has been restored. Reference: ${wr._id}.`,
            type: 'wallet_update',
            metadata: { withdrawal_id: wr._id, link: '/wallet' },
            sendEmail: true,
          });
        } catch (e) { console.error(e.message); }
      });

      return res.status(200).json({
        success: true,
        message: 'Withdrawal marked as failed. Balance restored.',
        data: { withdrawal: wr, eversendStatus }
      });

    } else {
      await wr.save({ session });
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: `Withdrawal is still ${eversendStatus || 'PENDING'} on Eversend. Try again later.`,
        data: { withdrawal: wr, eversendStatus }
      });
    }
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('[adminRecheckWithdrawal]', err);
    return res.status(500).json({ success: false, message: 'Server error during recheck.' });
  }
};

module.exports = {
  submitWithdrawal,
  getMyWithdrawals,
  adminGetAllWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminRecheckWithdrawal,
};
