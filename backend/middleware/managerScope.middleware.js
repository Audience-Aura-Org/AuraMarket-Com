/**
 * middleware/managerScope.middleware.js
 * Auradime — Manager Scope Loader
 *
 * Runs after `protect` on admin routes. For managers, loads their
 * active assignments and resolves vendor/logistics IDs onto req.managerScope.
 * For admins, sets req.managerScope = null (unrestricted).
 *
 * Usage in routes:
 *   router.use(protect, restrictTo('admin', 'manager'), loadManagerScope);
 */

const ManagerAssignment = require('../models/ManagerAssignment.model');
const Vendor            = require('../models/Vendor.model');
const LogisticsCompany  = require('../models/LogisticsCompany.model');

/**
 * Loads manager scope (assigned user/vendor/logistics IDs + access map)
 * onto req.managerScope.  Admins get null (no restrictions).
 */
async function loadManagerScope(req, res, next) {
  try {
    if (req.user.role !== 'manager') {
      req.managerScope = null; // admin — unrestricted
      return next();
    }

    // Fetch active assignments for this manager
    const assignments = await ManagerAssignment.find({
      manager_id: req.user._id,
      status: 'active',
    }).lean();

    const userIds = assignments.map(a => a.user_id);

    // Build access-level lookup: userId (string) → access_level
    const accessMap = {};
    assignments.forEach(a => {
      accessMap[a.user_id.toString()] = a.access_level;
    });

    // Resolve vendor and logistics entity IDs for assigned users
    const [vendors, logisticsCompanies] = await Promise.all([
      Vendor.find({ user_id: { $in: userIds } }, '_id user_id').lean(),
      LogisticsCompany.find({ user_id: { $in: userIds } }, '_id user_id').lean(),
    ]);

    // Reverse maps: entityId → userId (for resolving scope on write ops)
    const vendorToUser = {};
    vendors.forEach(v => {
      vendorToUser[v._id.toString()] = v.user_id.toString();
    });
    const logisticsToUser = {};
    logisticsCompanies.forEach(l => {
      logisticsToUser[l._id.toString()] = l.user_id.toString();
    });

    req.managerScope = {
      userIds,
      vendorIds: vendors.map(v => v._id),
      logisticsIds: logisticsCompanies.map(l => l._id),
      accessMap,
      vendorToUser,
      logisticsToUser,

      /**
       * Resolve a userId from an entity reference.
       * @param {'user'|'vendor'|'logistics'} entityType
       * @param {string|ObjectId} entityId
       * @returns {string|null} userId as string, or null
       */
      resolveUserId(entityType, entityId) {
        const id = entityId?.toString();
        if (!id) return null;
        if (entityType === 'user') return id;
        if (entityType === 'vendor') return this.vendorToUser[id];
        if (entityType === 'logistics') return this.logisticsToUser[id];
        return null;
      },

      /**
       * Check if a userId is in the manager's assigned scope.
       * @param {string|ObjectId} userId
       * @returns {boolean}
       */
      isInScope(userId) {
        if (!userId) return false;
        const id = userId.toString();
        return this.userIds.some(uid => uid.toString() === id);
      },

      /**
       * Check if the manager has at least the required access level for a user.
       * @param {string|ObjectId} userId
       * @param {'read_only'|'standard'|'full'} minLevel
       * @returns {boolean}
       */
      hasLevel(userId, minLevel) {
        const levels = { read_only: 0, standard: 1, full: 2 };
        const userLevel = this.accessMap[userId?.toString()];
        if (userLevel === undefined) return false;
        return levels[userLevel] >= levels[minLevel];
      },
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { loadManagerScope };
