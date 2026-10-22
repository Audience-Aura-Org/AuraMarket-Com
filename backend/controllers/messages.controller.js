/**
 * controllers/messages.controller.js
 * Auradime — Shipment Messages
 *
 * Handles messages for P2P shipment tracking
 */

const ShipmentMessage = require('../models/ShipmentMessage.model');
const Shipment = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const { sendNotification } = require('../utils/notifier');

// ── GET MESSAGES FOR SHIPMENT ────────────────────────────────────────
const getShipmentMessages = async (req, res) => {
  try {
    const { shipmentId } = req.params;

    // Verify shipment exists
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    // Fetch messages
    const messages = await ShipmentMessage.find({ shipment_id: shipmentId })
      .sort({ timestamp: 1 })
      .lean();

    return res.json({ success: true, data: { messages } });
  } catch (err) {
    console.error('[messages] getShipmentMessages error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

// ── SEND MESSAGE TO SHIPMENT ────────────────────────────────────────
const sendShipmentMessage = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { text } = req.body;
    const user = req.user; // From auth middleware

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    // Verify shipment exists
    const shipment = await Shipment.findById(shipmentId);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    // Determine sender role and name
    let senderName = 'Anonymous';
    let senderRole = 'shipper';
    let senderId = null;

    if (user) {
      // Authenticated user
      senderId = user._id;
      senderName = user.name || 'User';

      if (user.role === 'logistics') {
        senderRole = 'logistics';
      } else if (user.role === 'admin') {
        senderRole = 'admin';
      } else if (shipment.booked_by?.toString() === user._id.toString()) {
        senderRole = 'shipper';
      } else if (shipment.other_party?.user_id?.toString() === user._id.toString()) {
        senderRole = 'recipient';
      } else {
        senderRole = 'shipper'; // default
      }
    }

    // Create message (sender has automatically read it)
    const message = new ShipmentMessage({
      shipment_id: shipmentId,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: senderRole,
      text: text.trim(),
      read_by: senderId ? [senderId] : [],
      timestamp: new Date(),
    });

    await message.save();

    // ── Notify other parties ───────────────────────────────────────
    const recipientIds = new Set();
    if (shipment.booked_by) recipientIds.add(shipment.booked_by.toString());
    if (shipment.other_party?.user_id) recipientIds.add(shipment.other_party.user_id.toString());
    // Logistics company user
    if (shipment.logistics_id) {
      const firm = await LogisticsCompany.findById(shipment.logistics_id).select('user_id').lean();
      if (firm?.user_id) recipientIds.add(firm.user_id.toString());
    }
    // Remove sender
    if (senderId) recipientIds.delete(senderId.toString());

    const app = req.app;
    const trackLink = `/delivery/track?code=${shipment.tracking_code}`;
    for (const rid of recipientIds) {
      sendNotification(app, rid, {
        title: `Shipment ${shipment.tracking_code}`,
        message: `${senderName}: ${text.trim().substring(0, 120)}`,
        type: 'shipment_message',
        metadata: {
          shipment_id: shipmentId,
          tracking_code: shipment.tracking_code,
          sender_id: senderId,
          link: trackLink,
        },
        sendEmail: true,
      }).catch(err => console.error('[messages] notification error:', err.message));
    }

    return res.json({ success: true, data: { message } });
  } catch (err) {
    console.error('[messages] sendShipmentMessage error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

// ── GET MESSAGES FOR LOGISTICS (all their shipments, grouped by shipment) ────
const getLogisticsMessages = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'logistics') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Resolve logistics company from user_id
    const firm = await LogisticsCompany.findOne({ user_id: user._id }).select('_id').lean();
    if (!firm) {
      return res.status(404).json({ success: false, message: 'Logistics company not found' });
    }

    // Find all shipments for this logistics company that have messages
    const shipments = await Shipment.find({ logistics_id: firm._id })
      .select('_id tracking_code status type pickup_address delivery_address booked_by guest_booker other_party createdAt')
      .sort({ createdAt: -1 })
      .lean();
    const shipmentIds = shipments.map(s => s._id);

    // Get all messages for these shipments
    const messages = await ShipmentMessage.find({ shipment_id: { $in: shipmentIds } })
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    // Group messages by shipment_id
    const messagesByShipment = {};
    for (const msg of messages) {
      const sid = msg.shipment_id.toString();
      if (!messagesByShipment[sid]) messagesByShipment[sid] = [];
      messagesByShipment[sid].push(msg);
    }

    // Build threads — only include shipments that have messages
    const threads = shipments
      .filter(s => messagesByShipment[s._id.toString()]?.length > 0)
      .map(s => ({
        shipment: s,
        messages: (messagesByShipment[s._id.toString()] || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        lastMessage: messagesByShipment[s._id.toString()]?.[0] || null,
        unreadCount: 0,
      }));

    return res.json({ success: true, data: { threads, messages } });
  } catch (err) {
    console.error('[messages] getLogisticsMessages error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

// ── GET MY SHIPMENT THREADS (user's P2P deliveries) ──────────────────
const getMyShipmentThreads = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });

    const userId = user._id.toString();

    // Find shipments where user is booker, other party, or logistics
    let shipments;
    if (user.role === 'logistics') {
      const firm = await LogisticsCompany.findOne({ user_id: user._id }).select('_id').lean();
      if (!firm) return res.json({ success: true, data: { threads: [] } });
      shipments = await Shipment.find({ type: 'p2p', logistics_id: firm._id })
        .select('_id tracking_code status type pickup_address delivery_address booked_by guest_booker other_party price createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();
    } else {
      shipments = await Shipment.find({
        type: 'p2p',
        $or: [
          { booked_by: user._id },
          { 'other_party.user_id': user._id },
        ],
      })
        .select('_id tracking_code status type pickup_address delivery_address booked_by guest_booker other_party price createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();
    }

    const shipmentIds = shipments.map(s => s._id);

    // Get latest message per shipment
    const messages = await ShipmentMessage.find({ shipment_id: { $in: shipmentIds } })
      .sort({ timestamp: -1 })
      .limit(300)
      .lean();

    const msgByShipment = {};
    for (const msg of messages) {
      const sid = msg.shipment_id.toString();
      if (!msgByShipment[sid]) msgByShipment[sid] = [];
      msgByShipment[sid].push(msg);
    }

    // Build threads for ALL shipments (not just those with messages)
    const threads = shipments.map(s => {
      const msgs = msgByShipment[s._id.toString()] || [];
      const isActive = !['delivered', 'cancelled', 'failed'].includes(s.status);
      // Count unread: messages not sent by this user AND not in their read_by
      const unreadCount = msgs.filter(m =>
        m.sender_id?.toString() !== userId &&
        !(m.read_by || []).some(r => r.toString() === userId)
      ).length;
      return {
        shipment: s,
        lastMessage: msgs[0] || null,
        messageCount: msgs.length,
        unreadCount,
        isActive,
      };
    });

    return res.json({ success: true, data: { threads } });
  } catch (err) {
    console.error('[messages] getMyShipmentThreads error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch shipment threads' });
  }
};

// ── MARK SHIPMENT THREAD AS READ ──────────────────────────────────────
const markShipmentThreadRead = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    await ShipmentMessage.updateMany(
      { shipment_id: shipmentId, read_by: { $ne: userId } },
      { $addToSet: { read_by: userId } }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('[messages] markShipmentThreadRead error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
};

module.exports = {
  getShipmentMessages,
  sendShipmentMessage,
  getLogisticsMessages,
  getMyShipmentThreads,
  markShipmentThreadRead,
};
