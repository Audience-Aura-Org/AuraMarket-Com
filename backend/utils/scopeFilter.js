/**
 * utils/scopeFilter.js
 * Auradime — Centralized Manager Scope Filtering
 *
 * Provides three helpers:
 *   scoped(model, filter, scope)           — adds scope to list queries via $and
 *   assertInScope(scope, userId)           — 404 if userId not in manager's scope
 *   assertAccessLevel(scope, userId, lvl)  — 404 if out of scope, 403 if insufficient level
 *
 * Default-deny: if a model has no entry in SCOPE_MAP, scoped() throws.
 */

/**
 * Per-model scope filter definitions.
 * Each function receives a managerScope object and returns a Mongo filter
 * that restricts results to the manager's assigned users.
 */
const SCOPE_MAP = {
  User:              s => ({ _id: { $in: s.userIds } }),
  Vendor:            s => ({ user_id: { $in: s.userIds } }),
  Order:             s => ({ $or: [
                          { customer_id: { $in: s.userIds } },
                          { vendor_id: { $in: s.vendorIds } },
                        ]}),
  Product:           s => ({ vendor_id: { $in: s.vendorIds } }),
  Transaction:       s => ({ user_id: { $in: s.userIds } }),
  WithdrawalRequest: s => ({ requested_by: { $in: s.userIds } }),
  Shipment:          s => ({ $or: [
                          { vendor_id: { $in: s.vendorIds } },
                          { logistics_id: { $in: s.logisticsIds } },
                        ]}),
  KYC:               s => ({ user_id: { $in: s.userIds } }),
  Dispute:           s => ({ initiator_id: { $in: s.userIds } }),
  Escrow:            s => ({ $or: [
                          { buyer_id: { $in: s.userIds } },
                          { vendor_id: { $in: s.vendorIds } },
                        ]}),
  EmailLog:          s => ({ recipient_user_id: { $in: s.userIds } }),
  LogisticsCompany:  s => ({ user_id: { $in: s.userIds } }),
  Report:            s => ({ reporter_id: { $in: s.userIds } }),
  AuditLog:          s => ({ user_id: { $in: s.userIds } }),
};

/**
 * Merges a scope restriction into an existing query filter using $and.
 * If scope is null (admin), returns the original filter unchanged.
 * Throws if no scope policy exists for the model (default-deny).
 *
 * @param {string} modelName   Mongoose model name (e.g. 'User', 'Order')
 * @param {object} filter      The existing Mongo query filter
 * @param {object|null} scope  req.managerScope (null for admins)
 * @returns {object}           The merged filter
 */
function scoped(modelName, filter, scope) {
  if (!scope) return filter; // admin — unrestricted

  const buildScopeFilter = SCOPE_MAP[modelName];
  if (!buildScopeFilter) {
    const err = new Error(`No scope policy defined for model: ${modelName}. Default-deny.`);
    err.statusCode = 403;
    throw err;
  }

  const scopeFilter = buildScopeFilter(scope);

  // Use $and to avoid overwriting any existing _id or $or in filter
  if (Object.keys(filter).length === 0) return scopeFilter;
  return { $and: [filter, scopeFilter] };
}

/**
 * Asserts a userId is within the manager's scope.
 * Returns 404 (not 403) to prevent ID enumeration.
 *
 * @param {object|null} scope  req.managerScope
 * @param {string|ObjectId} userId  The user to check
 */
function assertInScope(scope, userId) {
  if (!scope) return; // admin
  if (!userId) {
    const err = new Error('Not found');
    err.statusCode = 404;
    throw err;
  }
  if (!scope.isInScope(userId)) {
    const err = new Error('Not found');
    err.statusCode = 404;
    throw err;
  }
}

/**
 * Asserts both scope membership AND minimum access level.
 * Out-of-scope → 404.  In-scope but insufficient level → 403.
 *
 * @param {object|null} scope
 * @param {string|ObjectId} userId
 * @param {'read_only'|'standard'|'full'} requiredLevel
 */
function assertAccessLevel(scope, userId, requiredLevel) {
  if (!scope) return; // admin
  assertInScope(scope, userId); // 404 if out of scope
  if (!scope.hasLevel(userId, requiredLevel)) {
    const err = new Error(
      `Insufficient access level. Required: ${requiredLevel}`
    );
    err.statusCode = 403;
    throw err;
  }
}

module.exports = { scoped, assertInScope, assertAccessLevel, SCOPE_MAP };
