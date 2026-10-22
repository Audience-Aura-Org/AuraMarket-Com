/**
 * middleware/delegate.middleware.js
 * Auradime — Manager Delegation Middleware
 *
 * Two middleware functions for the manager workspace architecture:
 *
 *  1. loadManagerScope — For /api/v1/manager/* routes.
 *     Loads all active, non-expired assignments and resolves vendor/logistics
 *     IDs onto req.scope.
 *
 *  2. actAs — Mounted once at the top of the v1 router (before every
 *     feature router). Reads the X-Act-As header; when present and the
 *     caller is a manager, swaps req.user to the target user so existing
 *     controllers work unchanged (protect/protectOptional keep the swapped
 *     identity). Logs write operations to ActivityLog and notifies the
 *     account owner for money-category actions.
 */

const mongoose          = require('mongoose');
const ManagerAssignment = require('../models/ManagerAssignment.model');
const ActivityLog       = require('../models/ActivityLog.model');
const User              = require('../models/User.model');
const Vendor            = require('../models/Vendor.model');
const LogisticsCompany  = require('../models/LogisticsCompany.model');
const Notification      = require('../models/Notification.model');
const { resolveUserFromToken } = require('./auth.middleware');

// ── Helpers ────────────────────────────────────────────────────────

/** Build an active + non-expired filter with optional extra criteria. */
const activeFilter = (extra = {}) => ({
  status: 'active',
  $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
  ...extra,
});

/** Roles that can never be managed (or acted as). */
const UNMANAGEABLE_ROLES = ['admin', 'manager'];

// ── URL → Permission Category Mapping ──────────────────────────────
// The category is decided by the FIRST path segment that maps to one,
// so /messages/order/:id is "messages" and /vendor/products is "products".

const SEGMENT_CATEGORY = {
  products: 'products', product: 'products', inventory: 'products',
  statuses: 'products', status: 'products',

  orders: 'orders', order: 'orders', 'order-threads': 'orders',
  shipments: 'orders', shipment: 'orders', 'shipment-threads': 'orders',
  deliveries: 'orders', delivery: 'orders', manifests: 'orders',
  reservations: 'orders', p2p: 'orders',

  messages: 'messages', message: 'messages', chat: 'messages',
  disputes: 'messages', dispute: 'messages',

  wallet: 'money', withdrawals: 'money', withdrawal: 'money',
  escrow: 'money', payments: 'money', payouts: 'money', bank: 'money',

  profile: 'profile', kyc: 'profile', settings: 'profile',
  store: 'profile', 'store-settings': 'profile', media: 'profile',
  pricing: 'profile', zones: 'profile', restaurant: 'profile',
  addresses: 'profile',
};

/** Strip the /api or /api/v1 mount prefix and the query string. */
const normalizePath = (originalUrl = '') =>
  originalUrl.split('?')[0].replace(/^\/api(\/v1)?(?=\/|$)/, '') || '/';

const categoryFor = (path) => {
  for (const segment of path.split('/')) {
    const category = SEGMENT_CATEGORY[segment.toLowerCase()];
    if (category) return category;
  }
  return null;
};

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ── Deny List: Sensitive Paths ──────────────────────────────────────
// These paths must NEVER be accessible via act-as, even with the right
// permission category. They change credentials, delete accounts, alter
// authentication state, or would bind the manager's device to the user.

const DENY_PATTERNS = [
  /^\/admin(\/|$)/,
  /^\/auth\/(delete-account|logout|change-password)/,
  /^\/security(\/|$)/,
  /^\/push(\/|$)/,
  /^\/users\/change-(email|password)/,
];

/** The manager's own space never runs as another account. */
const MANAGER_SPACE = /^\/manager(\/|$)/;

// ═══════════════════════════════════════════════════════════════════
// 1.  loadManagerScope — Manager Space (cross-account overview)
// ═══════════════════════════════════════════════════════════════════

/**
 * Use after `protect` + `restrictTo('manager')` on /api/v1/manager/* routes.
 *
 * Builds `req.scope`:
 *   - links         — raw assignment docs
 *   - userIds       — array of assigned user ObjectIds
 *   - perms         — { [userId]: { products, orders, messages, money, profile } }
 *   - vendorIds     — vendor _id array for assigned users
 *   - logisticsIds  — logistics _id array for assigned users
 *   - vendorUser    — { [vendorId]: userId }
 *   - logisticsUser — { [logisticsId]: userId }
 */
async function loadManagerScope(req, res, next) {
  try {
    const allLinks = await ManagerAssignment.find(
      activeFilter({ manager_id: req.user._id })
    )
      .select('user_id permissions expires_at')
      .lean();

    // Drop accounts that were deleted, deactivated, or promoted to an
    // unmanageable role since the assignment was made.
    const manageable = await User.find(
      {
        _id: { $in: allLinks.map((l) => l.user_id) },
        role: { $nin: UNMANAGEABLE_ROLES },
        is_active: { $ne: false },
      },
      '_id'
    ).lean();
    const manageableIds = new Set(manageable.map((u) => String(u._id)));
    const links = allLinks.filter((l) => manageableIds.has(String(l.user_id)));

    const userIds = links.map((l) => l.user_id);

    const [vendors, logistics] = await Promise.all([
      Vendor.find({ user_id: { $in: userIds } }, '_id user_id').lean(),
      LogisticsCompany.find({ user_id: { $in: userIds } }, '_id user_id').lean(),
    ]);

    req.scope = {
      links,
      userIds,
      perms: Object.fromEntries(
        links.map((l) => [String(l.user_id), l.permissions || {}])
      ),
      vendorIds:     vendors.map((v) => v._id),
      logisticsIds:  logistics.map((l) => l._id),
      vendorUser:    Object.fromEntries(vendors.map((v) => [String(v._id), String(v.user_id)])),
      logisticsUser: Object.fromEntries(logistics.map((l) => [String(l._id), String(l.user_id)])),
    };

    next();
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2.  actAs — Account Workspace (single-account delegation)
// ═══════════════════════════════════════════════════════════════════

/**
 * Mounted at the top of the v1 router, before every feature router.
 * Authenticates the caller itself (feature routers run `protect` later,
 * which keeps the swapped identity).
 *
 * When a manager sends `X-Act-As: <userId>`:
 *   - Validates assignment, permissions, and deny list
 *   - Swaps `req.user` to the target user
 *   - Saves original manager as `req.actor`
 *   - Logs non-GET operations on response finish
 *   - Notifies account owner for money-category actions
 *
 * No-op when the header is absent, the request targets the manager's own
 * space, or the caller is not an authenticated manager.
 */
async function actAs(req, res, next) {
  const targetId = req.headers['x-act-as'];
  if (!targetId || req.actingAs) return next();

  const url = normalizePath(req.originalUrl);
  if (MANAGER_SPACE.test(url)) return next();

  try {
    const manager = req.user || (await resolveUserFromToken(req));
    if (!manager || manager.role !== 'manager') return next();

    // Check deny list — sensitive actions are never delegatable
    if (DENY_PATTERNS.some((re) => re.test(url))) {
      return res.status(403).json({
        success: false,
        message: 'This action cannot be performed on behalf of another account.',
      });
    }

    // Find active assignment for this manager → target
    const link = mongoose.Types.ObjectId.isValid(targetId)
      ? await ManagerAssignment.findOne(
          activeFilter({ manager_id: manager._id, user_id: targetId })
        ).lean()
      : null;

    if (!link) {
      return res.status(404).json({
        success: false,
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'No active assignment found for this account.',
      });
    }

    // Determine category from URL and enforce permissions
    const category = categoryFor(url);
    const isRead = READ_METHODS.has(req.method);

    if (category && !link.permissions?.[category]) {
      return res.status(403).json({
        success: false,
        message: `You do not have ${category} access for this account.`,
      });
    }

    // Uncategorized write → block (safety catch-all)
    if (!category && !isRead) {
      return res.status(403).json({
        success: false,
        message: 'This action is not available when working for an account.',
      });
    }

    // Load the target user — must exist, be active, and not be admin/manager
    const target = await User.findById(targetId).select('-password');
    if (!target || target.is_active === false || UNMANAGEABLE_ROLES.includes(target.role)) {
      return res.status(404).json({
        success: false,
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Target account not found.',
      });
    }

    // ── Swap identity ──────────────────────────────────────────────
    req.actor    = manager;    // original manager (controllers can read req.actor._id)
    req.user     = target;     // downstream sees the target user
    req.actingAs = {
      assignmentId: link._id,
      category,
    };

    // ── Post-response hooks (write operations only) ────────────────
    if (!isRead) {
      res.on('finish', () => {
        // Only log successful operations
        if (res.statusCode >= 400) return;

        // Activity log
        ActivityLog.create({
          manager_id: req.actor._id,
          user_id:    target._id,
          category:   category || 'other',
          method:     req.method,
          path:       url,
          status:     res.statusCode,
          fields:     Object.keys(req.body || {}).slice(0, 30),
          ip:         req.ip,
        }).catch(() => {});

        // Notify account owner for money-related actions
        if (category === 'money') {
          Notification.create({
            recipient: target._id,
            title:     'Manager action on your account',
            message:   `Your manager performed a financial action (${req.method} ${url}).`,
            type:      'security',
            metadata:  { target_id: req.actor._id },
          }).catch(() => {});
        }
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}

// ── Exports ──────────────────────────────────────────────────────────

module.exports = { loadManagerScope, actAs, activeFilter, categoryFor, normalizePath, UNMANAGEABLE_ROLES };
