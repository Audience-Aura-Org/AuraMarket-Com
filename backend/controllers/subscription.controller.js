const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const UserSubscription = require('../models/UserSubscription.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const eversend = require('../services/eversend.service');
const payunit = require('../services/payunit.service');
const pawapay = require('../services/payment/gateways/pawapay.gateway');
const {
  ensureDefaultSubscriptionPlan,
  getRoleRequirements,
  getPlansForRole,
  getSubscriptionStatus,
  activateSubscription,
} = require('../services/subscription.service');
const { applyMobileMoneyCollectionFee } = require('../utils/mobileMoneyFees');
const { subscriptionReturnUrl } = require('../utils/subscriptionDates');
const { paymentFailure } = require('../utils/paymentFailure');
const { debitBalance } = require('../services/wallet.service');

const sanitizePhone = (phone, country = 'CM') => {
  if (!phone) return phone;
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`;
  if (!cleaned.startsWith('+')) {
    const prefixes = { CM: '237', KE: '254', UG: '256', RW: '250', GH: '233', NG: '234', CI: '225' };
    const prefix = prefixes[country] || '237';
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    cleaned = cleaned.startsWith(prefix) ? `+${cleaned}` : `+${prefix}${cleaned}`;
  }
  return cleaned;
};

const generateSubscriptionRef = (userId) =>
  `AURA-SUB-${Date.now()}-${String(userId).slice(-6).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

const serializeStatus = async (user, role = null) => {
  const activeRole = role || user.role;
  const [status, plans, requirements] = await Promise.all([
    getSubscriptionStatus(user, activeRole),
    getPlansForRole(activeRole),
    getRoleRequirements(),
  ]);

  return {
    ...status,
    plans,
    requirements: requirements.required,
    grace_days: requirements.grace_days,
  };
};

const getMySubscription = async (req, res, next) => {
  try {
    const role = req.query.role || req.user.role;
    if (!['customer', 'vendor', 'logistics', 'admin', 'manager'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid account role.' });
    if (req.user.role !== 'admin' && role !== req.user.role && !(req.user.role === 'manager' && role === req.user.previous_role)) {
      return res.status(403).json({ success: false, message: 'Subscription status is available only for your account role.' });
    }
    const data = await serializeStatus(req.user, role);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const initializeSubscription = async (req, res, next) => {
  const session = await mongoose.startSession();
  let externalPayment = null;
  try {
    const {
      plan_id,
      role = req.user.role,
      payment_method = 'wallet',
      currency = 'XAF',
      phone,
      country = 'CM',
      redirect_url,
    } = req.body || {};

    if (['admin', 'manager'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Admin and manager accounts do not require subscriptions.' });
    }

    if (role !== req.user.role) {
      return res.status(403).json({ success: false, message: 'Subscriptions can only be purchased for your own account role.' });
    }

    if (plan_id && !mongoose.isValidObjectId(plan_id)) return res.status(400).json({ success: false, message: 'Invalid plan ID.' });
    await ensureDefaultSubscriptionPlan();
    const plan = plan_id
      ? await SubscriptionPlan.findById(plan_id)
      : (await getPlansForRole(role))[0];

    if (!plan || !plan.is_active || !plan.roles.includes(role)) {
      return res.status(404).json({ success: false, message: 'No active subscription plan is available for this role.' });
    }

    if (plan.contact_required) {
      return res.status(400).json({ success: false, message: 'This package requires direct support activation. Please contact Auradime support.' });
    }
    if (!Number.isFinite(plan.price) || plan.price < 0 || (plan.currency === 'XAF' && !Number.isInteger(plan.price))) {
      return res.status(400).json({ success: false, message: 'This subscription plan has an invalid price. Please contact support.' });
    }

    if (String(currency).toUpperCase() !== String(plan.currency).toUpperCase()) {
      return res.status(400).json({ success: false, message: 'Payment currency must match the subscription plan currency.' });
    }
    if (payment_method === 'wallet' && String(plan.currency).toUpperCase() !== 'XAF') {
      return res.status(400).json({ success: false, message: 'Aura Wallet can only pay for plans priced in XAF.' });
    }

    const current = await getSubscriptionStatus(req.user, role);
    const currentPlanId = current.subscription?.plan_id?._id || current.subscription?.plan_id;
    if (
      current.subscribed &&
      current.subscription?.status === 'active' &&
      currentPlanId &&
      String(currentPlanId) === String(plan._id)
    ) {
      return res.status(200).json({
        success: true,
        message: 'This package is already active.',
        data: await serializeStatus(req.user, role),
      });
    }

    if (payment_method === 'wallet' || Number(plan.price) === 0) {
      let result;
      await session.withTransaction(async () => {
        const locked = await User.findOneAndUpdate({ _id: req.user._id }, { $inc: { subscription_revision: 1 } }, { session, returnDocument: 'after' });
        const existing = await require('../services/subscription.service').getActiveSubscription(req.user._id, role, session);
        if (existing && String(existing.plan_id?._id || existing.plan_id) === String(plan._id)) {
          result = { subscription: existing, transaction: null, user: locked, alreadyActive: true }; return;
        }
        const user = Number(plan.price) > 0 ? await debitBalance(req.user._id, Number(plan.price), session) : locked;
        if (!user) throw Object.assign(new Error('Insufficient wallet balance for this subscription.'), { statusCode: 400 });
        const transactions = Number(plan.price) > 0 ? await Transaction.create([{
          user_id: user._id, type: 'subscription', amount: plan.price,
          reference: generateSubscriptionRef(user._id), status: 'completed',
          description: plan.name + ' subscription paid from Aura Wallet', gateway: 'wallet', currency: plan.currency,
          metadata: { purpose: 'subscription', plan_id: plan._id, role, billing_cycle: plan.billing_cycle,
            plan_snapshot: { price: plan.price, currency: plan.currency, billing_cycle: plan.billing_cycle, duration_days: plan.duration_days } },
        }], { session }) : [];
        const subscription = await activateSubscription({ userId: user._id, planId: plan._id, role,
          transaction: transactions[0] || null, source: 'wallet', session, note: 'Activated after wallet payment.' });
        result = { subscription, transaction: transactions[0] || null, user };
      });
      const io = req.app.get('io');
      if (io && result.transaction) io.to(String(result.user._id)).emit('wallet:debited', {
        balance: result.user.wallet_balance, amount: plan.price, reference: result.transaction.reference,
      });
      return res.status(200).json({ success: true, message: result.alreadyActive ? 'This package is already active.' : 'Subscription activated.',
        data: { subscription: result.subscription, transaction: result.transaction, status: await serializeStatus(result.user, role) } });
    }

    const externalGateways = ['eversend', 'payunit', 'pawapay'];
    if (!externalGateways.includes(payment_method)) {
      return res.status(400).json({ success: false, message: 'Choose wallet, PawaPay, PayUnit, or Eversend to pay for this subscription.' });
    }
    if (process.env.NODE_ENV === 'production' &&
        ((payment_method === 'eversend' && process.env.EVERSEND_SANDBOX_MODE === 'true') ||
         (payment_method === 'pawapay' && process.env.PAWAPAY_SANDBOX_MODE === 'true') ||
         (payment_method === 'payunit' && process.env.PAYUNIT_MODE === 'sandbox'))) {
      return res.status(503).json({ success: false, message: 'This payment provider is not configured for live subscription payments.' });
    }

    const normalizedPhone = payment_method === 'payunit'
      ? payunit.normalizePhone(phone || req.user.phone, country)
      : payment_method === 'pawapay'
        ? pawapay.normalizePhone(phone || req.user.phone)
        : sanitizePhone(phone || req.user.phone, country);
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required for mobile money subscription payment.' });
    }

    // Subscription money stays with the platform, so no payout reserve is added.
    const feeBreakdown = applyMobileMoneyCollectionFee(plan.price, payment_method, currency, {
      provider: payment_method === 'pawapay' ? pawapay.detectProvider(normalizedPhone) : null,
      payoutReserve: false,
    });
    // Orange Money CM hard-rejects transaction IDs longer than 20 characters (returns HTTP 417).
    // PayUnit ref: SU(2) + ms-timestamp(13) + userId-tail(5) = 20 chars exactly. Uppercase required.
    const pawapayDepositId = payment_method === 'pawapay' ? crypto.randomUUID() : null;
    const transactionRef = payment_method === 'payunit'
      ? payunit.cleanTransactionId(('SU' + Date.now() + String(req.user._id).slice(-5)).toUpperCase())
      : payment_method === 'pawapay'
        ? `AURA-PP-${pawapayDepositId}`
      : generateSubscriptionRef(req.user._id);

    // Always use the configured public web URL — never allow localhost/capacitor origins
    // (which arrive from APK requests) to reach PayUnit, as they are rejected by the gateway.
    const publicWebUrl = (process.env.WEB_CLIENT_URL && !/localhost|127\.0\.0\.1/i.test(process.env.WEB_CLIENT_URL))
      ? process.env.WEB_CLIENT_URL.replace(/\/$/, '')
      : 'https://auradime.com';
    const callbackFor = reference => subscriptionReturnUrl(publicWebUrl, redirect_url, payment_method, reference);
    const callbackUrl = callbackFor(transactionRef);
    const [firstName, ...rest] = String(req.user.name || 'Aura User').split(' ');
    const lastName = rest.join(' ') || 'User';

    let transaction, resumed = false;
    await session.withTransaction(async () => {
      resumed = false;
      await User.updateOne({ _id: req.user._id }, { $inc: { subscription_revision: 1 } }, { session });
      const pending = await Transaction.findOne({ user_id: req.user._id, gateway: { $in: externalGateways }, status: 'pending',
        'metadata.purpose': 'subscription', 'metadata.plan_id': plan._id,
        createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
      }).sort({ createdAt: -1 }).session(session);
      if (pending) { transaction = pending; resumed = true; return; }
      const [created] = await Transaction.create([{
      user_id: req.user._id,
      type: 'subscription',
      amount: plan.price,
      currency: plan.currency,
      reference: transactionRef,
      status: 'pending',
      gateway: payment_method,
      description: plan.name + ' subscription via ' + payment_method,
      metadata: {
        purpose: 'subscription',
        plan_id: plan._id,
        role,
        billing_cycle: plan.billing_cycle,
        plan_snapshot: { price: plan.price, currency: plan.currency, billing_cycle: plan.billing_cycle, duration_days: plan.duration_days },
        net_amount: feeBreakdown.netAmount,
        collection_fee: feeBreakdown.collectionFee,
        gross_amount: feeBreakdown.grossAmount,
          ...(payment_method === 'payunit' ? { phone: payunit.normalizePhoneIntl(phone || req.user.phone, country) } : {}),
          ...(payment_method === 'pawapay' ? { phone: normalizedPhone, depositId: pawapayDepositId } : {}),
      },
    }], { session });
      transaction = created;
    });
    externalPayment = transaction;
    if (resumed) return res.status(200).json({ success: true, message: 'A payment request is already pending. Please confirm it on your phone.', data: {
      checkout_url: subscriptionReturnUrl(publicWebUrl, redirect_url, transaction.gateway, transaction.reference), gateway: transaction.gateway, reference: transaction.reference,
      transaction_id: transaction.gateway_transaction_id || transaction.reference,
      amount: transaction.amount, collection_fee: transaction.metadata?.collection_fee || 0,
      gross_amount: transaction.metadata?.gross_amount || transaction.amount, pending_resume: true,
    } });

    if (payment_method === 'eversend' && process.env.EVERSEND_SANDBOX_MODE === 'true') {
      transaction.gateway_transaction_id = `SBX-SUB-${Date.now()}`;
      transaction.metadata = { ...(transaction.metadata || {}), is_sandbox: true };
      transaction.markModified('metadata');
      await transaction.save();
      return res.status(200).json({
        success: true,
        data: {
          checkout_url: callbackUrl,
          reference: transaction.reference,
          transaction_id: transaction.gateway_transaction_id,
          amount: feeBreakdown.netAmount,
          collection_fee: feeBreakdown.collectionFee,
          gross_amount: feeBreakdown.grossAmount,
        },
      });
    }

    if (payment_method === 'payunit') {
      // req.hostname uses X-Forwarded-Host (via trust proxy) — the public domain.
      // req.get('host') returns the nginx internal proxy address (localhost:3000 etc.)
      // which PayUnit rejects as an invalid notify_url.
      const notifyUrl = `${process.env.API_PUBLIC_URL || process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.hostname}`}/api/v1/payments/payunit/webhook`;
      // Always auto-detect operator from phone prefix — never trust client-submitted provider.
      // The subscribe page defaults to CM_MTNMOMO; an Orange user would silently get an MTN
      // push sent to their Orange number which PayUnit immediately rejects as FAILED.
      // Live testing confirmed Orange (CM_ORANGE) now works through makeMobilePayment —
      // PayUnit returns PENDING and falls back to "dial #150*50# to confirm".
      const resolvedProvider = payunit.detectCmProvider(normalizedPhone);
      let init;
      try {
        init = await payunit.initializePayment({
          amount: feeBreakdown.grossAmount,
          currency,
          transactionId: transactionRef,
          returnUrl: callbackUrl,
          notifyUrl,
          country,
        });
      } catch (initErr) {
        console.error('[PayUnit Sub initialize]', initErr.response?.data || initErr.message);
        const definite = initErr.response?.status >= 400 && initErr.response?.status < 500 && ![408,409,429].includes(initErr.response.status);
        await Transaction.updateOne({ _id: transaction._id, status: 'pending' }, { $set: { ...(definite ? { status: 'failed' } : {}), gateway_response: initErr.response?.data || { message: initErr.message } } });
        if (!definite) return res.status(202).json({ success: true, status: 'PENDING', message: 'Payment confirmation is pending. Do not submit another payment.', data: { reference: transaction.reference, checkout_url: callbackUrl } });
        return res.status(400).json({
          success: false,
          code: 'INIT_FAILED',
          message: 'Payment service is temporarily unavailable. Please try again in a moment.',
          detail: initErr.response?.data,
        });
      }
      let direct;
      let mobilePaymentTimedOut = false;
      try {
        direct = await payunit.makeMobilePayment({
          amount: feeBreakdown.grossAmount,
          currency,
          transactionId: transactionRef,
          returnUrl: callbackUrl,
          notifyUrl,
          phone: normalizedPhone,
          provider: resolvedProvider,
        });
      } catch (mpeError) {
        if (payunit.isTimeoutError(mpeError)) {
          mobilePaymentTimedOut = true;
          console.warn('[PayUnit Sub makepayment] Timed out — payment may still be processing:', mpeError.message);
        } else if (mpeError.response?.status === 422 || mpeError.response?.status === 417) {
          // 422 = duplicate pending collection from Orange/MTN (one active USSD at a time)
          // 417 = PayUnit wraps Orange Money's 422 as HTTP 417 in some response paths
          await Transaction.updateOne({ _id: transaction._id, status: 'pending' }, { $set: { status: 'failed', gateway_response: mpeError.response?.data || { message: mpeError.message } } });
          return res.status(400).json({
            success: false,
            code: 'PENDING_COLLECTION',
            message: 'Your mobile money payment could not be processed. If you have a pending USSD prompt on your phone, please approve it — or wait a few minutes and try again.',
            detail: mpeError.response?.data,
          });
        } else {
          throw mpeError;
        }
      }
      const responseData = direct?.data || direct || init?.data || init;
      transaction.gateway_transaction_id = responseData?.transaction_id || responseData?.provider_transaction_id || transactionRef;
      transaction.gateway_response = { initialize: init, makepayment: direct || null };
      if (mobilePaymentTimedOut) {
        transaction.metadata = { ...(transaction.metadata || {}), timed_out: true };
        transaction.markModified('metadata');
      }
      await transaction.save();

      return res.status(200).json({
        success: true,
        message: mobilePaymentTimedOut
          ? 'PayUnit request timed out — payment may still be processing. Please check your phone or poll for status.'
          : 'Subscription payment request sent.',
        data: {
          checkout_url: init?.data?.transaction_url || responseData?.transaction_url || callbackUrl,
          reference: transaction.reference,
          transaction_id: transaction.gateway_transaction_id,
          amount: feeBreakdown.netAmount,
          collection_fee: feeBreakdown.collectionFee,
          gross_amount: feeBreakdown.grossAmount,
          orange_hosted: false,
        },
      });
    }

    if (payment_method === 'pawapay') {
      const correspondent = pawapay.detectProvider(normalizedPhone);
      if (!pawapay.isSupportedCameroonProvider(correspondent)) {
        await Transaction.updateOne({ _id: transaction._id, status: 'pending' }, { $set: { status: 'failed' } });
        return res.status(400).json({ success: false, message: pawapay.UNSUPPORTED_PROVIDER_MESSAGE });
      }
      await Transaction.updateOne({ _id: transaction._id }, { $set: { gateway_transaction_id: pawapayDepositId } });
      try {
        const result = await pawapay.createDeposit({
          depositId: pawapayDepositId,
          amount: feeBreakdown.grossAmount,
          currency,
          correspondent,
          phone: normalizedPhone,
          description: 'Auradime subscription',
        });
        if (['REJECTED', 'FAILED'].includes(String(result?.status || '').toUpperCase())) {
          await Transaction.updateOne({ _id: transaction._id, status: 'pending' }, { $set: { status: 'failed', gateway_response: result } });
          const failure = paymentFailure(result);
          return res.status(422).json({ success: false, status: 'FAILED', code: failure.code, message: failure.code === 'INSUFFICIENT_FUNDS' ? 'Your mobile-money account has insufficient funds. Top up your balance and try the subscription payment again. Your subscription has not been activated.' : failure.message, data: { reference: transaction.reference } });
        }
        await Transaction.updateOne({ _id: transaction._id }, { $set: { gateway_response: result } });
        return res.status(200).json({
          success: true,
          message: 'PawaPay subscription payment request sent.',
          data: {
            checkout_url: callbackUrl,
            reference: transaction.reference,
            transaction_id: pawapayDepositId,
            amount: feeBreakdown.netAmount,
            collection_fee: feeBreakdown.collectionFee,
            gross_amount: feeBreakdown.grossAmount,
          },
        });
      } catch (error) {
        const rejected = error.response?.status >= 400 && error.response?.status < 500 && ![408,409,429].includes(error.response.status);
        await Transaction.updateOne({ _id: transaction._id, status: 'pending' }, { $set: {
          ...(rejected ? { status: 'failed' } : {}),
          'metadata.initialization_error': error.message,
        } });
        if (rejected) return res.status(error.response.status).json({ success: false, message: 'The provider rejected the payment request.', data: { reference: transaction.reference } });
        return res.status(202).json({ success: true, status: 'PENDING', message: 'Payment confirmation is pending. Do not submit another payment.', data: {
          reference: transaction.reference, transaction_id: pawapayDepositId, checkout_url: callbackUrl,
          amount: feeBreakdown.netAmount, gross_amount: feeBreakdown.grossAmount, collection_fee: feeBreakdown.collectionFee,
        } });
      }
    }

    const result = await eversend.initiateCollection({
      amount: feeBreakdown.grossAmount,
      currency,
      phone: normalizedPhone,
      country,
      firstName: firstName || 'Aura',
      lastName,
      email: req.user.email,
      redirectUrl: callbackUrl,
      transactionRef,
    });

    // Eversend may return {code:200, data:{...}} or {success:true, data:{...}}.
    // Axios already throws on HTTP 4xx/5xx, so reaching here means the HTTP call
    // succeeded. Only reject if the body has an explicit success:false signal.
    if (!result || result.success === false) {
      transaction.status = 'failed';
      transaction.gateway_response = result;
      await transaction.save();
      return res.status(400).json({ success: false, message: result?.message || 'Subscription payment could not be initialized.' });
    }

    const responseData = result?.data || result;
    transaction.gateway_transaction_id = responseData?.transactionId || responseData?.transaction_id || responseData?.id || null;
    transaction.gateway_response = responseData;
    await transaction.save();

    return res.status(200).json({
      success: true,
      message: 'Subscription payment request sent.',
      data: {
        checkout_url: responseData?.checkoutUrl || responseData?.checkout_url || responseData?.paymentUrl || responseData?.payment_url || callbackUrl,
        reference: transaction.reference,
        transaction_id: transaction.gateway_transaction_id,
        amount: feeBreakdown.netAmount,
        collection_fee: feeBreakdown.collectionFee,
        gross_amount: feeBreakdown.grossAmount,
      },
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    if (externalPayment && (error.response || ['ETIMEDOUT','ECONNABORTED','ECONNRESET','ENOTFOUND','EAI_AGAIN'].includes(error.code))) {
      const definite = error.response?.status >= 400 && error.response?.status < 500 && ![408,409,429].includes(error.response.status);
      await Transaction.updateOne({ _id: externalPayment._id, status: 'pending' }, { $set: { ...(definite ? { status: 'failed' } : {}), 'metadata.initialization_error': error.message } });
      return res.status(definite ? 422 : 202).json({ success: !definite, status: definite ? 'FAILED' : 'PENDING',
        message: definite ? 'The payment provider declined this request.' : 'Payment confirmation is pending. Do not submit another payment.',
        data: { reference: externalPayment.reference, transaction_id: externalPayment.gateway_transaction_id } });
    }
    next(error);
  } finally {
    session.endSession();
  }
};

const getAdminOverview = async (req, res, next) => {
  try {
    await ensureDefaultSubscriptionPlan();
    await UserSubscription.updateMany({ status: 'active', expires_at: { $lte: new Date(), $ne: null } }, { $set: { status: 'expired' } });

    // Status priority for deduplication: active wins over everything, then grace, limited, pending, cancelled/expired
    const STATUS_PRIORITY = { active: 5, grace: 4, limited: 3, pending: 2, refunded: 1, cancelled: 0, expired: 0 };

    const [plans, rawSubscriptions, requirements, revenueAgg] = await Promise.all([
      SubscriptionPlan.find().sort({ is_active: -1, price: 1, createdAt: -1 }),

      // Aggregation: deduplicate by (user_id + role), keep highest-priority + newest record per user
      UserSubscription.aggregate([
        { $sort: { createdAt: -1 } },
        {
          $addFields: {
            statusPriority: {
              $switch: {
                branches: [
                  { case: { $eq: ['$status', 'active'] },    then: 5 },
                  { case: { $eq: ['$status', 'grace'] },     then: 4 },
                  { case: { $eq: ['$status', 'limited'] },   then: 3 },
                  { case: { $eq: ['$status', 'pending'] },   then: 2 },
                  { case: { $eq: ['$status', 'refunded'] },  then: 1 },
                ],
                default: 0,
              },
            },
          },
        },
        { $sort: { statusPriority: -1, createdAt: -1 } },
        // Group by user + role, pick the best record
        {
          $group: {
            _id: { user_id: '$user_id', role: '$role' },
            doc: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$doc' } },
        { $sort: { createdAt: -1 } },
        { $limit: 500 },
        // Lookup user info
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user_id',
            pipeline: [{ $project: { name: 1, email: 1, phone: 1, role: 1, avatar: 1, branding: 1 } }],
          },
        },
        { $unwind: { path: '$user_id', preserveNullAndEmptyArrays: true } },
        // Lookup plan info
        {
          $lookup: {
            from: 'subscriptionplans',
            localField: 'plan_id',
            foreignField: '_id',
            as: 'plan_id',
          },
        },
        { $unwind: { path: '$plan_id', preserveNullAndEmptyArrays: true } },
      ]),

      getRoleRequirements(),
      Transaction.aggregate([
        { $match: { status: 'completed', $or: [{ type: 'subscription' }, { type: 'refund', 'metadata.purpose': 'subscription_refund' }] } },
        { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ['$type', 'refund'] }, { $multiply: ['$amount', -1] }, '$amount'] } }, count: { $sum: { $cond: [{ $eq: ['$type', 'subscription'] }, 1, 0] } } } },
      ]),
    ]);

    const subscriptions = rawSubscriptions.map(sub => ({ ...sub, integrity_issues: [
      ...(!sub.user_id ? ['account_missing'] : []), ...(!sub.plan_id ? ['plan_missing'] : []),
      ...(sub.amount_paid > 0 && !sub.payment_transaction_id ? ['payment_unverified'] : []),
    ] }));

    const activeCount  = subscriptions.filter((sub) => sub.status === 'active' && sub.user_id && sub.plan_id && (!sub.started_at || new Date(sub.started_at) <= new Date())).length;
    const pendingCount = subscriptions.filter((sub) => sub.status === 'pending').length;
    const graceCount   = subscriptions.filter((sub) => sub.status === 'grace').length;
    const limitedCount = subscriptions.filter((sub) => sub.status === 'limited').length;

    res.status(200).json({
      success: true,
      data: {
        plans,
        subscriptions,
        requirements: requirements.required,
        grace_days: requirements.grace_days,
        stats: {
          active: activeCount,
          pending: pendingCount,
          grace: graceCount,
          limited: limitedCount,
          revenue: revenueAgg[0]?.total || 0,
          completed_payments: revenueAgg[0]?.count || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const createPlan = async (req, res, next) => {
  try {
    const payload = {
      name: req.body.name,
      slug: req.body.slug || String(req.body.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      description: req.body.description || '',
      price: Number(req.body.price || 0),
      currency: req.body.currency || 'XAF',
      billing_cycle: req.body.billing_cycle || 'one_time',
      duration_days: req.body.duration_days === '' || req.body.duration_days === undefined ? null : Number(req.body.duration_days || 0),
      contact_required: Boolean(req.body.contact_required),
      roles: Array.isArray(req.body.roles) ? req.body.roles : ['vendor'],
      features: Array.isArray(req.body.features) ? req.body.features : [],
      is_active: req.body.is_active !== false,
    };
    const plan = await SubscriptionPlan.create(payload);
    res.status(201).json({ success: true, data: { plan } });
  } catch (error) {
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const allowed = ['name', 'slug', 'description', 'price', 'currency', 'billing_cycle', 'duration_days', 'contact_required', 'roles', 'features', 'is_active'];
    const patch = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    });
    if (patch.duration_days === '') patch.duration_days = null;
    if (patch.duration_days !== undefined && patch.duration_days !== null) {
      patch.duration_days = Number(patch.duration_days || 0);
    }
    if (patch.contact_required !== undefined) {
      patch.contact_required = Boolean(patch.contact_required);
    }
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    plan.set(patch);
    await plan.save();
    res.status(200).json({ success: true, data: { plan } });
  } catch (error) {
    next(error);
  }
};

const updateRoleRequirements = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();
    const incoming = req.body.requirements || req.body;
    const incomingGraceDays = req.body.grace_days || {};
    for (const role of ['customer', 'vendor', 'logistics']) {
      if (incoming[role] !== undefined && typeof incoming[role] !== 'boolean') return res.status(400).json({ success: false, message: 'Role requirements must be true or false.' });
      if (incomingGraceDays[role] !== undefined && (!Number.isFinite(Number(incomingGraceDays[role])) || Number(incomingGraceDays[role]) < 0)) return res.status(400).json({ success: false, message: 'Grace days must be finite and non-negative.' });
    }
    settings.subscription_required_roles = {
      customer: incoming.customer ?? settings.subscription_required_roles?.customer ?? false,
      vendor: incoming.vendor ?? settings.subscription_required_roles?.vendor ?? true,
      logistics: incoming.logistics ?? settings.subscription_required_roles?.logistics ?? true,
      admin: false,
    };
    settings.subscription_grace_days = {
      customer: Math.max(0, Number(incomingGraceDays.customer ?? settings.subscription_grace_days?.customer ?? 0)),
      vendor: Math.max(0, Number(incomingGraceDays.vendor ?? settings.subscription_grace_days?.vendor ?? 7)),
      logistics: Math.max(0, Number(incomingGraceDays.logistics ?? settings.subscription_grace_days?.logistics ?? 3)),
      admin: 0,
    };
    await settings.save();
    const requirements = await getRoleRequirements();
    res.status(200).json({
      success: true,
      data: {
        requirements: requirements.required,
        grace_days: requirements.grace_days,
      },
    });
  } catch (error) {
    next(error);
  }
};

const activateUserSubscription = async (req, res, next) => {
  try {
    const { user_id, plan_id, role, note, started_at, expires_at } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'User ID or Email is required.' });
    }

    let user;
    if (String(user_id).includes('@')) {
      user = await User.findOne({ email: String(user_id).toLowerCase().trim() });
    } else {
      if (mongoose.Types.ObjectId.isValid(user_id)) {
        user = await User.findById(user_id);
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found with the provided ID or Email.' });
    }

    const subscription = await activateSubscription({
      userId: user._id,
      planId: plan_id,
      role: role || (user.role === 'manager' ? user.previous_role : user.role),
      source: 'admin',
      activatedBy: req.user._id,
      note: note || 'Activated manually by admin.',
      startedAt: started_at ? new Date(started_at) : null,
      expiresAt: expires_at ? new Date(expires_at) : undefined,
    });
    res.status(200).json({ success: true, data: { subscription } });
  } catch (error) {
    next(error);
  }
};

const deletePlan = async (req, res, next) => {
  try {
    const referenced = await UserSubscription.exists({ plan_id: req.params.id }) || await Transaction.exists({ 'metadata.plan_id': new mongoose.Types.ObjectId(req.params.id) });
    if (referenced) return res.status(409).json({ success: false, message: 'This plan has subscription or payment records. Disable it instead of deleting it.' });
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    res.status(200).json({ success: true, message: 'Plan deleted.' });
  } catch (error) {
    next(error);
  }
};

const deleteUserSubscription = async (req, res, next) => {
  try {
    const existing = await UserSubscription.findById(req.params.id);
    if (existing && (existing.payment_transaction_id || existing.amount_paid > 0)) return res.status(409).json({ success: false, message: 'Paid subscription history must be retained. Cancel or refund this subscription instead.' });
    const subscription = await UserSubscription.findByIdAndDelete(req.params.id);
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found.' });
    res.status(200).json({ success: true, message: 'Subscription deleted.' });
  } catch (error) {
    next(error);
  }
};

const updateUserSubscription = async (req, res, next) => {
  try {
    const { action, note = '' } = req.body;
    if (!['cancel', 'refund', 'activate'].includes(action)) return res.status(400).json({ success: false, message: 'Use cancel, refund, or activate.' });
    const subscription = await require('../services/subscriptionAdmin.service').updateSubscription({ id: req.params.id, action, note, actorId: req.user._id });
    if (subscription.$locals?.refundApplied) {
      const owner = await User.findById(subscription.user_id).select('wallet_balance').lean();
      req.app.get('io')?.to(String(subscription.user_id)).emit('wallet:credited', { balance: owner?.wallet_balance, amount: subscription.amount_paid, reference: subscription.payment_reference });
      setImmediate(() => require('../utils/notifier').sendNotification(req.app, subscription.user_id, {
        title: 'Subscription refunded', message: subscription.amount_paid + ' XAF has been returned to your Aura Wallet.', type: 'refund', metadata: { link: '/wallet', target_id: subscription._id },
      }).catch(() => {}));
    }
    res.status(200).json({ success: true, data: { subscription } });
  } catch (error) { next(error); }
};

module.exports = {
  getMySubscription,
  initializeSubscription,
  getAdminOverview,
  createPlan,
  updatePlan,
  deletePlan,
  updateRoleRequirements,
  activateUserSubscription,
  updateUserSubscription,
  deleteUserSubscription,
};
