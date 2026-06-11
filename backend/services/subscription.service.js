const mongoose = require('mongoose');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const UserSubscription = require('../models/UserSubscription.model');
const PlatformSettings = require('../models/PlatformSettings.model');

const DEFAULT_VENDOR_PLAN = {
  name: 'Vendor Welcome Package',
  slug: 'vendor-welcome-package',
  description: 'One-time vendor access package for launching and managing an Auradime store.',
  price: 500,
  currency: 'XAF',
  billing_cycle: 'one_time',
  roles: ['vendor'],
  features: [
    'Vendor dashboard access',
    'Product publishing tools',
    'Order and wallet management',
    'Storefront visibility',
  ],
  is_active: true,
};

const toObjectId = (value) => {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

const ensureDefaultSubscriptionPlan = async () => {
  let plan = await SubscriptionPlan.findOne({ slug: DEFAULT_VENDOR_PLAN.slug });
  if (!plan) {
    plan = await SubscriptionPlan.create(DEFAULT_VENDOR_PLAN);
  }
  return plan;
};

const getRoleRequirements = async () => {
  const settings = await PlatformSettings.getSettings();
  return {
    customer: Boolean(settings.subscription_required_roles?.customer),
    vendor: settings.subscription_required_roles?.vendor !== false,
    logistics: Boolean(settings.subscription_required_roles?.logistics),
    admin: false,
  };
};

const isRoleSubscriptionRequired = async (role) => {
  if (!role || role === 'admin') return false;
  const requirements = await getRoleRequirements();
  return Boolean(requirements[role]);
};

const getActiveSubscription = async (userId, role, session = null) => {
  const now = new Date();
  const query = UserSubscription.findOne({
    user_id: userId,
    role,
    status: 'active',
    $or: [
      { expires_at: null },
      { expires_at: { $gt: now } },
    ],
  }).populate('plan_id');

  if (session) query.session(session);
  return query.sort('-createdAt');
};

const getSubscriptionStatus = async (user, role = null) => {
  const activeRole = role || user?.role;
  if (!user || activeRole === 'admin') {
    return {
      required: false,
      active: true,
      role: activeRole || 'guest',
      subscription: null,
    };
  }

  await ensureDefaultSubscriptionPlan();
  const required = await isRoleSubscriptionRequired(activeRole);
  const subscription = await getActiveSubscription(user._id, activeRole);

  return {
    required,
    active: !required || Boolean(subscription),
    role: activeRole,
    subscription,
  };
};

const getPlansForRole = async (role) => {
  await ensureDefaultSubscriptionPlan();
  return SubscriptionPlan.find({
    is_active: true,
    roles: role,
  }).sort({ price: 1, createdAt: 1 });
};

const calculateExpiry = (billingCycle) => {
  if (billingCycle === 'monthly') {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date;
  }
  if (billingCycle === 'yearly') {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date;
  }
  return null;
};

const activateSubscription = async ({
  userId,
  planId,
  role,
  transaction = null,
  source = 'manual',
  activatedBy = null,
  session = null,
  note = 'Subscription activated.',
}) => {
  const planObjectId = toObjectId(planId);
  const plan = planObjectId
    ? await SubscriptionPlan.findById(planObjectId).session(session || null)
    : await ensureDefaultSubscriptionPlan();

  if (!plan) {
    throw new Error('Subscription plan not found.');
  }

  if (!plan.roles.includes(role)) {
    throw new Error(`This plan does not apply to ${role} accounts.`);
  }

  const existing = await getActiveSubscription(userId, role, session);
  if (existing) return existing;

  const startedAt = new Date();
  const payload = {
    user_id: userId,
    plan_id: plan._id,
    role,
    status: 'active',
    billing_cycle: plan.billing_cycle,
    amount_paid: transaction?.amount || plan.price,
    currency: transaction?.currency || plan.currency,
    started_at: startedAt,
    expires_at: calculateExpiry(plan.billing_cycle),
    payment_transaction_id: transaction?._id || null,
    payment_reference: transaction?.reference || null,
    source,
    activated_by: activatedBy || null,
    history: [{ action: 'activated', note, by: activatedBy || null, at: startedAt }],
  };

  const created = session
    ? await UserSubscription.create([payload], { session })
    : await UserSubscription.create(payload);

  return Array.isArray(created) ? created[0] : created;
};

module.exports = {
  DEFAULT_VENDOR_PLAN,
  ensureDefaultSubscriptionPlan,
  getRoleRequirements,
  isRoleSubscriptionRequired,
  getActiveSubscription,
  getSubscriptionStatus,
  getPlansForRole,
  activateSubscription,
};
