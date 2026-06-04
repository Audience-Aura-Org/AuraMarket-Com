/**
 * controllers/withdrawal.controller.js
 * Auradime — Withdrawal Request System (Eversend / MeSomb Payout)
 *
 * Flow:
 *   1. User/Vendor submits → status: "pending" (Immediate balance deduction & Pending Transaction)
 *   2. Admin approves → selected payout gateway → Status completed/approved
 *   3. Admin rejects → status: "rejected" (Refund balance, Status failed)
 *   4. Admin rechecks → sync gateway status, refund if failed.
 */

const mongoose = require('mongoose');
const User = require('../models/User.model');
const Vendor = require('../models/Vendor.model');
require('../models/Store.model');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const Transaction = require('../models/Transaction.model');
const eversend = require('../services/eversend.service');
const mesomb = require('../services/mesomb.service');
const { sendNotification } = require('../utils/notifier');
const crypto = require('crypto');

const generateTxRef = () => `AURA-WD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
const VALID_WITHDRAWAL_METHODS = ['momo', 'bank'];
const VALID_PAYOUT_GATEWAYS = ['eversend', 'mesomb'];

const getWithdrawalDestination = (wr) => {
  const d = wr.recipientDetails || {};
  return d.phoneNumber || d.accountNumber || d.eversendTag || d.beneficiaryId || 'recipient';
};

const getMesombTxId = (response) => response?.transaction?.pk || response?.pk || response?.id || response?.transactionId || null;

const getGatewayFailureMessage = (error, fallback = 'Gateway rejected the payout.') => {
  const raw = error?.response?.data || error?.data || error?.transaction || error;
  const code = raw?.code || raw?.error?.code || raw?.type || raw?.status || null;
  const message = raw?.message || raw?.error?.message || error?.message || fallback;
  return code ? `${message} (${code})` : message;
};

const firstMediaUrl = (...values) => {
  for (const value of values) {
    if (!value) continue;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'object') {
      const nested = firstMediaUrl(value.url, value.secure_url, value.src, value.path);
      if (nested) return nested;
    }
  }
  return null;
};

const buildRequesterProfiles = async (withdrawals) => {
  const userIds = withdrawals
    .map((wr) => wr.requestedBy?._id || wr.requestedBy)
    .filter(Boolean)
    .map((id) => id.toString());

  const vendors = await Vendor.find({ user_id: { $in: userIds } })
    .populate('store')
    .lean({ virtuals: true });

  const vendorByUserId = new Map(vendors.map((vendor) => [vendor.user_id?.toString(), vendor]));

  return withdrawals.map((wrDoc) => {
    const wr = wrDoc.toObject ? wrDoc.toObject({ virtuals: true }) : wrDoc;
    const person = wr.requestedBy || {};
    const vendor = vendorByUserId.get((person._id || wr.requestedBy || '').toString()) || null;
    const store = vendor?.store || null;
    const branding = person.branding || {};

    const recipientName = wr.recipientDetails?.firstName && wr.recipientDetails?.lastName
      ? `${wr.recipientDetails.firstName} ${wr.recipientDetails.lastName}`
      : null;

    const displayName =
      store?.store_name ||
      vendor?.store_name ||
      branding.store_name ||
      branding.storeName ||
      person.store_name ||
      person.storeName ||
      person.name ||
      recipientName ||
      person.email ||
      `${wr.role || person.role || 'User'} account`;

    const avatar = firstMediaUrl(
      person.avatar,
      branding.logo,
      branding.logo_url,
      branding.logoUrl,
      branding.avatar,
      branding.avatar_url,
      branding.avatarUrl
    );
    const logo = firstMediaUrl(
      store?.logo,
      vendor?.logo,
      avatar,
      branding.image,
      branding.image_url,
      branding.imageUrl
    );

    return {
      ...wr,
      requesterProfile: {
        name: displayName,
        accountName: person.name || displayName,
        storeName: vendor?.store_name || null,
        logo,
        avatar,
        image: logo || avatar,
        banner: store?.banner || branding.banner || null,
        email: person.email || null,
        phone: person.phone || vendor?.phone || wr.recipientDetails?.phoneNumber || null,
        role: person.role || wr.role,
        vendorId: vendor?._id || null,
        userId: person._id || wr.requestedBy || null,
      },
    };
  });
};

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

    if (!VALID_WITHDRAWAL_METHODS.includes(withdrawalMethod)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid withdrawal method. Choose mobile wallet or bank transfer.' });
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
      payoutGateway: null,
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
      gateway: 'manual',
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
    const withdrawalDocs = await WithdrawalRequest.find(query)
      .populate('requestedBy', 'name email phone avatar role branding store_name storeName')
      .populate('reviewedBy', 'name email')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const withdrawals = await buildRequesterProfiles(withdrawalDocs);

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
    const requestedGateway = req.body?.payoutGateway || req.body?.gateway || null;
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
    if (!user) {
      wr.status = 'failed';
      wr.failureReason = 'Withdrawal owner no longer exists. No payout was sent.';
      wr.reviewedBy = req.user._id;
      wr.reviewedAt = new Date();
      await wr.save({ session });

      await Transaction.updateOne(
        { "metadata.withdrawal_request_id": wr._id },
        { status: 'failed' },
        { session }
      );

      await session.commitTransaction();
      session.endSession();
      return res.status(410).json({
        success: false,
        message: 'Withdrawal owner no longer exists. Request marked as failed and no payout was sent.',
        data: { withdrawal: wr },
      });
    }

    const payoutGateway = requestedGateway || wr.payoutGateway || (wr.withdrawalMethod === 'mesomb' ? 'mesomb' : 'eversend');
    if (!VALID_PAYOUT_GATEWAYS.includes(payoutGateway)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Choose either mesomb or eversend as payout gateway.' });
    }

    if (payoutGateway === 'mesomb' && !wr.recipientDetails?.phoneNumber) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'MeSomb payouts require a mobile money phone number.' });
    }

    if (payoutGateway === 'mesomb' && wr.recipientDetails?.country !== 'CM') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'MeSomb payouts are currently limited to Cameroon XAF mobile money.' });
    }

    let payoutResult = null;
    let payoutTxId = null;
    let payoutStatus = 'pending';
    let quotationToken = null;
    const { recipientDetails } = wr;
    const txRef = wr._id.toString();

    try {
      if (payoutGateway === 'mesomb') {
        const detectedService = mesomb.detectOperator(recipientDetails.phoneNumber);
        if (!detectedService) {
          throw new Error('Could not detect MTN or Orange Money from the recipient phone number.');
        }

        try {
          const appBalance = await mesomb.getApplicationBalance({
            country: recipientDetails.country || 'CM',
            service: detectedService,
          });
          if (appBalance !== null && appBalance < Number(wr.amount)) {
            throw new Error(`MeSomb ${detectedService} balance is ${appBalance.toLocaleString()} ${wr.currency}, below the requested payout of ${Number(wr.amount).toLocaleString()} ${wr.currency}. Refill your MeSomb app balance or approve with Eversend.`);
          }
        } catch (balanceErr) {
          if (/below the requested payout/i.test(balanceErr.message)) throw balanceErr;
          console.warn('[MeSomb] Could not verify app balance before payout:', balanceErr.message);
        }

        payoutResult = await mesomb.makeDeposit({
          amount: wr.amount,
          phone: recipientDetails.phoneNumber,
          service: detectedService,
          currency: wr.currency,
          country: recipientDetails.country,
          trxID: txRef,
          message: `Auradime withdrawal ${txRef.slice(-6).toUpperCase()}`,
          customer: {
            first_name: recipientDetails.firstName,
            last_name: recipientDetails.lastName,
            phone: recipientDetails.phoneNumber,
          },
        });
        payoutTxId = getMesombTxId(payoutResult);
        payoutStatus = mesomb.mapStatus(payoutResult);
        if (payoutStatus === 'FAILED') {
          throw new Error(getGatewayFailureMessage(payoutResult, 'MeSomb rejected the payout.'));
        }
      } else {
        const eversendMethod = wr.withdrawalMethod === 'mesomb' ? 'momo' : wr.withdrawalMethod;
        const quotation = await eversend.getPayoutQuotation(
          wr.amount,
          wr.currency,
          wr.currency,
          recipientDetails.country,
          eversendMethod
        );
        
        const balanceAfter = quotation?.data?.quotation?.sourceCurrencyBalanceAfter;
        if (balanceAfter !== undefined && balanceAfter < 0) {
          throw new Error(`Insufficient funds in Eversend ${wr.currency} wallet.`);
        }
        
        quotationToken = quotation?.data?.token || quotation?.token;
        if (!quotationToken) throw new Error('No quotation token returned from Eversend.');

        if (eversendMethod === 'momo') {
          payoutResult = await eversend.executeMomoPayout(quotationToken, recipientDetails.phoneNumber, recipientDetails.firstName, recipientDetails.lastName, recipientDetails.country, txRef);
        } else if (eversendMethod === 'bank') {
          payoutResult = await eversend.executeBankPayout(quotationToken, recipientDetails.bankCode, recipientDetails.accountNumber, recipientDetails.firstName, recipientDetails.lastName, recipientDetails.country, txRef);
        } else if (eversendMethod === 'eversend') {
          if (recipientDetails.beneficiaryId) {
            payoutResult = await eversend.executeBeneficiaryPayout(quotationToken, recipientDetails.beneficiaryId, txRef);
          } else {
            payoutResult = await eversend.executeEversendPayout(quotationToken, recipientDetails.eversendTag, txRef);
          }
        } else {
          throw new Error('Eversend cannot process this withdrawal method.');
        }
        payoutTxId = payoutResult?.data?.transactionId || payoutResult?.transactionId;
        payoutStatus = payoutResult?.data?.status || payoutResult?.status || 'pending';
      }
    } catch (payoutErr) {
      // Payout failed — refund user
      wr.status = 'failed';
      wr.failureReason = getGatewayFailureMessage(payoutErr, payoutErr.message);
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
        message: `${payoutGateway === 'mesomb' ? 'MeSomb' : 'Eversend'} payout failed: ${wr.failureReason}. Withdrawal marked as failed. User balance restored.`,
      });
    }

    wr.status = payoutGateway === 'mesomb' && payoutStatus === 'SUCCESSFUL' ? 'completed' : 'approved';
    wr.payoutGateway = payoutGateway;
    if (payoutGateway === 'mesomb') {
      wr.mesombTransactionId = payoutTxId || txRef;
      wr.mesombStatus = payoutStatus;
    } else {
      wr.eversendTransactionId = payoutTxId;
      wr.eversendQuotationToken = quotationToken;
      wr.eversendStatus = payoutStatus;
    }
    wr.reviewedBy = req.user._id;
    wr.reviewedAt = new Date();
    await wr.save({ session });

    // Update Transaction status
    await Transaction.updateOne(
      { "metadata.withdrawal_request_id": wr._id },
      {
        status: wr.status === 'completed' ? 'completed' : 'pending',
        gateway: payoutGateway,
        gateway_transaction_id: payoutTxId || txRef,
        gateway_response: payoutResult,
        description: `Withdrawal via ${payoutGateway.toUpperCase()} to ${getWithdrawalDestination(wr)}`,
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    setImmediate(async () => {
      try {
        await sendNotification(req.app, wr.requestedBy, {
          title: wr.status === 'completed' ? 'Withdrawal Successful' : 'Withdrawal Approved — Processing',
          message: `Your withdrawal of ${wr.amount.toLocaleString()} ${wr.currency} has been approved via ${payoutGateway === 'mesomb' ? 'MeSomb' : 'Eversend'}. Reference: ${payoutTxId || wr._id}.`,
          type: 'wallet_update',
          metadata: { withdrawal_id: wr._id, link: '/wallet' },
          sendEmail: true,
        });
      } catch (e) { console.error(e.message); }
    });

    return res.status(200).json({
      success: true,
      message: `Withdrawal approved. Payout sent to ${payoutGateway === 'mesomb' ? 'MeSomb' : 'Eversend'}.`,
      data: { withdrawal: wr, payoutGateway, payoutTransactionId: payoutTxId },
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
    const payoutGateway = wr.payoutGateway || (wr.mesombTransactionId ? 'mesomb' : 'eversend');
    const gatewayTxId = payoutGateway === 'mesomb' ? wr.mesombTransactionId : wr.eversendTransactionId;

    if (!gatewayTxId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `No ${payoutGateway === 'mesomb' ? 'MeSomb' : 'Eversend'} transaction ID on this record. Cannot recheck.` });
    }

    let txData;
    let normalizedStatus;
    try {
      if (payoutGateway === 'mesomb') {
        const result = await mesomb.getTransactionStatus(gatewayTxId);
        txData = result?.data || result;
        normalizedStatus = mesomb.mapStatus(txData);
        wr.mesombStatus = normalizedStatus;
      } else {
        const result = await eversend.getTransactionStatus(gatewayTxId);
        txData = result?.data || result;
        normalizedStatus = (txData?.status || '').toUpperCase();
        wr.eversendStatus = normalizedStatus;
      }
    } catch (e) {
      await session.abortTransaction();
      session.endSession();
      return res.status(502).json({ success: false, message: `${payoutGateway === 'mesomb' ? 'MeSomb' : 'Eversend'} status check failed: ${e.message}` });
    }

    if (normalizedStatus === 'SUCCESSFUL') {
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
        message: `Withdrawal confirmed successful by ${payoutGateway === 'mesomb' ? 'MeSomb' : 'Eversend'}.`,
        data: { withdrawal: wr, payoutGateway, gatewayStatus: normalizedStatus }
      });

    } else if (normalizedStatus === 'FAILED') {
      if (wr.balanceDeducted) {
        const user = await User.findById(wr.requestedBy).session(session);
        user.wallet_balance += wr.amount;
        await user.save({ session });
        wr.balanceDeducted = false;
      }
      wr.status = 'failed';
      wr.failureReason = txData?.reason || txData?.message || `${payoutGateway === 'mesomb' ? 'MeSomb' : 'Eversend'} reported this payout as failed.`;
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
            title: 'Withdrawal Failed',
            message: `Your withdrawal payout failed on ${payoutGateway === 'mesomb' ? 'MeSomb' : 'Eversend'}. Your balance has been restored. Reference: ${wr._id}.`,
            type: 'wallet_update',
            metadata: { withdrawal_id: wr._id, link: '/wallet' },
            sendEmail: true,
          });
        } catch (e) { console.error(e.message); }
      });

      return res.status(200).json({
        success: true,
        message: 'Withdrawal marked as failed. Balance restored.',
        data: { withdrawal: wr, payoutGateway, gatewayStatus: normalizedStatus }
      });

    } else {
      await wr.save({ session });
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: `Withdrawal is still ${normalizedStatus || 'PENDING'} on ${payoutGateway === 'mesomb' ? 'MeSomb' : 'Eversend'}. Try again later.`,
        data: { withdrawal: wr, payoutGateway, gatewayStatus: normalizedStatus }
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
