const mongoose = require('mongoose');
const User = require('../models/User.model');
const { calculateExpiry, activationDates } = require('../utils/subscriptionDates');
const SubscriptionPlan = require('../models/SubscriptionPlan.model');
const UserSubscription = require('../models/UserSubscription.model');
const PlatformSettings = require('../models/PlatformSettings.model');

const DEFAULT_VENDOR_PLANS = [
  {
    name: 'Welcome',
    slug: 'vendor-welcome',
    description: "Perfect if you're testing the waters and want to see how selling works.",
    price: 500,
    currency: 'XAF',
    billing_cycle: 'one_time',
    duration_days: 30,
    roles: ['vendor'],
    features: [
      { key: 'max_products',         type: 'number', value: 20,    label: 'List up to 20 products in your store' },
      { key: 'shop_logo',            type: 'toggle', value: true,  label: 'Add your shop logo' },
      { key: 'email_support',        type: 'toggle', value: true,  label: 'Email support available' },
      { key: 'promotions',           type: 'toggle', value: false, label: 'No promotions or discounts' },
      { key: 'sales_reports',        type: 'toggle', value: false, label: 'No sales reports' },
      { key: 'status_duration_days', type: 'number', value: 1,     label: 'Status posts visible for 1 day only' },
    ],
    is_active: true,
  },
  {
    name: 'Standard',
    slug: 'vendor-standard',
    description: 'Best for sellers who are serious and want more customers to find them.',
    price: 15000,
    currency: 'XAF',
    billing_cycle: 'one_time',
    duration_days: 60,
    roles: ['vendor'],
    features: [
      { key: 'max_products',         type: 'number', value: 100,  label: 'List up to 100 products in your store' },
      { key: 'shop_logo',            type: 'toggle', value: true, label: 'Add your shop logo' },
      { key: 'promotions',           type: 'toggle', value: true, label: 'Promotions and discounts enabled' },
      { key: 'sales_reports',        type: 'toggle', value: true, label: 'Sales reports available' },
      { key: 'email_support',        type: 'toggle', value: true, label: 'Priority email support' },
      { key: 'status_duration_days', type: 'number', value: 3,    label: 'Status posts visible for up to 3 days' },
    ],
    is_active: true,
  },
  {
    name: 'Business',
    slug: 'vendor-business',
    description: 'For shops with lots of products that need full control and visibility.',
    price: 35000,
    currency: 'XAF',
    billing_cycle: 'one_time',
    duration_days: 90,
    roles: ['vendor'],
    features: [
      { key: 'max_products',         type: 'number', value: 500,  label: 'List up to 500 products in your store' },
      { key: 'shop_logo',            type: 'toggle', value: true, label: 'Add your shop logo' },
      { key: 'promotions',           type: 'toggle', value: true, label: 'Promotions and discounts enabled' },
      { key: 'sales_reports',        type: 'toggle', value: true, label: 'Full sales reports & analytics' },
      { key: 'email_support',        type: 'toggle', value: true, label: 'Priority email support' },
      { key: 'status_duration_days', type: 'number', value: 7,    label: 'Status posts visible for up to 7 days' },
    ],
    is_active: true,
  },
  {
    name: 'Power Seller',
    slug: 'vendor-power-seller',
    description: 'For big brands or wholesalers who need a custom deal and full platform access.',
    price: 100000,
    currency: 'XAF',
    billing_cycle: 'one_time',
    duration_days: 365,
    contact_required: true,
    roles: ['vendor'],
    features: [
      { key: 'max_products',         type: 'number', value: 9999, label: 'Unlimited products in your store' },
      { key: 'shop_logo',            type: 'toggle', value: true, label: 'Add your shop logo' },
      { key: 'promotions',           type: 'toggle', value: true, label: 'Promotions and discounts enabled' },
      { key: 'sales_reports',        type: 'toggle', value: true, label: 'Full sales reports & analytics' },
      { key: 'email_support',        type: 'toggle', value: true, label: 'Dedicated account manager & support' },
      { key: 'status_duration_days', type: 'number', value: 7,    label: 'Status posts visible for up to 7 days' },
    ],
    is_active: true,
  },
];

const DEFAULT_LOGISTICS_PLANS = [
  {
    name: 'Welcome',
    slug: 'logistics-welcome',
    description: "Perfect if you're testing the waters and want to see how delivery services work.",
    price: 500,
    currency: 'XAF',
    billing_cycle: 'one_time',
    duration_days: 30,
    roles: ['logistics'],
    features: [
      { key: 'max_shipments',        type: 'number', value: 10,    label: 'Manage up to 10 active shipments' },
      { key: 'max_routes',           type: 'number', value: 3,     label: 'Create up to 3 delivery routes' },
      { key: 'route_optimization',   type: 'toggle', value: false, label: 'Basic route optimization tools' },
      { key: 'email_support',        type: 'toggle', value: true,  label: 'Email support available' },
      { key: 'status_duration_days', type: 'number', value: 1,     label: 'Status posts visible for 1 day only' },
    ],
    is_active: true,
  },
  {
    name: 'Standard Partner',
    slug: 'logistics-standard',
    description: 'Best for growing logistics companies and delivery drivers who want more shipments.',
    price: 15000,
    currency: 'XAF',
    billing_cycle: 'one_time',
    duration_days: 60,
    roles: ['logistics'],
    features: [
      { key: 'max_shipments',        type: 'number', value: 100,  label: 'Manage up to 100 active shipments' },
      { key: 'max_routes',           type: 'number', value: 20,   label: 'Create up to 20 delivery routes' },
      { key: 'route_optimization',   type: 'toggle', value: true, label: 'Route optimization tools' },
      { key: 'email_support',        type: 'toggle', value: true, label: 'Priority email support' },
      { key: 'status_duration_days', type: 'number', value: 3,    label: 'Status posts visible for up to 3 days' },
    ],
    is_active: true,
  },
  {
    name: 'Logistics Pro',
    slug: 'logistics-business',
    description: 'For established delivery networks needing full visibility and automation.',
    price: 35000,
    currency: 'XAF',
    billing_cycle: 'one_time',
    duration_days: 90,
    roles: ['logistics'],
    features: [
      { key: 'max_shipments',        type: 'number', value: 500,  label: 'Manage up to 500 active shipments' },
      { key: 'max_routes',           type: 'number', value: 100,  label: 'Create up to 100 delivery routes' },
      { key: 'route_optimization',   type: 'toggle', value: true, label: 'Route optimization tools' },
      { key: 'email_support',        type: 'toggle', value: true, label: 'Priority email support' },
      { key: 'status_duration_days', type: 'number', value: 7,    label: 'Status posts visible for up to 7 days' },
    ],
    is_active: true,
  },
  {
    name: 'Enterprise Logistics',
    slug: 'logistics-enterprise',
    description: 'For major shipping networks requiring custom deals and full system integration.',
    price: 100000,
    currency: 'XAF',
    billing_cycle: 'one_time',
    duration_days: 365,
    contact_required: true,
    roles: ['logistics'],
    features: [
      { key: 'max_shipments',        type: 'number', value: 9999, label: 'Unlimited active shipments' },
      { key: 'max_routes',           type: 'number', value: 9999, label: 'Unlimited delivery routes' },
      { key: 'route_optimization',   type: 'toggle', value: true, label: 'Route optimization tools' },
      { key: 'email_support',        type: 'toggle', value: true, label: 'Dedicated account manager & support' },
      { key: 'status_duration_days', type: 'number', value: 7,    label: 'Status posts visible for up to 7 days' },
    ],
    is_active: true,
  },
];

const DEFAULT_VENDOR_PLAN = DEFAULT_VENDOR_PLANS[0];
const LEGACY_VENDOR_PLAN_SLUGS = ['vendor-welcome-package'];

const toObjectId = (value) => {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

let seedInFlight = null;
const ensureDefaultSubscriptionPlan = () => {
  if (!seedInFlight) seedInFlight = seedDefaultPlans().finally(() => { seedInFlight = null; });
  return seedInFlight;
};
const seedDefaultPlans = async () => {
  const allDefaults = [...DEFAULT_VENDOR_PLANS, ...DEFAULT_LOGISTICS_PLANS];
  const plans = [];
  const existing = await SubscriptionPlan.find({ slug: { $in: allDefaults.map(plan => plan.slug) } });
  if (existing.length === allDefaults.length && allDefaults.every(defaults => {
    const plan = existing.find(plan => plan.slug === defaults.slug);
    return defaults.features.every(feature => plan.features.some(value => value?.key === feature.key));
  })) return existing.find(plan => plan.slug === DEFAULT_VENDOR_PLAN.slug);

  for (const defaults of allDefaults) {
    const { features, ...insertOnlyFields } = defaults;

    // Upsert: create with all fields if it doesn't exist yet
    let plan = await SubscriptionPlan.findOneAndUpdate(
      { slug: defaults.slug },
      { $setOnInsert: { ...insertOnlyFields, features } },
      { returnDocument: 'after', upsert: true }
    );

    // For plans that already existed, backfill any feature keys that are
    // missing (e.g. status_duration_days added after initial seed).
    // Existing feature entries set by admins are never touched.
    if (plan) {
      const existingKeys = new Set((plan.features || []).map((f) => f?.key));
      const missing = features.filter((f) => !existingKeys.has(f.key));
      if (missing.length > 0) {
        plan = await SubscriptionPlan.findByIdAndUpdate(
          plan._id,
          { $push: { features: { $each: missing } } },
          { returnDocument: 'after' }
        );
      }
    }

    plans.push(plan);
  }

  await SubscriptionPlan.updateMany(
    { slug: { $in: LEGACY_VENDOR_PLAN_SLUGS } },
    { $set: { is_active: false } }
  );

  return plans[0];
};

const getRoleRequirements = async () => {
  const settings = await PlatformSettings.getSettings();
  return {
    required: {
      customer: Boolean(settings.subscription_required_roles?.customer),
      vendor: settings.subscription_required_roles?.vendor !== false,
      logistics: settings.subscription_required_roles?.logistics !== false,
      admin: false,
    },
    grace_days: {
      customer: Number(settings.subscription_grace_days?.customer || 0),
      vendor: Number(settings.subscription_grace_days?.vendor || 0),
      logistics: Number(settings.subscription_grace_days?.logistics || 0),
      admin: 0,
    },
  };
};

const isRoleSubscriptionRequired = async (role) => {
  if (!role || role === 'admin') return false;
  const requirements = await getRoleRequirements();
  return Boolean(requirements.required?.[role]);
};

const getActiveSubscription = async (userId, role, session = null) => {
  const now = new Date();
  const query = UserSubscription.findOne({
    user_id: userId,
    role,
    status: 'active',
    $and: [{ $or: [{ started_at: null }, { started_at: { $lte: now } }] }],
    $or: [
      { expires_at: null },
      { expires_at: { $gt: now } },
    ],
  }).populate('plan_id');

  if (session) query.session(session);
  const subscription = await query.sort('-createdAt');
  return subscription?.plan_id ? subscription : null;
};

const getLatestSubscriptionRecord = async (userId, role, session = null) => {
  const query = UserSubscription.findOne({ user_id: userId, role }).populate('plan_id');
  if (session) query.session(session);
  return query.sort('-createdAt');
};

const getDefaultPlanForRole = async (role) => {
  await ensureDefaultSubscriptionPlan();
  return SubscriptionPlan.findOne({ is_active: true, roles: role }).sort({ price: 1, createdAt: 1 });
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
};

/**
 * Returns the current grace/limited record IF one already exists in the DB.
 * Does NOT auto-create a record — new users should see a clean "no subscription"
 * state and be free to purchase a plan without being blocked by a phantom record.
 */
const getExistingGraceOrLimitedRecord = async ({ user, role, graceDays }) => {
  const now = new Date();
  const latest = await getLatestSubscriptionRecord(user._id, role);

  if (!latest) return null;

  // Only consider records that were NOT auto-created placeholders (amount_paid > 0 means real payment)
  // OR records created by admin manual activation
  if (latest.status === 'grace') {
    if (latest.grace_expires_at && latest.grace_expires_at > now) {
      return latest; // still within grace window
    }
    // Grace expired → transition to limited and save
    latest.status = 'limited';
    latest.limited_since = latest.limited_since || now;
    latest.restriction_reason = 'Subscription grace period ended.';
    latest.history.push({
      action: 'limited',
      note: 'Grace period ended. Account moved to limited subscription access.',
      at: now,
    });
    await latest.save();
    return latest;
  }

  if (latest.status === 'limited') {
    return latest;
  }

  return null;
};

const getSubscriptionStatus = async (user, role = null) => {
  const activeRole = role || user?.role;
  if (!user || activeRole === 'admin') {
    return {
      required: false,
      active: true,
      subscribed: true,
      access_allowed: true,
      access_state: 'not_required',
      limited: false,
      grace: false,
      grace_days: 0,
      role: activeRole || 'guest',
      subscription: null,
    };
  }

  await UserSubscription.updateMany({ user_id: user._id, role: activeRole, status: 'active', expires_at: { $lte: new Date(), $ne: null } }, { $set: { status: 'expired' } });
  const requirements = await getRoleRequirements();
  const required = Boolean(requirements.required?.[activeRole]);
  const graceDays = Number(requirements.grace_days?.[activeRole] || 0);
  const subscription = await getActiveSubscription(user._id, activeRole);

  if (!required) {
    return {
      required,
      active: true,
      subscribed: Boolean(subscription),
      access_allowed: true,
      access_state: subscription ? 'active' : 'not_required',
      limited: false,
      grace: false,
      grace_days: graceDays,
      role: activeRole,
      subscription,
    };
  }

  if (subscription) {
    return {
      required,
      active: true,
      subscribed: true,
      access_allowed: true,
      access_state: 'active',
      limited: false,
      grace: false,
      grace_days: graceDays,
      role: activeRole,
      subscription,
    };
  }

  // Check for existing grace/limited records only — do NOT auto-create new ones.
  // New vendors with no subscription should see a clean "unsubscribed" state.
  const accessRecord = await getExistingGraceOrLimitedRecord({ user, role: activeRole, graceDays });
  const isGrace = accessRecord?.status === 'grace' && accessRecord.grace_expires_at && accessRecord.grace_expires_at > new Date();
  const isLimited = accessRecord?.status === 'limited';

  // If no record at all (brand new user) → clean unsubscribed state, free to purchase
  if (!accessRecord) {
    return {
      required,
      active: false,
      subscribed: false,
      access_allowed: false,
      access_state: 'unsubscribed',
      limited: false,
      grace: false,
      grace_days: graceDays,
      grace_expires_at: null,
      limited_since: null,
      role: activeRole,
      subscription: null,
    };
  }

  return {
    required,
    active: isGrace,
    subscribed: false,
    access_allowed: isGrace,
    access_state: isGrace ? 'grace' : 'limited',
    limited: isLimited,
    grace: isGrace,
    grace_days: graceDays,
    grace_expires_at: accessRecord?.grace_expires_at || null,
    limited_since: isLimited ? (accessRecord?.limited_since || new Date()) : null,
    role: activeRole,
    subscription: accessRecord,
  };
};

const getPlansForRole = async (role) => {
  await ensureDefaultSubscriptionPlan();
  return SubscriptionPlan.find({
    is_active: true,
    roles: role,
  }).sort({ price: 1, createdAt: 1 });
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
  startedAt = null,
  expiresAt = undefined,
}) => {
  if (!session) {
    if (!planId) await ensureDefaultSubscriptionPlan();
    const ownedSession = await mongoose.startSession();
    try {
      let result;
      await ownedSession.withTransaction(async () => { result = await activateSubscription({ userId, planId, role, transaction, source, activatedBy, session: ownedSession, note, startedAt, expiresAt }); });
      return result;
    } finally { await ownedSession.endSession(); }
  }
  if (process.env.NODE_ENV === 'production' && transaction &&
      (transaction.metadata?.is_sandbox || String(transaction.gateway_transaction_id || '').startsWith('SBX-'))) {
    throw Object.assign(new Error('Simulated payments cannot activate production subscriptions.'), { statusCode: 400 });
  }
  const owner = await User.findOneAndUpdate({ _id: userId, is_active: { $ne: false } }, { $inc: { subscription_revision: 1 } }, { session });
  if (!owner) throw Object.assign(new Error('Subscription account not found or inactive.'), { statusCode: 404 });
  if (transaction?._id) {
    const applied = await UserSubscription.findOne({ payment_transaction_id: transaction._id, user_id: userId, role }).session(session);
    if (applied) return applied;
  }
  if (planId && !toObjectId(planId)) throw Object.assign(new Error('Invalid plan ID.'), { statusCode: 400 });
  const planObjectId = toObjectId(planId);
  const plan = planObjectId
    ? await SubscriptionPlan.findById(planObjectId).session(session || null)
    : await SubscriptionPlan.findOne({ is_active: true, roles: role }).sort({ price: 1 }).session(session);

  if (!plan) {
    throw Object.assign(new Error('Subscription plan not found.'), { statusCode: 404 });
  }

  if (!plan.roles.includes(role) && !(transaction?.metadata?.role === role)) {
    throw Object.assign(new Error(`This plan does not apply to ${role} accounts.`), { statusCode: 400 });
  }

  if (role !== owner.role && !(owner.role === 'manager' && role === owner.previous_role)) {
    throw Object.assign(new Error('Subscription role must match the account role.'), { statusCode: 400 });
  }
  if (transaction && (transaction.status !== 'completed' || String(transaction.user_id) !== String(userId) ||
      String(transaction.currency).toUpperCase() !== String(transaction.metadata?.plan_snapshot?.currency || plan.currency).toUpperCase())) {
    throw Object.assign(new Error('Subscription requires a matching completed payment.'), { statusCode: 400 });
  }

  const terms = transaction?.metadata?.plan_snapshot || plan;
  const dates = activationDates({ startedAt, expiresAt, cycle: terms.billing_cycle, durationDays: terms.duration_days });
  const existing = await getActiveSubscription(userId, role, session);
  if (existing) {
    if (String(existing.plan_id?._id || existing.plan_id) === String(plan._id)) {
      if (!transaction && startedAt == null && expiresAt === undefined) return existing;
      // A distinct confirmed payment must buy time, never disappear behind an
      // already-active record. Replayed payment IDs returned above.
      if (transaction && existing.expires_at && expiresAt === undefined) dates.expiry = calculateExpiry(terms.billing_cycle, terms.duration_days, existing.expires_at);
    }
    existing.status = 'cancelled';
    existing.history.push({
      action: 'replaced',
      note: `Replaced by ${plan.name} subscription.`,
      by: activatedBy || null,
      at: new Date(),
    });
    if (session) {
      await existing.save({ session });
    } else {
      await existing.save();
    }
  }

  const activationDate = dates.start;
  const resolvedExpiry = dates.expiry;
  const payload = {
    user_id: userId,
    plan_id: plan._id,
    role,
    status: 'active',
    billing_cycle: terms.billing_cycle,
    amount_paid: transaction?.amount ?? 0,
    currency: transaction?.currency || plan.currency,
    started_at: activationDate,
    expires_at: resolvedExpiry,
    payment_transaction_id: transaction?._id || null,
    payment_reference: transaction?.reference || null,
    source,
    activated_by: activatedBy || null,
    history: [{ action: 'activated', note, by: activatedBy || null, at: activationDate }],
  };

  const created = session
    ? await UserSubscription.create([payload], { session })
    : await UserSubscription.create(payload);

  // Auto-verify the logistics company profile when a logistics subscription is activated
  if (role === 'logistics') {
    const LogisticsCompany = require('../models/LogisticsCompany.model');
    await LogisticsCompany.updateOne(
      { user_id: userId },
      { $set: { is_verified: true } },
      session ? { session } : undefined
    );
  }

  const subscription = Array.isArray(created) ? created[0] : created;
  await require('../utils/auditTrail').recordAudit({
    actorId: activatedBy || userId, action: 'subscription_activated', targetType: 'UserSubscription', targetId: subscription._id,
    after: { status: subscription.status, plan_id: plan._id, role, amount_paid: payload.amount_paid }, session,
    meta: { source, reference: transaction?.reference, transaction_id: transaction?._id },
  });
  return subscription;
};

module.exports = {
  DEFAULT_VENDOR_PLAN,
  DEFAULT_VENDOR_PLANS,
  ensureDefaultSubscriptionPlan,
  getRoleRequirements,
  isRoleSubscriptionRequired,
  getActiveSubscription,
  getSubscriptionStatus,
  getPlansForRole,
  activateSubscription,
};
