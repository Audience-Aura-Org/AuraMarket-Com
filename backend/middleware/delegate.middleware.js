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
 *  2. actAs — For vendor/logistics/order/wallet/chat routers.
 *     Reads X-Act-As header; when present and the caller is a manager,
 *     swaps req.user to the target user so existing controllers work unchanged.
 *     Logs write operations to ActivityLog and notifies account owner for
 *     money-category actions.
 */

const ManagerAssignment = require('../models/ManagerAssignment.model');
const ActivityLog       = require('../models/ActivityLog.model');
const User              = require('../models/User.model');
const Vendor            = require('../models/Vendor.model');
const LogisticsCompany  = require('../models/LogisticsCompany.model');
const Notification      = require('../models/Notification.model');

// ── Helpers ────────────────────────────────────────────────────────

/** Build an active + non-expired filter with optional extra criteria. */
const activeFilter = (extra = {}) => ({
  status: 'active',
  $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
  ...extra,
});

// ── URL → Permission Category Mapping ──────────────────────────────

const CATEGORIES = [
  [/\/(products?|inventory)(\/|$)/,                          'products'],
  [/\/(orders?|shipments?|deliver(y|ies)|requests?)(\/|$)/,  'orders'],
  [/\/(messages?|disputes?|chat)(\/|$)/,                     'messages'],
  [/\/(wallet|withdraw\w*|bank|payouts?|escrow)(\/|$)/,      'money'],
  [/\/(profile|kyc|settings)(\/|$)/,                         'profile'],
];

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ── Deny List: Sensitive Paths ──────────────────────────────────────
// These paths must NEVER be accessible via act-as, even with the right
// permission category. They change credentials, delete accounts, or
// alter authentication state.

const DENY_PATTERNS = [
  /\/auth\/delete-account/,
  /\/security\/2fa/,
  /\/security\/change-password/,
  /\/security\/sessions/,
  /\/auth\/logout/,
  /\/users\/change-email/,
  /\/users\/change-password/,
  /\/push\/subscribe/,
  /\/push\/unsubscribe/,
];

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
    const links = await ManagerAssignment.find(
      activeFilter({ manager_id: req.user._id })
    )
      .select('user_id permissions expires_at')
      .lean();

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
 * Insert between `protect` and `restrictTo` on vendor / logistics /
 * order / wallet / withdrawal / dispute / chat routers.
 *
 * When the manager sends `X-Act-As: <userId>`:
 *   - Validates assignment, permissions, and deny list
 *   - Swaps `req.user` to the target user
 *   - Saves original manager as `req.actor`
 *   - Logs non-GET operations on response finish
 *   - Notifies account owner for money-category actions
 *
 * If X-Act-As is absent or the caller isn't a manager, acts as a no-op.
 */
async function actAs(req, res, next) {
  const targetId = req.headers['x-act-as'];

  // No-op: header absent or caller isn't a manager
  if (!targetId || req.user.role !== 'manager') return next();

  try {
    const url = req.originalUrl.split('?')[0];

    // Block manager/admin namespaces
    if (/^\/api\/(admin|manager)(\/|$)/.test(url)) {
      return res.status(403).json({
        success: false,
        message: 'Not available when working for an account.',
      });
    }

    // Check deny list — sensitive actions are never delegatable
    if (DENY_PATTERNS.some((re) => re.test(url))) {
      return res.status(403).json({
        success: false,
        message: 'This action cannot be performed on behalf of another account.',
      });
    }

    // Find active assignment for this manager → target
    const link = await ManagerAssignment.findOne(
      activeFilter({ manager_id: req.user._id, user_id: targetId })
    ).lean();

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'No active assignment found for this account.',
      });
    }

    // Determine category from URL and enforce permissions
    const match = CATEGORIES.find(([re]) => re.test(url));
    const category = match ? match[1] : null;
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

    // Load the target user — must exist and not be admin/manager
    const target = await User.findById(targetId);
    if (!target || ['admin', 'manager'].includes(target.role)) {
      return res.status(404).json({
        success: false,
        message: 'Target account not found.',
      });
    }

    // ── Swap identity ──────────────────────────────────────────────
    req.actor    = req.user;   // original manager (controllers can read req.actor._id)
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
            message:   `Your manager performed a financial action (${req.method} ${url.replace(/^\/api\/v1/, '')}).`,
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

module.exports = { loadManagerScope, actAs, activeFilter };
