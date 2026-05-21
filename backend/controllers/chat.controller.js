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
    const { userId } = req.params;
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 40);

    const userObjectId = new mongoose.Types.ObjectId(req.user._id);
    const partnerObjectId = new mongoose.Types.ObjectId(userId);

    const total = await Message.countDocuments({
      $or: [
        { sender_id: userObjectId, receiver_id: partnerObjectId },
        { sender_id: partnerObjectId, receiver_id: userObjectId },
      ],
      deleted_for: { $ne: userObjectId }
    });

    // For page > 1 we fetch older messages (skip from the end)
    const skip = Math.max(0, total - page * limit);
    const take = total - (page - 1) * limit < limit ? total - (page - 1) * limit : limit;

    const messages = await Message.find({
      $or: [
        { sender_id: userObjectId, receiver_id: partnerObjectId },
        { sender_id: partnerObjectId, receiver_id: userObjectId },
      ],
      deleted_for: { $ne: userObjectId }
    })
      .populate('product_reference', 'name price images')
      .sort('createdAt')
      .skip(skip)
      .limit(take);

    res.status(200).json({ success: true, count: messages.length, data: { messages, total, page, limit } });
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
          deleted_for: { $ne: new mongoose.Types.ObjectId(req.user._id) }
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
      select: 'name avatar branding store_name role is_online last_seen',
      model: 'User', // Required inside Aggregation populates
    });

    // Format output mapping neatly to hide the complex Object groupings
    const activeChats = await Promise.all(populatedInbox
      .filter((item) => {
        const msg = item.latestMessage;
        // Skip messages where user documents have been deleted/unpopulated
        return msg && msg.sender_id && msg.receiver_id;
      })
      .map(async (item) => {
        const msg = item.latestMessage;
        // Determine the "other user" reliably safely
        const senderId = msg.sender_id?._id?.toString() || msg.sender_id?.toString();
        const partner = senderId === req.user._id.toString()
          ? msg.receiver_id
          : msg.sender_id;

        // Calculate unread count for this conversation
        const unreadCount = await Message.countDocuments({
          sender_id: partner._id,
          receiver_id: req.user._id,
          read_status: false
        });

        return {
          partner,
          partnerName: partner.branding?.store_name || partner.name || 'Merchant',
          partnerAvatar: partner.avatar || partner.branding?.logo,
          snippet: msg.text || (msg.product_reference ? '[Product Shared]' : ''),
          unread_count: unreadCount,
          read_status: msg.read_status,
          date: msg.createdAt,
        };
      }));

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
    const { receiver_id, text, product_reference, metadata, image_url, client_id } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ success: false, message: 'Receiver ID is required.' });
    }

    console.log(`[API] 📨 sendMessage: ${req.user._id} -> ${receiver_id}`);

    const message = await Message.create({
      sender_id: req.user._id,
      receiver_id,
      text,
      product_reference: product_reference || null,
      metadata: metadata || null,
      image_url: image_url || null,
    });

    // Populate for immediate UI consumption if needed
    const populated = await Message.findById(message._id)
      .populate('product_reference', 'name price images')
      .populate('sender_id', 'name avatar role branding is_online last_seen')
      .populate('receiver_id', 'name avatar role branding is_online last_seen');

    const messagePayload = populated.toObject ? populated.toObject() : populated;
    if (client_id) messagePayload.client_id = client_id;

    // Emit socket events for real-time updates across clients
    const io = req.app.get('io');
    if (io) {
      const receiverRoom = receiver_id.toString();
      const senderRoom = req.user._id.toString();
      
      const receiverCount = io.sockets.adapter.rooms.get(receiverRoom)?.size || 0;
      const senderCount = io.sockets.adapter.rooms.get(senderRoom)?.size || 0;
      
      console.log(`[API] 📤 Broadcasting via socket - receiver room: ${receiverRoom} (${receiverCount} connected), sender room: ${senderRoom} (${senderCount} connected)`);
      
      io.to(receiverRoom).emit('receive_message', messagePayload);
      io.to(senderRoom).emit('sent_message_echo', messagePayload);
      
      console.log(`✅ [API] Message broadcast: ${req.user._id} -> ${receiver_id}`);

      // 🚀 PWA Push & In-App Signal for Chat
      (async () => {
        try {
          const { sendNotification } = require('../utils/notifier');
          const senderName = req.user.branding?.store_name || req.user.name || 'Someone';
          const senderAvatar = req.user.avatar || null;

          // Smart body: show message text truncated, or product context
          let body;
          if (text && text.trim()) {
            body = text.length > 80 ? text.slice(0, 77) + '...' : text;
          } else if (product_reference) {
            body = '📦 Shared a product with you';
          } else if (image_url) {
            body = '📷 Sent you a photo';
          } else {
            body = 'Sent you a message';
          }

          await sendNotification(req.app, receiver_id, {
            title: senderName,              // Just the name — clean & direct
            message: body,
            type: 'message',
            senderAvatar,
            metadata: { sender_id: req.user._id, link: `/messages?vendorId=${req.user._id}` },
            emailLink: `${process.env.WEB_CLIENT_URL}/messages?vendorId=${req.user._id}`
          });
        } catch (err) {
          console.error(`❌ [Notifier] Dispatch failed:`, err.message);
        }
      })();
    } else {
      console.warn(`⚠️ [API] IO instance not available, socket events not emitted`);
    }

    res.status(201).json({ success: true, data: { message: messagePayload } });
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

    // Emit socket event so tabs sync up AND so the sender sees blue ticks update live
    const io = req.app.get('io');
    if (io) {
      // Notify the reader's own tabs (multi-tab sync)
      io.to(req.user._id.toString()).emit('messages_read', { sender_id: userId });
      // ✅ Notify the original sender so their blue ticks turn green instantly
      io.to(userId.toString()).emit('messages_read', { sender_id: userId });
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
    const { userA, userB } = req.query;
    let query = {};

    if (userA && userB) {
      query = {
        $or: [
          { sender_id: userA, receiver_id: userB },
          { sender_id: userB, receiver_id: userA }
        ]
      };
    }

    const messages = await Message.find(query)
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

// ─────────────────────────────────────────────
// @route   GET /api/chat/admin/inbox
// @desc    Admin: Get all distinct conversations system-wide
// @access  Private/Admin
// ─────────────────────────────────────────────
const getSystemWideInbox = async (req, res, next) => {
  try {
    const inbox = await Message.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $gt: ['$sender_id', '$receiver_id'] },
              { a: '$sender_id', b: '$receiver_id' },
              { a: '$receiver_id', b: '$sender_id' },
            ],
          },
          latestMessage: { $first: '$$ROOT' },
        },
      },
      {
        $sort: { 'latestMessage.createdAt': -1 },
      },
    ]);

    const populatedInbox = await Message.populate(inbox, {
      path: 'latestMessage.sender_id latestMessage.receiver_id',
      select: 'name avatar branding store_name role is_online last_seen',
      model: 'User',
    });

    const activeChats = populatedInbox
      .filter((item) => item.latestMessage && item.latestMessage.sender_id && item.latestMessage.receiver_id)
      .map((item) => {
        const msg = item.latestMessage;
        const senderId = msg.sender_id?._id?.toString() || msg.sender_id?.toString();
        
        // For admin, we show both but pick one as "primary" for the list UI
        return {
          _id: `${item._id.a}_${item._id.b}`,
          partner: msg.sender_id,
          partnerB: msg.receiver_id,
          snippet: msg.text || (msg.product_reference ? '[Product Shared]' : ''),
          date: msg.createdAt,
          isSystemWide: true
        };
      });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   DELETE /api/chat/message/:messageId
// @desc    Delete a message (for me or for everyone)
// @access  Private
// ─────────────────────────────────────────────
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const type = req.body?.type || req.query.type || 'me'; // 'me' or 'everyone', supports body or query param

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    const isSender = message.sender_id.toString() === req.user._id.toString();
    const isReceiver = message.receiver_id.toString() === req.user._id.toString();

    if (!isSender && !isReceiver) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this message.' });
    }

    if (type === 'everyone') {
      if (!isSender) {
        return res.status(403).json({ success: false, message: 'Only the sender can delete a message for everyone.' });
      }

      message.text = 'This message was deleted';
      message.product_reference = null;
      message.image_url = null;
      message.deleted_everyone = true;
      await message.save();

      const io = req.app.get('io');
      if (io) {
        io.to(message.sender_id.toString()).emit('message_deleted', { messageId, deletedFor: 'everyone', text: 'This message was deleted' });
        io.to(message.receiver_id.toString()).emit('message_deleted', { messageId, deletedFor: 'everyone', text: 'This message was deleted' });
      }
    } else {
      const userObjectId = new mongoose.Types.ObjectId(req.user._id);
      const isAlreadyDeleted = message.deleted_for.some(id => id.toString() === userObjectId.toString());
      if (!isAlreadyDeleted) {
        message.deleted_for.push(userObjectId);
        await message.save();
      }

      const io = req.app.get('io');
      if (io) {
        io.to(req.user._id.toString()).emit('message_deleted', { messageId, deletedFor: 'me' });
      }
    }

    res.status(200).json({ success: true, message: 'Message deleted successfully.' });
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
  getSystemWideInbox,
  deleteMessage,
};
