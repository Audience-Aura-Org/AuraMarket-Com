/**
 * utils/roles.js
 * Auradime — Centralized role helpers.
 */

/** Returns true if the role has admin-level platform access (admin or manager). */
const isAdminLike = (role) => ['admin', 'manager'].includes(role);

/**
 * Returns the effective role for a user, considering that managers
 * retain their previous role's capabilities.
 * For a manager with previous_role='vendor', this returns 'vendor'
 * when checking vendor-specific business logic.
 */
const effectiveRole = (user) => user.previous_role || user.role;

/**
 * Returns true if the user is currently acting in the given role,
 * either directly or via previous_role (for managers).
 */
const hasRole = (user, role) => {
  if (user.role === role) return true;
  if (user.role === 'manager' && user.previous_role === role) return true;
  return false;
};

module.exports = { isAdminLike, effectiveRole, hasRole };
