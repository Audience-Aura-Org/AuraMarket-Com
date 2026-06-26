/**
 * sockets/chat.socket.js
 * Auradime — Real-time WebSockets Manager (Socket.IO)
 */

const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message.model');
const User = require('../models/User.model');
const { createCorsOptions } = require('../middleware/security.middleware');
const { sendNotification } = require('../utils/notifier');
const { getRedis, getRedisDuplicate, redisFeatures } = require('../config/redis');
const { JWT_SECRET } = require('../config/env');

const PRODUCT_REFERENCE_SELECT = '_id name price images';

const socketTransports = (process.env.SOCKET_TRANSPORTS || 'websocket,polling')
  .split(',')
  .map((transport) => transport.trim())
  .filter(Boolean);

const waitForRedisReady = (redis, timeoutMs = 5000) => new Promise((resolve) => {
  if (!redis) return resolve(false);
  if (redis.status === 'ready') return resolve(true);

  const startedAt = Date.now();
  const timer = setInterval(() => {
    if (redis.status === 'ready') {
      clearInterval(timer);
      resolve(true);
      return;
    }
    if (Date.now() - startedAt >= timeoutMs) {
      clearInterval(timer);
      resolve(false);
    }
  }, 100);
  timer.unref?.();
});

const buildMessagePreview = (text, productReference) => {
  if (text && text.trim()) {
    return text.length > 80 ? `${text.slice(0, 77)}...` : text;
  }
  if (productReference) return 'Shared a product with you';
  return 'Sent you a message';
};

const roomHasSockets = async (io, room) => {
  if (!io || !room) return false;
  try {
    const sockets = await io.in(room.toString()).allSockets();
    return sockets.size > 0;
  } catch {
    return Boolean(io.sockets.adapter.rooms.get(room.toString())?.size);
  }
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

const buildSenderNotificationData = (sender, fallbackId) => {
  if (!sender && !fallbackId) return null;
  return {
    _id: sender?._id || fallbackId,
    name: sender?.branding?.store_name || sender?.store_name || sender?.name || 'Auradime User',
    avatar: sender?.avatar || sender?.branding?.logo || null,
    store_name: sender?.branding?.store_name || sender?.store_name || null,
    branding: sender?.branding || {},
  };
};

const mapChatSockets = (server) => {
  const io = socketIo(server, {
    cors: createCorsOptions(),
    allowEIO3: true,
    transports: socketTransports.length ? socketTransports : ['websocket', 'polling'],
  });

  const pubClient = redisFeatures.socket ? getRedis() : null;
  const subClient = redisFeatures.socket ? getRedisDuplicate() : null;
  if (pubClient && subClient) {
    Promise.all([
      import('@socket.io/redis-adapter'),
      waitForRedisReady(pubClient),
      waitForRedisReady(subClient),
    ])
      .then(([adapterModule]) => {
        if (pubClient.status === 'ready' && subClient.status === 'ready') {
          io.adapter(adapterModule.createAdapter(pubClient, subClient));
          console.log('✅ [Socket.IO] Redis adapter enabled for multi-worker rooms.');
        }
      })
      .catch((error) => {
        console.warn(`⚠️ [Socket.IO] Redis adapter unavailable: ${error.message}`);
      });
  }

  const userSockets = new Map();
  const disconnectTimers = new Map(); // Grace period before marking offline

  io.use(async (socket, next) => {
    try {
      const userId = socket.handshake.auth?.userId?.toString();
      const token = socket.handshake.auth?.token;
      if (!userId || !token) {
        return next(new Error('Authentication Error: Missing credentials'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded?.id?.toString() !== userId) {
        return next(new Error('Authentication Error: Session user mismatch'));
      }

      const user = await User.findById(decoded.id).select('_id is_active token_version').lean();
      if (!user || !user.is_active) {
        return next(new Error('Authentication Error: Invalid account'));
      }

      if (
        decoded.tokenVersion !== undefined &&
        Number(decoded.tokenVersion) !== Number(user.token_version || 0)
      ) {
        return next(new Error('Authentication Error: Stale session'));
      }

      socket.userId = userId;
      next();
    } catch (error) {
      next(new Error('Authentication Error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`⚡ Socket connected: ${socket.userId}`);

    // Cancel any pending offline timer for this user (reconnect scenario)
    if (disconnectTimers.has(socket.userId)) {
      clearTimeout(disconnectTimers.get(socket.userId));
      disconnectTimers.delete(socket.userId);
      console.log(`⚡ Cancelled offline timer for ${socket.userId} (reconnected)`);
    }

    // Track this socket connection and Mark Online
    const isFirstSocket = !userSockets.has(socket.userId) || userSockets.get(socket.userId).size === 0;
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);

    const userRoom = socket.userId.toString();
    socket.join(userRoom);

    if (isFirstSocket) {
      // Mark as online in DB after joining the user's room so presence checks see this socket.
      const lastSeen = new Date();
      User.findByIdAndUpdate(socket.userId, { is_online: true, last_seen: lastSeen }).catch(e => console.error(e));
      io.emit('user_presence', { userId: socket.userId, isOnline: true, lastSeen: lastSeen.toISOString() });
    }

    Message.find({ receiver_id: socket.userId, delivered_status: false })
      .select('sender_id')
      .lean()
      .then(async (messages) => {
        if (!messages.length) return;
        await Message.updateMany(
          { receiver_id: socket.userId, delivered_status: false },
          { delivered_status: true }
        );
        const senderIds = [...new Set(messages.map((msg) => msg.sender_id?.toString()).filter(Boolean))];
        senderIds.forEach((senderId) => {
          io.to(senderId).emit('messages_delivered', { partnerId: socket.userId.toString() });
        });
      })
      .catch((error) => console.error('Failed to mark delivered messages:', error));

    socket.on('send_message', async (data) => {
      try {
        const { receiver_id, text, product_reference } = data;
        const receiverOnline = await roomHasSockets(io, receiver_id.toString());
        const message = await Message.create({
          sender_id: socket.userId,
          receiver_id,
          text,
          product_reference: product_reference || null,
          delivered_status: receiverOnline,
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('product_reference', PRODUCT_REFERENCE_SELECT)
          .populate('sender_id', 'name avatar role branding store_name is_online last_seen')
          .populate('receiver_id', 'name avatar role branding store_name is_online last_seen')
          .lean();

        if (populatedMessage?.product_reference) {
          populatedMessage.product_reference = sanitizeProductReference(populatedMessage.product_reference);
        }

        // Attempt per-socket delivery with ACKs where possible
        const receiverSet = userSockets.get(String(receiver_id)) || new Set();
        let anyAck = false;

        if (receiverSet.size > 0) {
          // Emit to each socket individually and wait for client ack (with timeout)
          const emitPromises = Array.from(receiverSet).map(async (sockId) => {
            try {
              // Use socket.io v4 timeout ack helper
              const res = await io.to(sockId).timeout(5000).emit('receive_message', populatedMessage);
              // If client calls ack, consider it delivered
              anyAck = true;
              return { sockId, ok: true, res };
            } catch (err) {
              // timeout or other error
              return { sockId, ok: false, err };
            }
          });

          const results = await Promise.all(emitPromises);
          // If any socket acked, mark delivered
          anyAck = results.some(r => r && r.ok === true);
        } else {
          // No active sockets in this process; still attempt room emit for cross-worker delivery
          try {
            io.to(receiver_id.toString()).emit('receive_message', populatedMessage);
          } catch (e) {
            // ignore
          }
        }

        // Echo back to sender
        io.to(socket.userId.toString()).emit('sent_message_echo', populatedMessage);

        if (anyAck) {
          // Update DB message as delivered (acknowledged by a client)
          Message.findByIdAndUpdate(populatedMessage._id, { delivered_status: true, delivered_at: new Date() }).catch(() => {});
          io.to(socket.userId.toString()).emit('message_delivery_ack', { messageId: populatedMessage._id, partnerId: receiver_id.toString(), at: new Date().toISOString() });
        } else if (receiverOnline) {
          // Receiver was online (room present) but no per-socket ack; still notify sender of delivered status
          io.to(socket.userId.toString()).emit('messages_delivered', { partnerId: receiver_id.toString() });
        }

        setImmediate(() => {
          const sender = populatedMessage.sender_id;
          const senderName = sender?.branding?.store_name || sender?.store_name || sender?.name || 'Auradime User';
          const senderAvatar = sender?.avatar || sender?.branding?.logo || null;
          const senderData = buildSenderNotificationData(sender, socket.userId);

          sendNotification({ get: (key) => (key === 'io' ? io : null) }, receiver_id, {
            title: senderName,
            message: buildMessagePreview(text, product_reference),
            type: 'message',
            senderAvatar,
            metadata: {
              sender_id: socket.userId,
              senderData,
              message_id: populatedMessage._id,
              link: `/chat?vendorId=${socket.userId}`,
            },
          }).catch((notifyError) => {
            console.error('Socket (message notification) Error:', notifyError.message);
          });
        });
      } catch (error) {
        console.error('Socket (send_message) Error:', error);
      }
    });

    socket.on('typing_start', ({ receiver_id }) => {
      if (receiver_id) {
        io.to(receiver_id.toString()).emit('partner_typing', {
          userId: socket.userId,
          receiverId: receiver_id.toString(),
          at: new Date().toISOString(),
        });
      }
    });

    socket.on('typing_stop', ({ receiver_id }) => {
      if (receiver_id) {
        io.to(receiver_id.toString()).emit('partner_stopped_typing', {
          userId: socket.userId,
          receiverId: receiver_id.toString(),
          at: new Date().toISOString(),
        });
      }
    });

    socket.on('mark_messages_read', async ({ sender_id }) => {
      try {
        const senderId = sender_id?.toString();
        if (!senderId) return;

        await Message.updateMany(
          { sender_id: senderId, receiver_id: socket.userId, read_status: false },
          { read_status: true, delivered_status: true }
        );

        io.to(senderId).emit('messages_read', { partnerId: socket.userId.toString() });
        socket.emit('messages_read', { partnerId: senderId });
      } catch (error) {
        console.error('Socket (mark_messages_read) Error:', error);
      }
    });

    // Allow client to query if a specific user is currently online
    socket.on('check_online_status', async (data, callback) => {
      const targetId = (data?.userId || '').toString();
      if (!targetId) return;
      const isOnline = await roomHasSockets(io, targetId);
      const user = await User.findById(targetId).select('last_seen is_online').lean().catch(() => null);
      const lastSeen = user?.last_seen || null;
      const response = {
        userId: targetId,
        isOnline,
        lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null,
      };
      // Support both callback and emit patterns
      if (typeof callback === 'function') {
        callback(response);
      } else {
        socket.emit('user_presence', response);
      }
    });

    socket.on('disconnect', () => {
      const userSet = userSockets.get(socket.userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          // Grace period: wait 3 seconds before marking offline
          // This prevents false offline flickers during page refresh / reconnect
          const timer = setTimeout(async () => {
            disconnectTimers.delete(socket.userId);
            // Re-check: user might have reconnected during grace period
            const currentSet = userSockets.get(socket.userId);
            if (currentSet && currentSet.size > 0) return;

            const stillOnline = await roomHasSockets(io, socket.userId);
            if (stillOnline) return;

            userSockets.delete(socket.userId);
            // Mark as offline in DB only after checking the shared Socket.IO room.
            const lastSeen = new Date();
            await User.findByIdAndUpdate(socket.userId, { is_online: false, last_seen: lastSeen }).catch(e => console.error(e));
            io.emit('user_presence', { userId: socket.userId, isOnline: false, lastSeen: lastSeen.toISOString() });
            console.log(`🔌 User marked offline: ${socket.userId}`);
          }, 3000);
          disconnectTimers.set(socket.userId, timer);
        }
      }
      console.log(`🔌 Socket disconnected: ${socket.userId}`);
    });
  });

  return io;
};

module.exports = mapChatSockets;
