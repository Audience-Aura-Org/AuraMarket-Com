const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const UserSubscription = require('../models/UserSubscription.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const eversend = require('../services/eversend.service');
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
    requirements,
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

    const current = await getSubscriptionStatus(req.user, role);
    if (current.active && current.subscription) {
      return res.status(200).json({ success: true, message: 'Subscription already active.', data: await serializeStatus(req.user, role) });
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

    if (payment_method !== 'eversend') {
      return res.status(400).json({ success: false, message: 'Choose wallet or Eversend to pay for this subscription.' });
    }

    const normalizedPhone = sanitizePhone(phone || req.user.phone, country);
    if (!normalizedPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required for mobile money subscription payment.' });
    }

    const feeBreakdown = applyMobileMoneyCollectionFee(plan.price, 'eversend', currency);
    const transactionRef = generateSubscriptionRef(req.user._id);
    const callbackUrl = redirect_url || `${process.env.WEB_CLIENT_URL}/wallet/verify?gateway=eversend&type=subscription&ref=${transactionRef}`;
    const [firstName, ...rest] = String(req.user.name || 'Aura User').split(' ');
    const lastName = rest.join(' ') || 'User';

    const transaction = await Transaction.create({
      user_id: req.user._id,
      type: 'subscription',
      amount: plan.price,
      currency: plan.currency,
      reference: transactionRef,
      status: 'pending',
      gateway: 'eversend',
      description: `${plan.name} subscription via Eversend`,
      metadata: {
        purpose: 'subscription',
        plan_id: plan._id,
        role,
        billing_cycle: plan.billing_cycle,
        net_amount: feeBreakdown.netAmount,
        collection_fee: feeBreakdown.collectionFee,
        gross_amount: feeBreakdown.grossAmount,
      },
    });

    if (process.env.EVERSEND_SANDBOX_MODE === 'true') {
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

    if (!result?.success) {
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
    const [plans, subscriptions, requirements, revenueAgg] = await Promise.all([
      SubscriptionPlan.find().sort({ is_active: -1, price: 1, createdAt: -1 }),
      UserSubscription.find()
        .populate('user_id', 'name email phone role avatar branding')
        .populate('plan_id')
        .sort('-createdAt')
        .limit(300),
      getRoleRequirements(),
      Transaction.aggregate([
        { $match: { type: 'subscription', status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const activeCount = subscriptions.filter((sub) => sub.status === 'active').length;
    const pendingCount = subscriptions.filter((sub) => sub.status === 'pending').length;

    res.status(200).json({
      success: true,
      data: {
        plans,
        subscriptions,
        requirements,
        stats: {
          active: activeCount,
          pending: pendingCount,
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
    const allowed = ['name', 'slug', 'description', 'price', 'currency', 'billing_cycle', 'roles', 'features', 'is_active'];
    const patch = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    });
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
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
    settings.subscription_required_roles = {
      customer: Boolean(incoming.customer),
      vendor: incoming.vendor !== false,
      logistics: Boolean(incoming.logistics),
      admin: false,
    };
    await settings.save();
    res.status(200).json({ success: true, data: { requirements: await getRoleRequirements() } });
  } catch (error) {
    next(error);
  }
};

const activateUserSubscription = async (req, res, next) => {
  try {
    const { user_id, plan_id, role, note } = req.body;
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const subscription = await activateSubscription({
      userId: user._id,
      planId: plan_id,
      role: role || user.role,
      source: 'admin',
      activatedBy: req.user._id,
      note: note || 'Activated manually by admin.',
    });
    res.status(200).json({ success: true, data: { subscription } });
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
  updateRoleRequirements,
  activateUserSubscription,
  updateUserSubscription,
};
