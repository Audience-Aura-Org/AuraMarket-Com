const {
  getSubscriptionStatus,
  getPlansForRole,
} = require('../services/subscription.service');

const requireActiveSubscription = (role = null) => async (req, res, next) => {
  try {
    const activeRole = role || req.user?.role;
    // Skip subscription check for admins, managers, and manager act-as sessions
    if (!req.user || ['admin', 'manager'].includes(req.user?.role)) return next();
    if (req.actor && req.actor.role === 'manager') return next();

    const status = await getSubscriptionStatus(req.user, activeRole);
    if (status.active) return next();

    const plans = await getPlansForRole(activeRole);
    return res.status(402).json({
      success: false,
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'A subscription is required before this feature can be used.',
      redirect: `/subscribe?role=${encodeURIComponent(activeRole)}`,
      data: {
        ...status,
        role: activeRole,
        required: true,
        plans,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { requireActiveSubscription };
