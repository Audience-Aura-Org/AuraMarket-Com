const Notification = require('../models/Notification.model');
const { escapeRegExp } = require('../middleware/security.middleware');

const CATEGORIES = {
  orders: ['order_status', 'order_update', 'order_message'],
  payments: ['payment_received', 'payment', 'wallet_update', 'deposit', 'withdrawal', 'payout', 'refund', 'subscription'],
  messages: ['chat_alert', 'message', 'shipment_message'],
  logistics: ['logistics_update', 'p2p_status', 'p2p_pickup', 'p2p_delivery'],
  system: ['system_alert', 'security', 'vendor_update', 'promo'],
};

/**
 * controllers/notification.controller.js
 * Auradime — User Notifications
 */

// @route   GET /api/notifications
// @desc    Get user notifications
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 20)));
    const query = { recipient: req.user._id };
    if (Object.hasOwn(CATEGORIES, req.query.category)) query.type = { $in: CATEGORIES[req.query.category] };
    if (req.query.unread === 'true') query.is_read = false;
    if (req.query.search && String(req.query.search).trim()) {
      const pattern = new RegExp(escapeRegExp(String(req.query.search).trim().slice(0, 100)), 'i');
      query.$or = [{ title: pattern }, { message: pattern }];
    }
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: req.user._id, is_read: false }),
    ]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: { notifications, total, page, pages: Math.max(1, Math.ceil(total / limit)), unreadCount }
    });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { is_read: true },
      { returnDocument: 'after' }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, data: { notification } });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/notifications/read-all
// @desc    Mark all user notifications as read
// @access  Private
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, is_read: false },
      { is_read: true }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/notifications/:id
// @desc    Delete a single notification
// @access  Private
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
