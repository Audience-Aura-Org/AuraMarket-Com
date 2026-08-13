const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const UserSubscription = require('../models/UserSubscription.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const eversend = require('../services/eversend.service');
const payunit = require('../services/payunit.service');
const {
  ensureDefaultSubscriptionPlan,
  getRoleRequirements,
  getPlansForRole,
  getSubscriptionStatus,
  activateSubscription,
} = require('../services/subscription.service');
const { applyMobileMoneyCollectionFee } = require('../utils/mobileMoneyFees');

const sanitizePhone = (phone, country = 'CM') => {
  if (!phone) return phone;
  let cleaned = String(phone).replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`;
  if (!cleaned.startsWith('+')) {
    const prefixes = { CM: '237', KE: '254', UG: '256', RW: '250', GH: '233', NG: '234', CI: '225' };
    const prefix = prefixes[country] || '237';
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    cleaned = `+${prefix}${cleaned}`;
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
    const data = await serializeStatus(req.user, role);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const initializeSubscription = async (req, res, next) => {
  const session = await mongoose.startSession();
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

    if (role === 'admin') {
      return res.status(400).json({ success: false, message: 'Admin accounts do not require subscriptions.' });
    }

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

    if (payment_method === 'wallet') {
      session.startTransaction();
      const user = await User.findById(req.user._id).session(session);
      if (!user || Number(user.wallet_balance || 0) < Number(plan.price || 0)) {
        await session.abortTransaction();
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance for this subscription.' });
      }

      user.wallet_balance -= Number(plan.price || 0);
      await user.save({ session });

      const transaction = await Transaction.create([{
        user_id: user._id,
        type: 'subscription',
        amount: plan.price,
        reference: generateSubscriptionRef(user._id),
        status: 'completed',
        description: `${plan.name} subscription paid from Aura Wallet`,
        gateway: 'wallet',
        currency: plan.currency,
        metadata: {
          purpose: 'subscription',
          plan_id: plan._id,
          role,
          billing_cycle: plan.billing_cycle,
        },
      }], { session });

      const subscription = await activateSubscription({
        userId: user._id,
        planId: plan._id,
        role,
        transaction: transaction[0],
        source: 'wallet',
        session,
        note: 'Activated after wallet payment.',
      });

      await session.commitTransaction();

      const io = req.app.get('io');
      if (io) {
        const payload = { balance: user.wallet_balance, amount: plan.price, reference: transaction[0].reference };
        io.to(user._id.toString()).emit('wallet:debited', payload);
        io.to(`user:${user._id}`).emit('wallet:debited', payload);
      }

      return res.status(200).json({
        success: true,
        message: 'Subscription activated.',
        data: { subscription, transaction: transaction[0], status: await serializeStatus(user, role) },
      });
    }

    const externalGateways = ['eversend', 'payunit'];
    if (!externalGateways.includes(payment_method)) {
      return res.status(400).json({ success: false, message: 'Choose wallet, PayUnit, or Eversend to pay for this subscription.' });
    }

    const normalizedPhone = payment_method === 'payunit'
      ? payunit.normalizePhone(phone || req.user.phone, country)
      : sanitizePhone(phone || req.user.phone, country);
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required for mobile money subscription payment.' });
    }

    const feeBreakdown = applyMobileMoneyCollectionFee(plan.price, payment_method, currency);
    const transactionRef = payment_method === 'payunit'
      ? payunit.cleanTransactionId(generateSubscriptionRef(req.user._id))
      : generateSubscriptionRef(req.user._id);

    // Always use the configured public web URL — never allow localhost/capacitor origins
    // (which arrive from APK requests) to reach PayUnit, as they are rejected by the gateway.
    const publicWebUrl = (process.env.WEB_CLIENT_URL && !/localhost|127\.0\.0\.1/i.test(process.env.WEB_CLIENT_URL))
      ? process.env.WEB_CLIENT_URL.replace(/\/$/, '')
      : 'https://auradime.com';
    const safeRedirect = redirect_url && !/localhost|127\.0\.0\.1|capacitor:\/\//i.test(redirect_url)
      ? redirect_url
      : null;
    const callbackUrl = safeRedirect || `${publicWebUrl}/wallet/verify?gateway=${payment_method}&type=subscription&ref=${transactionRef}`;
    const [firstName, ...rest] = String(req.user.name || 'Aura User').split(' ');
    const lastName = rest.join(' ') || 'User';

    // Idempotency guard for PayUnit: if user already has a recent pending
    // subscription payment for this plan, return that reference instead of
    // creating a duplicate that Orange Money will reject with 422.
    if (payment_method === 'payunit') {
      const recentCutoff = new Date(Date.now() - 15 * 60 * 1000);
      const existingPending = await Transaction.findOne({
        user_id: req.user._id,
        gateway: 'payunit',
        status: 'pending',
        'metadata.purpose': 'subscription',
        'metadata.plan_id': plan._id,
        createdAt: { $gte: recentCutoff },
      }).sort({ createdAt: -1 });
      if (existingPending) {
        return res.status(200).json({
          success: true,
          message: 'A payment request is already pending. Please approve the USSD prompt on your phone.',
          data: {
            checkout_url: callbackUrl,
            reference: existingPending.reference,
            transaction_id: existingPending.gateway_transaction_id || existingPending.reference,
            amount: existingPending.metadata?.net_amount || existingPending.amount,
            collection_fee: existingPending.metadata?.collection_fee || 0,
            gross_amount: existingPending.metadata?.gross_amount || existingPending.amount,
            orange_hosted: false,
            pending_resume: true,
          },
        });
      }
    }

    const transaction = await Transaction.create({
      user_id: req.user._id,
      type: 'subscription',
      amount: plan.price,
      currency: plan.currency,
      reference: transactionRef,
      status: 'pending',
      gateway: payment_method,
      description: `${plan.name} subscription via ${payment_method === 'payunit' ? 'PayUnit' : 'Eversend'}`,
      metadata: {
        purpose: 'subscription',
        plan_id: plan._id,
        role,
        billing_cycle: plan.billing_cycle,
        net_amount: feeBreakdown.netAmount,
        collection_fee: feeBreakdown.collectionFee,
        gross_amount: feeBreakdown.grossAmount,
        ...(payment_method === 'payunit' ? { phone: payunit.normalizePhoneIntl(phone || req.user.phone, country) } : {}),
      },
    });

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
        await transaction.deleteOne();
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
          await transaction.deleteOne();
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
    next(error);
  } finally {
    session.endSession();
  }
};

const getAdminOverview = async (req, res, next) => {
  try {
    await ensureDefaultSubscriptionPlan();

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
        { $match: { type: 'subscription', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const subscriptions = rawSubscriptions;

    const activeCount  = subscriptions.filter((sub) => sub.status === 'active').length;
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
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, patch, { returnDocument: 'after', runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
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
    settings.subscription_required_roles = {
      customer: Boolean(incoming.customer),
      vendor: incoming.vendor !== false,
      logistics: incoming.logistics !== false,
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
      role: role || user.role,
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
    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.' });
    res.status(200).json({ success: true, message: 'Plan deleted.' });
  } catch (error) {
    next(error);
  }
};

const deleteUserSubscription = async (req, res, next) => {
  try {
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
    const subscription = await UserSubscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ success: false, message: 'Subscription not found.' });

    if (!['cancel', 'refund', 'activate'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Use cancel, refund, or activate.' });
    }

    if (action === 'cancel') subscription.status = 'cancelled';
    if (action === 'refund') subscription.status = 'refunded';
    if (action === 'activate') {
      subscription.status = 'active';
      subscription.started_at = subscription.started_at || new Date();
      subscription.limited_since = null;
      subscription.restriction_reason = null;
    }

    subscription.history.push({
      action,
      note,
      by: req.user._id,
      at: new Date(),
    });
    await subscription.save();

    res.status(200).json({ success: true, data: { subscription } });
  } catch (error) {
    next(error);
  }
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
