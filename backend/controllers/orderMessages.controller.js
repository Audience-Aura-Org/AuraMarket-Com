/**
 * controllers/orderMessages.controller.js
 * Auradime — Order Thread Messages
 *
 * Handles message threads on orders between buyer, vendor, and logistics.
 */

const OrderMessage = require('../models/OrderMessage.model');
const Order = require('../models/Order.model');
const Vendor = require('../models/Vendor.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const Shipment = require('../models/Shipment.model');

// ── GET MESSAGES FOR AN ORDER ───────────────────────────────────────
const getOrderMessages = async (req, res) => {
  try {
    const { orderId } = req.params;
    const user = req.user;

    const order = await Order.findById(orderId)
      .select('customer_id vendor_id logistics_company_id')
      .populate('vendor_id', 'user_id');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify user is a party to this order
    const userId = user._id.toString();
    const isCustomer = order.customer_id?.toString() === userId;
    const isVendor = order.vendor_id?.user_id?.toString() === userId;
    const isAdmin = user.role === 'admin';

    // Check if logistics
    let isLogistics = false;
    if (user.role === 'logistics') {
      const firm = await LogisticsCompany.findOne({ user_id: user._id }).select('_id').lean();
      if (firm) {
        const shipment = await Shipment.findOne({ order_id: orderId, logistics_id: firm._id }).select('_id').lean();
        isLogistics = !!shipment;
      }
    }

    if (!isCustomer && !isVendor && !isLogistics && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const messages = await OrderMessage.find({ order_id: orderId })
      .sort({ timestamp: 1 })
      .lean();

    return res.json({ success: true, data: { messages } });
  } catch (err) {
    console.error('[orderMessages] getOrderMessages error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

// ── SEND MESSAGE TO AN ORDER THREAD ─────────────────────────────────
const sendOrderMessage = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { text } = req.body;
    const user = req.user;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const order = await Order.findById(orderId)
      .select('customer_id vendor_id logistics_company_id')
      .populate('vendor_id', 'user_id store_name');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Determine sender role
    const userId = user._id.toString();
    const isCustomer = order.customer_id?.toString() === userId;
    const isVendor = order.vendor_id?.user_id?.toString() === userId;
    const isAdmin = user.role === 'admin';

    let senderRole = null;
    if (isCustomer) senderRole = 'buyer';
    else if (isVendor) senderRole = 'vendor';
    else if (isAdmin) senderRole = 'admin';
    else if (user.role === 'logistics') {
      const firm = await LogisticsCompany.findOne({ user_id: user._id }).select('_id').lean();
      if (firm) {
        const shipment = await Shipment.findOne({ order_id: orderId, logistics_id: firm._id }).select('_id').lean();
        if (shipment) senderRole = 'logistics';
      }
    }

    if (!senderRole) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const message = new OrderMessage({
      order_id: orderId,
      sender_id: user._id,
      sender_name: user.name || 'User',
      sender_role: senderRole,
      text: text.trim(),
      timestamp: new Date(),
    });

    await message.save();

    return res.json({ success: true, data: { message } });
  } catch (err) {
    console.error('[orderMessages] sendOrderMessage error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

// ── GET ALL ORDER THREADS FOR CURRENT USER ─────────────────────────
const getMyOrderThreads = async (req, res) => {
  try {
    const user = req.user;
    const userId = user._id.toString();

    // Find orders where user is a party
    let orderQuery;
    if (user.role === 'admin') {
      // Admin sees all
      orderQuery = {};
    } else if (user.role === 'logistics') {
      const firm = await LogisticsCompany.findOne({ user_id: user._id }).select('_id').lean();
      if (!firm) return res.json({ success: true, data: { threads: [] } });
      const shipments = await Shipment.find({ logistics_id: firm._id }).select('order_id').lean();
      const orderIds = shipments.map(s => s.order_id).filter(Boolean);
      orderQuery = { _id: { $in: orderIds } };
    } else {
      // Check as vendor
      const vendor = await Vendor.findOne({ user_id: user._id }).select('_id').lean();
      const conditions = [{ customer_id: user._id }];
      if (vendor) conditions.push({ vendor_id: vendor._id });
      orderQuery = { $or: conditions };
    }

    const orders = await Order.find(orderQuery)
      .select('_id customer_id vendor_id order_status createdAt total_amount products')
      .populate('customer_id', 'name')
      .populate('vendor_id', 'store_name user_id')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const orderIds = orders.map(o => o._id);

    // Get all messages for these orders
    const messages = await OrderMessage.find({ order_id: { $in: orderIds } })
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();

    // Group by order
    const msgByOrder = {};
    for (const msg of messages) {
      const oid = msg.order_id.toString();
      if (!msgByOrder[oid]) msgByOrder[oid] = [];
      msgByOrder[oid].push(msg);
    }

    // Build threads — only orders that have messages
    const threads = orders
      .filter(o => msgByOrder[o._id.toString()]?.length > 0)
      .map(o => {
        const msgs = msgByOrder[o._id.toString()] || [];
        return {
          order: o,
          messages: msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
          lastMessage: msgs[0] || null,
          messageCount: msgs.length,
        };
      });

    return res.json({ success: true, data: { threads } });
  } catch (err) {
    console.error('[orderMessages] getMyOrderThreads error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch order threads' });
  }
};

module.exports = {
  getOrderMessages,
  sendOrderMessage,
  getMyOrderThreads,
};
