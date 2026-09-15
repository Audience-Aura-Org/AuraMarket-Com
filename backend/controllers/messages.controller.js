/**
 * controllers/messages.controller.js
 * Auradime — Shipment Messages
 *
 * Handles messages for P2P shipment tracking
 */

const ShipmentMessage = require('../models/ShipmentMessage.model');
const Shipment = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');

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

    // Create message
    const message = new ShipmentMessage({
      shipment_id: shipmentId,
      sender_id: senderId,
      sender_name: senderName,
      sender_role: senderRole,
      text: text.trim(),
      timestamp: new Date(),
    });

    await message.save();

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

module.exports = {
  getShipmentMessages,
  sendShipmentMessage,
  getLogisticsMessages,
};
