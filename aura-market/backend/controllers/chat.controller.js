/**
 * controllers/chat.controller.js
 * Aura Market — Chat History Retrieval Controller
 *
 * APIs to fetch historical messages when a user boots up their app
 * (Before Socket.io dynamically pushes real-time events over the active pipe).
 */

const Message = require('../models/Message.model');
const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// @route   GET /api/chat/:userId
// @desc    Get conversation between current user and a target userId
// @access  Private
// ─────────────────────────────────────────────
const getConversation = async (req, res, next) => {
  try {
    const { userId } = req.params; // The other person

    const messages = await Message.find({
      $or: [
        { sender_id: req.user._id, receiver_id: userId },
        { sender_id: userId, receiver_id: req.user._id },
      ],
    })
      .populate('product_reference', 'name price images') // Only pull card essentials
      .sort('createdAt'); // Oldest to newest for chat UI flow

    res.status(200).json({ success: true, count: messages.length, data: { messages } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/chat
// @desc    Get a list of distinct active conversations for the Inbox
// @access  Private
// ─────────────────────────────────────────────
const getUserInbox = async (req, res, next) => {
  try {
    // We utilize an Aggregation pipeline to group the most recent message per conversation
    const inbox = await Message.aggregate([
      {
        $match: {
          $or: [{ sender_id: req.user._id }, { receiver_id: req.user._id }],
        },
      },
      {
        $sort: { createdAt: -1 }, // Sort globally descending
      },
      {
        $group: {
          _id: {
            // Unify the conversation key securely regardless of who sent the latest text
            $cond: [
              { $gt: ['$sender_id', '$receiver_id'] },
              { a: '$sender_id', b: '$receiver_id' },
              { a: '$receiver_id', b: '$sender_id' },
            ],
          },
          latestMessage: { $first: '$$ROOT' }, // Grab the most recent doc from the group
        },
      },
      {
        $sort: { 'latestMessage.createdAt': -1 }, // Sort final conversation blocks
      },
    ]);

    // Populate user identities securely across the aggregated items
    const populatedInbox = await Message.populate(inbox, {
      path: 'latestMessage.sender_id latestMessage.receiver_id',
      select: 'name avatar role branding',
      model: 'User', // Required inside Aggregation populates
    });

    // Format output mapping neatly to hide the complex Object groupings
    const activeChats = populatedInbox.map((item) => {
      const msg = item.latestMessage;
      // Determine the "other user" reliably safely
      const partner = msg.sender_id._id.toString() === req.user._id.toString()
        ? msg.receiver_id
        : msg.sender_id;

      return {
        partner,
        snippet: msg.text || (msg.product_reference ? '[Product Shared]' : ''),
        read_status: msg.read_status,
        date: msg.createdAt,
      };
    });

    res.status(200).json({ success: true, count: activeChats.length, data: { activeChats } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/chat
// @desc    Send a new message to a specific user
// @access  Private
// ─────────────────────────────────────────────
const sendMessage = async (req, res, next) => {
  try {
    const { receiver_id, text, product_reference } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ success: false, message: 'Receiver ID is required.' });
    }

    console.log(`[API] 📨 sendMessage: ${req.user._id} -> ${receiver_id}`);

    const message = await Message.create({
      sender_id: req.user._id,
      receiver_id,
      text,
      product_reference: product_reference || null
    });

    // Populate for immediate UI consumption if needed
    const populated = await Message.findById(message._id)
      .populate('product_reference', 'name price images')
      .populate('sender_id', 'name avatar role branding')
      .populate('receiver_id', 'name avatar role branding');

    // Emit socket events for real-time updates across clients
    const io = req.app.get('io');
    if (io) {
      const receiverRoom = receiver_id.toString();
      const senderRoom = req.user._id.toString();
      
      const receiverCount = io.sockets.adapter.rooms.get(receiverRoom)?.size || 0;
      const senderCount = io.sockets.adapter.rooms.get(senderRoom)?.size || 0;
      
      console.log(`[API] 📤 Broadcasting via socket - receiver room: ${receiverRoom} (${receiverCount} connected), sender room: ${senderRoom} (${senderCount} connected)`);
      
      io.to(receiverRoom).emit('receive_message', populated);
      io.to(senderRoom).emit('sent_message_echo', populated);
      
      console.log(`✅ [API] Message broadcast: ${req.user._id} -> ${receiver_id}`);
    } else {
      console.warn(`⚠️ [API] IO instance not available, socket events not emitted`);
    }

    res.status(201).json({ success: true, data: { message: populated } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/chat/read/:userId
// @desc    Mark all messages from userId to current user as read
// @access  Private
// ─────────────────────────────────────────────
const markAsRead = async (req, res, next) => {
  try {
    const { userId } = req.params;
    await Message.updateMany(
      { sender_id: userId, receiver_id: req.user._id, read_status: false },
      { read_status: true }
    );

    // Emit socket event so tabs sync up
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('messages_read', { sender_id: userId });
    }

    res.status(200).json({ success: true, message: 'Messages marked as read.' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/chat/admin/all
// @desc    Admin: get all chat messages (latest first)
// @access  Private/Admin
// ─────────────────────────────────────────────
const getAllMessagesAdmin = async (req, res, next) => {
  try {
    const messages = await Message.find({})
      .populate('sender_id', 'name avatar role email branding')
      .populate('receiver_id', 'name avatar role email branding')
      .populate('product_reference', 'name price images')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: messages.length,
      data: { messages },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversation,
  getUserInbox,
  sendMessage,
  markAsRead,
  getAllMessagesAdmin,
};
