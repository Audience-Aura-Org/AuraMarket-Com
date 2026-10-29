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

// Admin filter groups. Older entries used lowercase target types ("user"), newer
// ones model names ("User"), so matching is case-insensitive.
const CATEGORIES = {
  users: ['user', 'vendor', 'manager'],
  payments: ['transaction', 'usersubscription', 'subscription', 'wallet', 'withdrawal', 'escrow'],
  deliveries: ['shipment', 'riderprofile', 'logisticscompany', 'agencysettlement', 'deliveryassignment'],
  orders: ['order'],
  products: ['product'],
  disputes: ['dispute'],
};
// Actions counted as high priority.
const HIGH_PRIORITY = /ban|delete|suspend|reject|demote|deactivat|direct_payout|role_change|limited|refund/;

const getAuditLogs = async (req, res, next) => {
  try {
    const { action, target_type, category } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const query = {};
    if (action) query.action = String(action);
    if (target_type) query.target_type = String(target_type);
    if (CATEGORIES[category]) query.target_type = { $in: CATEGORIES[category].map((t) => new RegExp('^' + t + '$', 'i')) };

    const [logs, total, highPriority, latest] = await Promise.all([
      AuditLog.find(query).populate('user_id', 'name email role avatar').sort('-createdAt').skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(query),
      AuditLog.countDocuments({ ...query, action: query.action || HIGH_PRIORITY }),
      AuditLog.findOne(query).sort('-createdAt').select('createdAt').lean(),
    ]);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      data: { logs, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), high_priority: highPriority, latest_at: latest?.createdAt || null },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  logAction,
  getAuditLogs
};
