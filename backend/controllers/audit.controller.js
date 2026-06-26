/**
 * controllers/audit.controller.js
 * Auradime — System Audit Log Management
 */

const AuditLog = require('../models/AuditLog.model');

/**
 * Helper function to log an action
 * Usage: logAction(req.user._id, 'price_change', 'product', product._id, { old: 500, new: 600 })
 */
const logAction = async (userId, action, targetType, targetId, changes = {}, metadata = {}) => {
  try {
    await AuditLog.create({
      user_id: userId,
      action,
      target_type: targetType,
      target_id: targetId,
      changes,
      metadata
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const { action, target_type, page = 1, limit = 50 } = req.query;
    const query = {};
    if (action) query.action = action;
    if (target_type) query.target_type = target_type;

    const logs = await AuditLog.find(query)
      .populate('user_id', 'name email role avatar')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await AuditLog.countDocuments(query);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      data: { logs }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  logAction,
  getAuditLogs
};
