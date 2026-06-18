/**
 * controllers/chat.controller.js
 * Auradime — Chat History Retrieval Controller
 *
 * APIs to fetch historical messages when a user boots up their app
 * (Before Socket.io dynamically pushes real-time events over the active pipe).
 */

const Message = require('../models/Message.model');
const Product = require('../models/Product.model');
const mongoose = require('mongoose');

const PRODUCT_REFERENCE_SELECT = '_id name price images';

const roomHasSockets = async (io, room) => {
  if (!io || !room) return false;
  try {
    const sockets = await io.in(room.toString()).allSockets();
    return sockets.size > 0;
  } catch {
    return Boolean(io.sockets?.adapter?.rooms?.get(room.toString())?.size);
  }
};

const buildParticipantSnapshot = (user) => {
  if (!user?._id) return user;
  return {
    _id: user._id,
    name: user.name,
    avatar: user.avatar || null,
    role: user.role,
    branding: user.branding || {},
    is_online: user.is_online,
    last_seen: user.last_seen,
  };
};

const buildSenderNotificationData = (user) => {
  if (!user?._id) return null;
  return {
    _id: user._id,
    name: user.branding?.store_name || user.name || 'Auradime User',
    avatar: user.avatar || user.branding?.logo || null,
    store_name: user.branding?.store_name || null,
    branding: user.branding || {},
  };
};

const sanitizeProductReference = (product) => {
  if (!product || typeof product !== 'object') return product || null;

  const source = product.toObject ? product.toObject() : product;
  return {
    _id: source._id,
    name: source.name,
    price: source.price,
    images: Array.isArray(source.images) && source.images.length > 0
      ? [source.images[0]]
      : [],
  };
};

const sanitizeMessageProductReference = (message) => {
  if (!message?.product_reference) return message;
  return {
    ...message,
    product_reference: sanitizeProductReference(message.product_reference),
  };
};

const buildRealtimeMessagePayload = async ({ messageDoc, sender, receiverId, productReference, clientId }) => {
  const payload = messageDoc?.toObject ? messageDoc.toObject() : { ...messageDoc };
  payload.sender_id = buildParticipantSnapshot(sender);
  payload.receiver_id = receiverId?.toString?.() || receiverId;

  if (productReference) {
    payload.product_reference = await Product.findById(productReference)
      .select(PRODUCT_REFERENCE_SELECT)
      .lean()
      .then(sanitizeProductReference)
      .catch(() => productReference);
  }

  if (clientId) payload.client_id = clientId;
  return payload;
};

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

    const messages = await Message.find({
      $or: [
        { sender_id: userObjectId, receiver_id: partnerObjectId },
        { sender_id: partnerObjectId, receiver_id: userObjectId },
      ],
      deleted_for: { $ne: userObjectId }
    })
      .populate('sender_id', 'name avatar role branding store_name is_online last_seen')
      .populate('receiver_id', 'name avatar role branding store_name is_online last_seen')
      .populate('product_reference', PRODUCT_REFERENCE_SELECT)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      count: messages.length,
      data: {
        messages: messages.map(sanitizeMessageProductReference).reverse(),
        total,
        page,
        limit,
      }
    });
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

    const partnerIds = [];

    // Populate user identities securely across the aggregated items
    const populatedInbox = await Message.populate(inbox, {
      path: 'latestMessage.sender_id latestMessage.receiver_id',
      select: 'name avatar branding store_name role is_online last_seen',
      model: 'User', // Required inside Aggregation populates
    });

    populatedInbox.forEach((item) => {
      const msg = item.latestMessage;
      const senderId = msg?.sender_id?._id?.toString() || msg?.sender_id?.toString();
      const partner = senderId === req.user._id.toString() ? msg?.receiver_id : msg?.sender_id;
      const partnerId = partner?._id?.toString?.() || partner?.toString?.();
      if (partnerId) partnerIds.push(new mongoose.Types.ObjectId(partnerId));
    });

    const unreadRows = partnerIds.length
      ? await Message.aggregate([
          {
            $match: {
              receiver_id: new mongoose.Types.ObjectId(req.user._id),
              sender_id: { $in: partnerIds },
              read_status: false,
            },
          },
          {
            $group: {
              _id: '$sender_id',
              count: { $sum: 1 },
            },
          },
        ])
      : [];

    const unreadCountMap = new Map(unreadRows.map((row) => [row._id.toString(), row.count]));

    // Format output mapping neatly to hide the complex Object groupings
    const activeChats = populatedInbox
      .filter((item) => {
        const msg = item.latestMessage;
        // Skip messages where user documents have been deleted/unpopulated
        return msg && msg.sender_id && msg.receiver_id;
      })
      .map((item) => {
        const msg = item.latestMessage;
        // Determine the "other user" reliably safely
        const senderId = msg.sender_id?._id?.toString() || msg.sender_id?.toString();
        const partner = senderId === req.user._id.toString()
          ? msg.receiver_id
          : msg.sender_id;

        const unreadCount = unreadCountMap.get(partner._id.toString()) || 0;

        return {
          partner,
          partnerName: partner.branding?.store_name || partner.name || 'Merchant',
          partnerAvatar: partner.avatar || partner.branding?.logo,
          snippet: msg.text || (msg.product_reference ? '[Product Shared]' : ''),
          unread_count: unreadCount,
          read_status: unreadCount === 0,
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
    const { receiver_id, text, product_reference, metadata, image_url, client_id } = req.body;

    if (!receiver_id) {
      return res.status(400).json({ success: false, message: 'Receiver ID is required.' });
    }

    console.log(`[API] 📨 sendMessage: ${req.user._id} -> ${receiver_id}`);

    const io = req.app.get('io');
    const receiverRoom = receiver_id.toString();
    const receiverOnline = await roomHasSockets(io, receiverRoom);

    const message = await Message.create({
      sender_id: req.user._id,
      receiver_id,
      text,
      product_reference: product_reference || null,
      metadata: metadata || null,
      image_url: image_url || null,
      delivered_status: receiverOnline,
    });

    const messagePayload = await buildRealtimeMessagePayload({
      messageDoc: message,
      sender: req.user,
      receiverId: receiver_id,
      productReference: product_reference,
      clientId: client_id,
    });

    // Emit socket events for real-time updates across clients
    if (io) {
      const senderRoom = req.user._id.toString();
      
      const receiverCount = io.sockets.adapter.rooms.get(receiverRoom)?.size || 0;
      const senderCount = io.sockets.adapter.rooms.get(senderRoom)?.size || 0;
      
      console.log(`[API] 📤 Broadcasting via socket - receiver room: ${receiverRoom} (${receiverCount} connected), sender room: ${senderRoom} (${senderCount} connected)`);
      
      io.to(receiverRoom).emit('receive_message', messagePayload);
      io.to(senderRoom).emit('sent_message_echo', messagePayload);
      if (receiverOnline) {
        io.to(senderRoom).emit('messages_delivered', { partnerId: receiverRoom });
      }
      
      console.log(`✅ [API] Message broadcast: ${req.user._id} -> ${receiver_id}`);

    } else {
      console.warn(`⚠️ [API] IO instance not available, socket events not emitted`);
    }

    if (!receiverOnline) {
      // Only fall back to push when the recipient has no active socket session.
      (async () => {
        try {
          const { sendNotification } = require('../utils/notifier');
          const senderName = req.user.branding?.store_name || req.user.name || 'Someone';
          const senderAvatar = req.user.avatar || null;
          const senderData = buildSenderNotificationData(req.user);

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

          console.log(`[API] 🔔 Push fallback: sending notification to ${receiver_id} (message ${message._id})`);

          const notifResult = await sendNotification(req.app, receiver_id, {
            title: senderName,
            message: body,
            type: 'message',
            senderAvatar,
            metadata: {
              sender_id: req.user._id,
              senderData,
              link: `/chat?vendorId=${req.user._id}`,
            },
            emailLink: `${process.env.WEB_CLIENT_URL}/chat?vendorId=${req.user._id}`
          });

          console.log(`[API] 🔔 Push fallback result for ${receiver_id}:`, notifResult ? 'sent' : 'failed');
        } catch (err) {
          console.error(`❌ [Notifier] Dispatch failed:`, err?.message || err);
        }
      })();
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
      { read_status: true, delivered_status: true }
    );

    // Emit socket event so tabs sync up AND so the sender sees blue ticks update live
    const io = req.app.get('io');
    if (io) {
      // Notify the reader's own tabs (multi-tab sync)
      io.to(req.user._id.toString()).emit('messages_read', { partnerId: userId });
      // ✅ Notify the original sender so their blue ticks turn green instantly
      io.to(userId.toString()).emit('messages_read', { partnerId: req.user._id.toString() });
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
      .populate('product_reference', PRODUCT_REFERENCE_SELECT)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: messages.length,
      data: { messages: messages.map(sanitizeMessageProductReference) },
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
