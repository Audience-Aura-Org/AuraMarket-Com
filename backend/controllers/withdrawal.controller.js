/**
 * controllers/withdrawal.controller.js
 * Auradime — Withdrawal Request System (Eversend Payout)
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
const Order = require('../models/Order.model');
const KYC = require('../models/KYC.model');
require('../models/Store.model');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const Transaction = require('../models/Transaction.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const eversend = require('../services/eversend.service');
const pawapay  = require('../services/payment/gateways/pawapay.gateway');
const webhookHealth = require('../services/webhookHealthMonitor.service');
const { sendNotification } = require('../utils/notifier');
const { debitBalance, creditBalance } = require('../services/wallet.service');
const crypto = require('crypto');

// ── Restaurant withdrawal gate thresholds ────────────────────────────────────
// Configurable via PlatformSettings; these are the hardcoded fallbacks.
const RESTAURANT_MIN_COMPLETED_ORDERS = 5;  // Must complete ≥5 orders before first withdrawal
const RESTAURANT_MIN_ACCOUNT_AGE_DAYS = 7;  // Account must be ≥7 days old

const generateTxRef = () => `AURA-WD-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

// Country ISO-2 → dial code map for E.164 normalisation (Eversend requirement)
const DIAL_CODES = {
  CM: '237', UG: '256', KE: '254', GH: '233', NG: '234',
  TZ: '255', RW: '250', ZM: '260', SN: '221', CI: '225',
  BJ: '229', BF: '226', ML: '223', TG: '228', NE: '227',
};

/**
 * Normalise a phone number to E.164 format (+<dialcode><local>).
 * Handles: local (651000001), with prefix (237651000001), intl (+237651000001), 00-prefix.
 */
const toE164 = (phone, countryIso = 'CM') => {
  if (!phone) return phone;
  let v = String(phone).replace(/[^\d+]/g, '');
  if (v.startsWith('00')) v = '+' + v.slice(2);
  if (v.startsWith('+')) return v; // already E.164
  const dialCode = DIAL_CODES[String(countryIso).toUpperCase()] || '237';
  // Strip leading dialCode if present without +
  if (v.startsWith(dialCode)) v = v.slice(dialCode.length);
  // Strip leading 0
  if (v.startsWith('0')) v = v.slice(1);
  return `+${dialCode}${v}`;
};

const VALID_WITHDRAWAL_METHODS = ['momo'];
const VALID_PAYOUT_GATEWAYS = ['payunit', 'eversend', 'pawapay'];
const PAYUNIT_CASHOUT_MIN_XAF  = 5000;
const EVERSEND_MIN_XAF         = 1000;
const PAWAPAY_PAYOUT_MIN_XAF   = 100;

const getWithdrawalDestination = (wr) => {
  const d = wr.recipient_details || {};
  return d.phone_number || d.account_number || d.eversend_tag || d.beneficiary_id || 'recipient';
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
    .map((wr) => wr.requested_by?._id || wr.requested_by)
    .filter(Boolean)
    .map((id) => id.toString());

  const vendors = await Vendor.find({ user_id: { $in: userIds } })
    .populate('store')
    .lean({ virtuals: true });

  const vendorByUserId = new Map(vendors.map((vendor) => [vendor.user_id?.toString(), vendor]));

  return withdrawals.map((wrDoc) => {
    const wr = wrDoc.toObject ? wrDoc.toObject({ virtuals: true }) : wrDoc;
    const person = wr.requested_by || {};
    const vendor = vendorByUserId.get((person._id || wr.requested_by || '').toString()) || null;
    const store = vendor?.store || null;
    const branding = person.branding || {};

    const recipientName = wr.recipient_details?.first_name && wr.recipient_details?.last_name
      ? `${wr.recipient_details.first_name} ${wr.recipient_details.last_name}`
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
        phone: person.phone || vendor?.phone || wr.recipient_details?.phone_number || null,
        role: person.role || wr.role,
        vendorId: vendor?._id || null,
        userId: person._id || wr.requested_by || null,
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
    const { amount, currency = 'XAF', withdrawal_method, recipient_details, note } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!VALID_WITHDRAWAL_METHODS.includes(withdrawal_method)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid withdrawal method. Only Mobile Wallet (MoMo) is supported.' });
    }

    const platformSettings = await PlatformSettings.getSettings(session);
    const minWithdrawal = platformSettings.min_withdrawal_amount || 500;
    if (!amount || amount < minWithdrawal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Minimum withdrawal amount is ${minWithdrawal.toLocaleString()} XAF.` });
    }

    const { first_name, last_name, country } = recipient_details || {};
    if (!first_name || !last_name || !country) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Recipient first name, last name, and country are required.' });
    }

    if (withdrawal_method === 'momo' && !recipient_details?.phone_number) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Phone number is required for Mobile Money withdrawal.' });
    }
    const user = await User.findById(userId).session(session);
    if (!user.is_active) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Your account is suspended. Withdrawals are disabled.' });
    }

    if (user.wallet_balance < 0) {
      // Phase 3 Step 5: negative balance means a refund clawback is pending.
      // Block all withdrawals until the balance returns to zero or above.
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Withdrawals are blocked: your account has a negative balance of ${Math.abs(user.wallet_balance).toLocaleString()} ${currency}. This is usually caused by a refund on a recent order. The block lifts automatically once your balance returns to zero.`,
        data: { available: user.wallet_balance }
      });
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

    // ── Phase 3 Step 5b: Restaurant withdrawal gate ──────────────────────────
    // Restaurants can earn from day one but cannot withdraw until:
    //   1. KYC is approved
    //   2. ≥ RESTAURANT_MIN_COMPLETED_ORDERS completed orders
    //   3. Account age ≥ RESTAURANT_MIN_ACCOUNT_AGE_DAYS
    if (userRole === 'vendor') {
      const vendorRecord = await Vendor.findOne({ user_id: userId }).select('vendor_type').lean().session(session);
      if (vendorRecord?.vendor_type === 'restaurant') {
        // 1. KYC check
        const kyc = await KYC.findOne({ user_id: userId }).select('status').lean().session(session);
        if (!kyc || kyc.status !== 'verified') {
          await session.abortTransaction();
          session.endSession();
          return res.status(403).json({
            success: false,
            message: 'Restaurant withdrawals require approved KYC. Please complete identity verification first.',
          });
        }

        // 2. Completed orders check
        const completedCount = await Order.countDocuments({
          vendor_id: vendorRecord._id,
          order_status: { $in: ['completed', 'delivered'] },
        }).session(session);
        const minOrders = platformSettings.restaurant_min_withdrawal_orders ?? RESTAURANT_MIN_COMPLETED_ORDERS;
        if (completedCount < minOrders) {
          await session.abortTransaction();
          session.endSession();
          return res.status(403).json({
            success: false,
            message: `Restaurant withdrawals unlock after ${minOrders} completed orders. You have ${completedCount} so far.`,
            data: { completed: completedCount, required: minOrders },
          });
        }

        // 3. Account age check
        const minAgeDays = platformSettings.restaurant_min_withdrawal_age_days ?? RESTAURANT_MIN_ACCOUNT_AGE_DAYS;
        const accountAgeMs = Date.now() - new Date(user.createdAt).getTime();
        const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
        if (accountAgeDays < minAgeDays) {
          await session.abortTransaction();
          session.endSession();
          return res.status(403).json({
            success: false,
            message: `Restaurant withdrawals unlock after your account is ${minAgeDays} days old. ${Math.ceil(minAgeDays - accountAgeDays)} day(s) remaining.`,
          });
        }
      }
    }

    const role = ['vendor', 'logistics'].includes(userRole) ? userRole : 'user';

    // ── Atomic balance deduction (prevents double-spend on concurrent requests)
    const debitResult = await debitBalance(userId, amount, session);
    if (!debitResult) throw new Error('Insufficient wallet balance.');

    // ── Create request
    const [withdrawalRequest] = await WithdrawalRequest.create([{
      requested_by: userId,
      role,
      amount,
      currency,
      withdrawal_method,
      payout_gateway: null,
      recipient_details: {
        phone_number:   recipient_details.phone_number   || null,
        eversend_tag:   recipient_details.eversend_tag   || null,
        beneficiary_id: recipient_details.beneficiary_id || null,
        first_name,
        last_name,
        country,
      },
      note: note || null,
      status: 'pending',
      balance_deducted: true,
    }], { session, ordered: true });

    // ── Create Pending Transaction Immediately
    await Transaction.create([{
      user_id: userId,
      type: 'withdrawal',
      amount: amount,
      reference: generateTxRef(),
      status: 'pending',
      description: `Withdrawal via ${withdrawal_method.toUpperCase()} to ${recipient_details.phone_number || recipient_details.account_number || recipient_details.eversend_tag || recipient_details.beneficiary_id}`,
      gateway: 'manual',
      currency: currency,
      metadata: { withdrawal_request_id: withdrawalRequest._id },
    }], { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    // The balance is reserved as soon as a payout request is accepted. Push the
    // committed post-debit balance to every signed-in device immediately.
    const io = req.app.get('io');
    if (io && Number.isFinite(Number(debitResult.wallet_balance))) {
      const room = userId.toString();
      const payload = {
        balance: Number(debitResult.wallet_balance),
        amount,
        type: 'withdrawal',
        reference: withdrawalRequest._id.toString(),
      };
      io.to(room).emit('wallet:debited', payload);
      io.to(`user:${room}`).emit('wallet:debited', payload);
    }

    // ── Notify admins
    setImmediate(async () => {
      try {
        const admins = await User.find({ role: 'admin', is_active: true }).select('_id');
        await Promise.allSettled(admins.map(admin =>
          sendNotification(req.app, admin._id, {
            title: '💸 New Withdrawal Request',
            message: `${user.name || 'A user'} (${role}) has requested a withdrawal of ${amount.toLocaleString()} ${currency} via ${withdrawal_method.toUpperCase()}.`,
            type: 'system_alert',
            metadata: {
              target_id: withdrawalRequest._id,
              withdrawal_id: withdrawalRequest._id,
              link: '/admin/withdrawals',
            },
            sendEmail: true,
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
    const query = { requested_by: req.user._id };
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
      .populate('requested_by', 'name email phone avatar role branding store_name storeName')
      .populate('reviewed_by', 'name email')
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
    const requestedGateway = req.body?.payout_gateway || req.body?.gateway || null;
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

    const user = await User.findById(wr.requested_by).session(session);
    if (!user) {
      wr.status = 'failed';
      wr.failure_reason = 'Withdrawal owner no longer exists. No payout was sent.';
      wr.reviewed_by = req.user._id;
      wr.reviewed_at = new Date();
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

    const payoutGateway = requestedGateway || wr.payout_gateway || 'payunit';
    if (!VALID_PAYOUT_GATEWAYS.includes(payoutGateway)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Choose PayUnit or Eversend as the payout gateway.' });
    }

    if (payoutGateway === 'payunit') {
      if (String(wr.currency || 'XAF').toUpperCase() === 'XAF' && Number(wr.amount || 0) < PAYUNIT_CASHOUT_MIN_XAF) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `PayUnit cashout requires at least ${PAYUNIT_CASHOUT_MIN_XAF.toLocaleString()} XAF. Approve this request with Eversend or process it manually outside PayUnit.`,
        });
      }

      const manualRef = `PAYUNIT-CASHOUT-${wr._id}`;
      wr.status = 'approved';
      wr.payout_gateway = 'payunit';
      wr.eversend_transaction_id = manualRef;
      wr.eversend_status = 'MANUAL_CASHOUT_REQUIRED';
      wr.reviewed_by = req.user._id;
      wr.reviewed_at = new Date();
      wr.failure_reason = null;
      await wr.save({ session });

      await Transaction.updateOne(
        { "metadata.withdrawal_request_id": wr._id },
        {
          status: 'pending',
          gateway: 'payunit',
          gateway_transaction_id: manualRef,
          gateway_response: {
            mode: 'manual_cashout_required',
            minimum_xaf: PAYUNIT_CASHOUT_MIN_XAF,
            destination: getWithdrawalDestination(wr),
            instructions: 'Create and confirm the cashout from the PayUnit dashboard, then mark this withdrawal completed after PayUnit confirms settlement.',
          },
          description: `Withdrawal approved for PayUnit cashout to ${getWithdrawalDestination(wr)}`,
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      setImmediate(async () => {
        try {
          await sendNotification(req.app, wr.requested_by, {
            title: 'Withdrawal Approved',
            message: `Your withdrawal of ${wr.amount.toLocaleString()} ${wr.currency} has been approved and is awaiting PayUnit cashout confirmation.`,
            type: 'wallet_update',
            metadata: { withdrawal_id: wr._id, link: '/wallet' },
            sendEmail: true,
          });
        } catch (e) { console.error(e.message); }
      });

      return res.status(200).json({
        success: true,
        message: 'Withdrawal approved for PayUnit. Complete the cashout in the PayUnit dashboard.',
        data: { withdrawal: wr, payoutGateway, payoutTransactionId: manualRef, manual: true },
      });
    }

    // ── PawaPay Payout ────────────────────────────────────────────────────────
    if (payoutGateway === 'pawapay') {
      const currency = String(wr.currency || 'XAF').toUpperCase();
      const amount   = Number(wr.amount || 0);

      if (currency === 'XAF' && amount < PAWAPAY_PAYOUT_MIN_XAF) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `PawaPay payouts require at least ${PAWAPAY_PAYOUT_MIN_XAF.toLocaleString()} XAF.`,
        });
      }

      const phone = wr.recipient_details?.phone_number;
      if (!phone) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Phone number is required for PawaPay payout.' });
      }

      const correspondent = pawapay.detectProvider(phone);
      if (!pawapay.isSupportedCameroonProvider(correspondent)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'PawaPay payouts are currently available for MTN Mobile Money only. Use the PayUnit cashout flow for Orange Money.',
        });
      }
      const payoutId = crypto.randomUUID();

      let payoutResult;
      try {
        payoutResult = await pawapay.createPayout({
          payoutId,
          amount:  wr.amount,
          currency: wr.currency,
          correspondent,
          phone,
          description: `Auradime withdrawal`,
          clientRef: wr._id.toString(),
        });
      } catch (payoutErr) {
        // PawaPay API call failed — refund user
        wr.status = 'failed';
        wr.failure_reason = payoutErr.response?.data?.message || payoutErr.message || 'PawaPay payout request failed.';
        wr.reviewed_by = req.user._id;
        wr.reviewed_at = new Date();
        wr.balance_deducted = false;
        await wr.save({ session });
        await creditBalance(wr.requested_by, wr.amount, session);
        await Transaction.updateOne({ 'metadata.withdrawal_request_id': wr._id }, { status: 'failed' }, { session });
        await session.commitTransaction();
        session.endSession();

        setImmediate(async () => {
          try {
            await sendNotification(req.app, wr.requested_by, {
              title: 'Payout Failed',
              message: `Your withdrawal was approved but the payout failed. Reason: ${wr.failure_reason}. Your balance has been restored.`,
              type: 'wallet_update',
              metadata: { withdrawal_id: wr._id, link: '/wallet' },
              sendEmail: true,
            });
          } catch (e) { console.error(e.message); }
        });

        return res.status(502).json({
          success: false,
          message: `PawaPay payout failed: ${wr.failure_reason}. Withdrawal marked as failed. User balance restored.`,
        });
      }

      const ppStatus = (payoutResult?.status || '').toUpperCase();
      if (ppStatus === 'REJECTED') {
        // PawaPay rejected immediately (e.g. invalid phone, unsupported operator)
        const reason = payoutResult?.failureReason?.failureMessage || 'PawaPay rejected the payout.';
        wr.status = 'failed';
        wr.failure_reason = reason;
        wr.reviewed_by = req.user._id;
        wr.reviewed_at = new Date();
        wr.balance_deducted = false;
        await wr.save({ session });
        await creditBalance(wr.requested_by, wr.amount, session);
        await Transaction.updateOne({ 'metadata.withdrawal_request_id': wr._id }, { status: 'failed' }, { session });
        await session.commitTransaction();
        session.endSession();

        setImmediate(async () => {
          try {
            await sendNotification(req.app, wr.requested_by, {
              title: 'Payout Rejected',
              message: `Your withdrawal payout was rejected by PawaPay. Reason: ${reason}. Your balance has been restored.`,
              type: 'wallet_update',
              metadata: { withdrawal_id: wr._id, link: '/wallet' },
              sendEmail: true,
            });
          } catch (e) { console.error(e.message); }
        });

        return res.status(502).json({ success: false, message: `PawaPay rejected the payout: ${reason}. Balance restored.` });
      }

      // ACCEPTED (or DUPLICATE_IGNORED) — store payoutId and wait for webhook/recheck
      wr.status = 'approved';
      wr.payout_gateway = 'pawapay';
      wr.eversend_transaction_id = payoutId;   // reusing field as gateway_tx_id
      wr.eversend_status = ppStatus;
      wr.reviewed_by = req.user._id;
      wr.reviewed_at = new Date();
      wr.failure_reason = null;
      await wr.save({ session });

      await Transaction.updateOne(
        { 'metadata.withdrawal_request_id': wr._id },
        {
          status: 'pending',
          gateway: 'pawapay',
          gateway_transaction_id: payoutId,
          gateway_response: payoutResult,
          description: `Withdrawal via PawaPay to ${pawapay.normalizePhone(phone)}`,
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      setImmediate(async () => {
        try {
          await sendNotification(req.app, wr.requested_by, {
            title: 'Withdrawal Approved — Processing',
            message: `Your withdrawal of ${wr.amount.toLocaleString()} ${wr.currency} has been approved and is being sent via PawaPay Mobile Money. Reference: ${payoutId}.`,
            type: 'wallet_update',
            metadata: { withdrawal_id: wr._id, link: '/wallet' },
            sendEmail: true,
          });
        } catch (e) { console.error(e.message); }
      });

      return res.status(200).json({
        success: true,
        message: 'Withdrawal approved. PawaPay payout initiated.',
        data: { withdrawal: wr, payoutGateway: 'pawapay', payoutTransactionId: payoutId },
      });
    }

    // Eversend minimum check
    if (String(wr.currency || 'XAF').toUpperCase() === 'XAF' && Number(wr.amount || 0) < EVERSEND_MIN_XAF) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Eversend requires at least ${EVERSEND_MIN_XAF.toLocaleString()} XAF. This withdrawal is below the minimum.`,
      });
    }

    let payoutResult = null;
    let payoutTxId = null;
    let payoutStatus = 'pending';
    let quotationToken = null;
    const { recipient_details } = wr;
    const txRef = wr._id.toString();

    try {
      const eversendMethod = wr.withdrawal_method;
      const quotation = await eversend.getPayoutQuotation(
        wr.amount,
        wr.currency,
        wr.currency,
        recipient_details.country,
        eversendMethod
      );

      const balanceAfter = quotation?.data?.quotation?.sourceCurrencyBalanceAfter;
      if (balanceAfter !== undefined && balanceAfter < 0) {
        throw new Error(`Insufficient funds in Eversend ${wr.currency} wallet.`);
      }

      quotationToken = quotation?.data?.token || quotation?.token;
      if (!quotationToken) throw new Error('No quotation token returned from Eversend.');

      if (eversendMethod === 'momo') {
        payoutResult = await eversend.executeMomoPayout(quotationToken, toE164(recipient_details.phone_number, recipient_details.country), recipient_details.first_name, recipient_details.last_name, recipient_details.country, txRef);
      } else if (eversendMethod === 'eversend') {
        if (recipient_details.beneficiary_id) {
          payoutResult = await eversend.executeBeneficiaryPayout(quotationToken, recipient_details.beneficiary_id, txRef);
        } else {
          payoutResult = await eversend.executeEversendPayout(quotationToken, recipient_details.eversend_tag, txRef);
        }
      } else {
        throw new Error('Eversend cannot process this withdrawal method.');
      }
      payoutTxId = payoutResult?.data?.transactionId || payoutResult?.transactionId;
      payoutStatus = payoutResult?.data?.status || payoutResult?.status || 'pending';
    } catch (payoutErr) {
      // Payout failed — refund user
      wr.status = 'failed';
      wr.failure_reason = getGatewayFailureMessage(payoutErr, payoutErr.message);
      wr.reviewed_by = req.user._id;
      wr.reviewed_at = new Date();
      wr.balance_deducted = false;
      await wr.save({ session });

      await creditBalance(wr.requested_by, wr.amount, session);

      await Transaction.updateOne(
        { "metadata.withdrawal_request_id": wr._id },
        { status: 'failed' },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      setImmediate(async () => {
        try {
          await sendNotification(req.app, wr.requested_by, {
            title: 'Payout Failed',
            message: `Your withdrawal was approved but the payout failed. Reason: ${wr.failure_reason}. Your balance has been restored.`,
            type: 'wallet_update',
            metadata: { withdrawal_id: wr._id, link: '/wallet' },
            sendEmail: true,
          });
        } catch (e) { console.error(e.message); }
      });

      return res.status(502).json({
        success: false,
        message: `Eversend payout failed: ${wr.failure_reason}. Withdrawal marked as failed. User balance restored.`,
      });
    }

    wr.status = 'approved';
    wr.payout_gateway = payoutGateway;
    wr.eversend_transaction_id = payoutTxId;
    wr.eversend_quotation_token = quotationToken;
    wr.eversend_status = payoutStatus;
    wr.reviewed_by = req.user._id;
    wr.reviewed_at = new Date();
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
        await sendNotification(req.app, wr.requested_by, {
          title: wr.status === 'completed' ? 'Withdrawal Successful' : 'Withdrawal Approved — Processing',
          message: `Your withdrawal of ${wr.amount.toLocaleString()} ${wr.currency} has been approved via Eversend. Reference: ${payoutTxId || wr._id}.`,
          type: 'wallet_update',
          metadata: { withdrawal_id: wr._id, link: '/wallet' },
          sendEmail: true,
        });
      } catch (e) { console.error(e.message); }
    });

    return res.status(200).json({
      success: true,
      message: 'Withdrawal approved. Payout sent to Eversend.',
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
    const { rejection_reason } = req.body;

    if (!rejection_reason || rejection_reason.trim().length < 5) {
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
    wr.rejection_reason = rejection_reason.trim();
    wr.reviewed_by = req.user._id;
    wr.reviewed_at = new Date();

    // Atomic refund
    if (wr.balance_deducted) {
      await creditBalance(wr.requested_by, wr.amount, session);
      wr.balance_deducted = false;
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
        await sendNotification(req.app, wr.requested_by, {
          title: 'Withdrawal Request Rejected',
          message: `Your withdrawal request of ${wr.amount.toLocaleString()} ${wr.currency} has been rejected. Reason: ${rejection_reason}. Funds restored.`,
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

// ── 5b. USER: RECHECK OWN WITHDRAWAL ─────────────────────────────────────────
// Lightweight version of adminRecheckWithdrawal — lets a user sync the payout
// status of their own withdrawal so the wallet page can reflect the real state.
const userRecheckWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wr = await WithdrawalRequest.findOne({
      _id: req.params.id,
      requested_by: req.user._id,
    }).session(session);

    if (!wr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Withdrawal not found.' });
    }

    // Only recheck withdrawals that have been sent to a gateway
    const payoutGateway = wr.payout_gateway || (wr.eversend_transaction_id ? 'eversend' : null);
    const gatewayTxId = wr.eversend_transaction_id;
    if (!payoutGateway || !gatewayTxId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        status: 'PENDING',
        message: 'This withdrawal is still awaiting admin approval.',
      });
    }

    // Already terminal — no need to re-query the gateway
    if (['completed', 'failed', 'rejected'].includes(wr.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        status: wr.status === 'completed' ? 'SUCCESSFUL' : 'FAILED',
        message: `Withdrawal already ${wr.status}.`,
      });
    }

    let normalizedStatus;

    if (payoutGateway === 'pawapay') {
      try {
        const result = await pawapay.getPayoutStatus(gatewayTxId);
        normalizedStatus = pawapay.normalizePawaPayoutStatus(result?.status);
        wr.eversend_status = result?.status || normalizedStatus;
      } catch (e) {
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({ success: true, status: 'PENDING', message: 'Could not reach gateway. Try again later.' });
      }
    } else if (payoutGateway === 'eversend') {
      try {
        const result = await eversend.getTransactionStatus(gatewayTxId);
        const txData = result?.data || result;
        normalizedStatus = (txData?.status || '').toUpperCase();
        wr.eversend_status = normalizedStatus;
      } catch (e) {
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({ success: true, status: 'PENDING', message: 'Could not reach gateway. Try again later.' });
      }
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({ success: true, status: 'PENDING', message: 'Manual payout — status will be updated by admin.' });
    }

    if (normalizedStatus === 'SUCCESSFUL') {
      wr.status = 'completed';
      await wr.save({ session });
      await Transaction.updateOne(
        { "metadata.withdrawal_request_id": wr._id },
        { status: 'completed' },
        { session },
      );
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({ success: true, status: 'SUCCESSFUL', message: 'Withdrawal confirmed successful.' });
    }

    if (normalizedStatus === 'FAILED') {
      if (wr.balance_deducted) {
        await creditBalance(wr.requested_by, wr.amount, session);
        wr.balance_deducted = false;
      }
      wr.status = 'failed';
      wr.failure_reason = 'Gateway reported payout as failed.';
      await wr.save({ session });
      await Transaction.updateOne(
        { "metadata.withdrawal_request_id": wr._id },
        { status: 'failed' },
        { session },
      );
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({ success: true, status: 'FAILED', message: 'Withdrawal failed. Balance restored.' });
    }

    // Still pending/processing
    await wr.save({ session });
    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({ success: true, status: 'PENDING', message: `Withdrawal is still ${normalizedStatus || 'PENDING'} on the gateway.` });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('[userRecheckWithdrawal]', err);
    return res.status(500).json({ success: false, message: 'Server error during recheck.' });
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
    const payoutGateway = wr.payout_gateway || (wr.eversend_transaction_id ? 'eversend' : null);
    if (!payoutGateway) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'No supported payout gateway is attached to this withdrawal.',
      });
    }

    const gatewayTxId = wr.eversend_transaction_id;

    if (payoutGateway === 'payunit') {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        message: 'PayUnit withdrawals are cashout-dashboard controlled. Confirm the cashout in PayUnit, then update the withdrawal from the admin payout queue.',
        data: { withdrawal: wr, payoutGateway, gatewayStatus: wr.eversend_status || 'MANUAL_CASHOUT_REQUIRED' },
      });
    }

    if (!gatewayTxId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'No gateway transaction ID on this record. Cannot recheck.' });
    }

    let txData;
    let normalizedStatus;

    if (payoutGateway === 'pawapay') {
      try {
        const result = await pawapay.getPayoutStatus(gatewayTxId);
        txData = result;
        const rawStatus = result?.status;
        normalizedStatus = pawapay.normalizePawaPayoutStatus(rawStatus);
        wr.eversend_status = rawStatus || normalizedStatus;
      } catch (e) {
        await session.abortTransaction();
        session.endSession();
        return res.status(502).json({ success: false, message: `PawaPay status check failed: ${e.message}` });
      }
    } else {
      try {
        const result = await eversend.getTransactionStatus(gatewayTxId);
        txData = result?.data || result;
        normalizedStatus = (txData?.status || '').toUpperCase();
        wr.eversend_status = normalizedStatus;
      } catch (e) {
        await session.abortTransaction();
        session.endSession();
        return res.status(502).json({ success: false, message: `Eversend status check failed: ${e.message}` });
      }
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
          await sendNotification(req.app, wr.requested_by, {
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
        data: { withdrawal: wr, payoutGateway, gatewayStatus: normalizedStatus }
      });

    } else if (normalizedStatus === 'FAILED') {
      if (wr.balance_deducted) {
        await creditBalance(wr.requested_by, wr.amount, session);
        wr.balance_deducted = false;
      }
      wr.status = 'failed';
      wr.failure_reason = txData?.failureReason?.failureMessage || txData?.reason || txData?.message || `${payoutGateway} reported this payout as failed.`;
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
          await sendNotification(req.app, wr.requested_by, {
            title: 'Withdrawal Failed',
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
        data: { withdrawal: wr, payoutGateway, gatewayStatus: normalizedStatus }
      });

    } else {
      await wr.save({ session });
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: `Withdrawal is still ${normalizedStatus || 'PENDING'} on Eversend. Try again later.`,
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

const adminCompleteManualWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wr = await WithdrawalRequest.findById(req.params.id).session(session);
    if (!wr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Withdrawal request not found.' });
    }

    if (wr.payout_gateway !== 'payunit') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Manual completion is only available for PayUnit cashout withdrawals.' });
    }

    if (wr.status !== 'approved') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Cannot complete a withdrawal with status: ${wr.status}.` });
    }

    wr.status = 'completed';
    wr.eversend_status = 'SUCCESSFUL';
    wr.reviewed_by = req.user._id;
    wr.reviewed_at = new Date();
    await wr.save({ session });

    await Transaction.updateOne(
      { "metadata.withdrawal_request_id": wr._id },
      {
        status: 'completed',
        gateway: 'payunit',
        gateway_response: {
          mode: 'manual_cashout_confirmed',
          confirmed_by: req.user._id,
          confirmed_at: new Date(),
          note: req.body?.note || null,
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    setImmediate(async () => {
      try {
        await sendNotification(req.app, wr.requested_by, {
          title: 'Withdrawal Successful',
          message: `Your withdrawal of ${wr.amount.toLocaleString()} ${wr.currency} has been completed.`,
          type: 'wallet_update',
          metadata: { withdrawal_id: wr._id, link: '/wallet' },
          sendEmail: true,
        });
      } catch (e) { console.error(e.message); }
    });

    return res.status(200).json({
      success: true,
      message: 'PayUnit withdrawal marked completed.',
      data: { withdrawal: wr, payoutGateway: 'payunit', gatewayStatus: 'SUCCESSFUL' },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('[adminCompleteManualWithdrawal]', err);
    return res.status(500).json({ success: false, message: 'Server error during manual completion.' });
  }
};

// ── 8. PAWAPAY PAYOUT WEBHOOK ─────────────────────────────────────────────────
// @route  POST /api/v1/payments/pawapay/webhook/payout  (public, raw body)
// Called by PawaPay when a payout reaches a final status (COMPLETED or FAILED).
const pawapayPayoutWebhook = async (req, res) => {
  try {
    webhookHealth.record('received', 'pawapay');
    // 1. IP allowlist (enforced when PAWAPAY_ENFORCE_IP_ALLOWLIST=true)
    const callerIp = pawapay.resolveCallerIp(req.headers, req.socket?.remoteAddress);
    const ipCheck  = pawapay.checkCallerIp(callerIp);
    if (!ipCheck.allowed) {
      webhookHealth.record('rejected', 'pawapay', 'ip-rejected');
      console.warn(`[PawaPay Payout Webhook] ${ipCheck.reason} — rejecting`);
      return res.status(403).send('Forbidden');
    }

    // 2. Content-Digest / signature verification
    const rawBody = req.rawBody
      ? req.rawBody
      : Buffer.isBuffer(req.body) ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    if (!pawapay.verifyWebhookSignature(rawBody, req.headers)) {
      webhookHealth.record('rejected', 'pawapay', 'signature-invalid');
      console.warn('[PawaPay Payout Webhook] Signature verification failed');
      return res.status(401).send('Unauthorized');
    }

    const event = (() => {
      try { return JSON.parse(rawBody.toString()); } catch { return req.body || {}; }
    })();

    const { payoutId, status: rawStatus } = event;
    if (!payoutId) return res.status(200).send('OK'); // nothing to process

    const normalizedStatus = pawapay.normalizePawaPayoutStatus(rawStatus);
    if (normalizedStatus === 'PENDING') {
      // Intermediate status — PawaPay may send SUBMITTED callbacks; nothing to do yet
      return res.status(200).send('OK');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      if (normalizedStatus === 'SUCCESSFUL') {
        // Atomic claim: only one concurrent webhook can flip to 'completed'
        const claimed = await WithdrawalRequest.findOneAndUpdate(
          {
            payout_gateway: 'pawapay',
            eversend_transaction_id: payoutId,
            status: { $nin: ['completed', 'failed', 'rejected'] },
          },
          { $set: { status: 'completed', eversend_status: rawStatus } },
          { session, new: true }
        );

        if (!claimed) {
          // Already settled or not found — idempotent
          await session.abortTransaction();
          session.endSession();
          return res.status(200).send('OK');
        }

        await Transaction.updateOne(
          { 'metadata.withdrawal_request_id': claimed._id },
          { status: 'completed', gateway_response: event },
          { session }
        );

        await session.commitTransaction();
        session.endSession();
        webhookHealth.record('webhookSettled', 'pawapay');

        setImmediate(async () => {
          try {
            await sendNotification(req.app, claimed.requested_by, {
              title: 'Withdrawal Successful',
              message: `Your withdrawal of ${claimed.amount.toLocaleString()} ${claimed.currency} has been confirmed by PawaPay.`,
              type: 'wallet_update',
              metadata: { withdrawal_id: claimed._id, link: '/wallet' },
              sendEmail: true,
            });
          } catch (e) { console.error('[PawaPay Payout Webhook notify]', e.message); }
        });

      } else {
        // FAILED — atomically claim and flip balance_deducted to prevent double-credit
        const claimed = await WithdrawalRequest.findOneAndUpdate(
          {
            payout_gateway: 'pawapay',
            eversend_transaction_id: payoutId,
            status: { $nin: ['completed', 'failed', 'rejected'] },
          },
          {
            $set: {
              status: 'failed',
              eversend_status: rawStatus,
              failure_reason: event?.failureReason?.failureMessage || 'PawaPay payout failed.',
              balance_deducted: false,
            },
          },
          { session, new: false }  // new: false → returns pre-update doc so we can read balance_deducted
        );

        if (!claimed) {
          await session.abortTransaction();
          session.endSession();
          return res.status(200).send('OK');
        }

        // Refund only if balance was deducted (pre-update value from claimed)
        if (claimed.balance_deducted) {
          await creditBalance(claimed.requested_by, claimed.amount, session);
        }

        await Transaction.updateOne(
          { 'metadata.withdrawal_request_id': claimed._id },
          { status: 'failed', gateway_response: event },
          { session }
        );

        await session.commitTransaction();
        session.endSession();

        setImmediate(async () => {
          try {
            const failReason = event?.failureReason?.failureMessage || 'PawaPay payout failed.';
            await sendNotification(req.app, claimed.requested_by, {
              title: 'Withdrawal Failed',
              message: `Your withdrawal of ${claimed.amount.toLocaleString()} ${claimed.currency} failed via PawaPay. Reason: ${failReason}. Your balance has been restored.`,
              type: 'wallet_update',
              metadata: { withdrawal_id: claimed._id, link: '/wallet' },
              sendEmail: true,
            });
          } catch (e) { console.error('[PawaPay Payout Webhook notify]', e.message); }
        });
      }
    } catch (innerErr) {
      await session.abortTransaction();
      session.endSession();
      console.error('[PawaPay Payout Webhook] Session error:', innerErr);
      return res.status(500).send('Internal Server Error');
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[PawaPay Payout Webhook]', err);
    return res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  submitWithdrawal,
  getMyWithdrawals,
  userRecheckWithdrawal,
  adminGetAllWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminRecheckWithdrawal,
  adminCompleteManualWithdrawal,
  pawapayPayoutWebhook,
};
