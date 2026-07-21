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

  // ── Delivery retry queue ─────────────────────────────────────────────────────
  // Socket.IO delivery is at-most-once: a socket can disappear between the
  // server's online check and the actual emit. Keep a short durable retry queue
  // until the recipient explicitly confirms the message reached its client.
  const pendingRetries = new Map(); // messageId -> { timer, populatedMessage, receiverId, attempt }
  const RETRY_DELAYS_MS = [1_000, 3_000, 8_000, 20_000, 60_000];
  // TTL covers the retry window while MongoDB still provides reconnect recovery.
  const RETRY_REDIS_TTL_S = 150;
  const RETRY_REDIS_PREFIX = 'aura:msg_retry:';

  const redis = getRedis();

  const saveRetryToRedis = (messageId, receiverId, attempt) => {
    if (!redis || redis.status !== 'ready') return;
    redis.setex(
      `${RETRY_REDIS_PREFIX}${messageId}`,
      RETRY_REDIS_TTL_S,
      JSON.stringify({ messageId: messageId.toString(), receiverId: receiverId.toString(), attempt })
    ).catch(() => {});
  };

  const deleteRetryFromRedis = (messageId) => {
    if (!redis || redis.status !== 'ready') return;
    redis.del(`${RETRY_REDIS_PREFIX}${messageId}`).catch(() => {});
  };

  const cancelMessageRetry = (messageId) => {
    const msgIdStr = messageId?.toString();
    if (!msgIdStr) return;
    const pending = pendingRetries.get(msgIdStr);
    if (pending?.timer) clearTimeout(pending.timer);
    pendingRetries.delete(msgIdStr);
    deleteRetryFromRedis(msgIdStr);
  };

  const confirmMessageDelivery = async (messageId, receiverId) => {
    const deliveredAt = new Date();
    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        receiver_id: receiverId,
        delivered_status: { $ne: true },
      },
      { $set: { delivered_status: true, delivered_at: deliveredAt } },
      { returnDocument: 'after' }
    )
      .select('sender_id receiver_id')
      .lean();

    // Duplicate receipts are normal when the recipient is signed in on more
    // than one device. Only the first receipt changes state and notifies sender.
    if (!message) return false;

    cancelMessageRetry(messageId);
    io.to(message.sender_id.toString()).emit('message_delivery_ack', {
      messageId: messageId.toString(),
      partnerId: receiverId.toString(),
      at: deliveredAt.toISOString(),
    });
    return true;
  };

  const scheduleMessageRetry = (messageId, populatedMessage, receiverId, attempt = 0) => {
    const msgIdStr = messageId?.toString();
    if (!msgIdStr) return;
    if (attempt >= RETRY_DELAYS_MS.length) {
      pendingRetries.delete(msgIdStr);
      deleteRetryFromRedis(msgIdStr);
      return;
    }
    // Clear any existing timer for this message before scheduling a new one
    const prev = pendingRetries.get(msgIdStr);
    if (prev?.timer) clearTimeout(prev.timer);

    // Persist to Redis so this attempt survives a server restart
    saveRetryToRedis(msgIdStr, receiverId, attempt);

    const timer = setTimeout(async () => {
      if (!pendingRetries.has(msgIdStr)) return; // cancelled (receiver reconnected)
      const stillUndelivered = await Message.exists({
        _id: messageId,
        receiver_id: receiverId,
        delivered_status: false,
      });
      if (!stillUndelivered) {
        cancelMessageRetry(msgIdStr);
        return;
      }
      const receiverOnline = await roomHasSockets(io, receiverId);
      if (!receiverOnline) {
        // Receiver is offline — on-connect handler will deliver when they come back
        pendingRetries.delete(msgIdStr);
        deleteRetryFromRedis(msgIdStr);
        return;
      }
      // The client confirms receipt only after it has stored the payload.
      io.to(receiverId.toString()).emit('receive_message', populatedMessage);
      scheduleMessageRetry(messageId, populatedMessage, receiverId, attempt + 1);
    }, RETRY_DELAYS_MS[attempt]);

    pendingRetries.set(msgIdStr, { timer, populatedMessage, receiverId, attempt });
  };

  // On startup, recover any retries that were in-flight when the server last restarted.
  // We re-fetch the message from DB to get fresh populated data before re-scheduling.
  const recoverPendingRetries = async () => {
    if (!redis) return;
    // Wait for Redis to be ready (it may still be connecting at boot)
    await waitForRedisReady(redis, 8000);
    if (redis.status !== 'ready') return;
    try {
      let cursor = '0';
      let recovered = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${RETRY_REDIS_PREFIX}*`, 'COUNT', '100');
        cursor = nextCursor;
        for (const key of keys) {
          try {
            const raw = await redis.get(key);
            if (!raw) continue;
            const { messageId, receiverId, attempt } = JSON.parse(raw);
            const msg = await Message.findById(messageId)
              .populate('product_reference', PRODUCT_REFERENCE_SELECT)
              .populate('sender_id', 'name avatar role branding store_name is_online last_seen')
              .populate('receiver_id', 'name avatar role branding store_name is_online last_seen')
              .lean();
            if (!msg || msg.delivered_status) {
              // Already delivered (maybe on-connect handled it) — clean up stale key
              await redis.del(key).catch(() => {});
              continue;
            }
            if (msg?.product_reference) {
              msg.product_reference = sanitizeProductReference(msg.product_reference);
            }
            scheduleMessageRetry(messageId, msg, receiverId, Number(attempt) || 0);
            recovered++;
          } catch {}
        }
      } while (cursor !== '0');
      if (recovered > 0) console.log(`[Socket] Recovered ${recovered} pending message retries from Redis.`);
    } catch (err) {
      console.warn('[Socket] Could not recover pending retries from Redis:', err.message);
    }
  };

  // Run recovery after a short delay to let the process stabilise
  setTimeout(recoverPendingRetries, 5000);

  // Shared by the HTTP and legacy socket send paths. The request can return as
  // soon as MongoDB saves the message; receipt confirmation happens separately.
  io.deliverChatMessage = async (message) => {
    const receiverId = (message?.receiver_id?._id || message?.receiver_id)?.toString();
    const senderId = (message?.sender_id?._id || message?.sender_id)?.toString();
    const messageId = message?._id?.toString();
    if (!receiverId || !senderId || !messageId) return false;

    io.to(senderId).emit('sent_message_echo', message);
    io.to(receiverId).emit('receive_message', message);

    // Always start the retry queue regardless of whether the receiver appears online.
    // The initial emits above go to every socket in the room across all workers (via
    // the Redis adapter when available). If an emit is dropped — momentary disconnect,
    // Redis hiccup, or cross-worker race — the first retry fires after 1 s and
    // re-delivers. The retry loop checks roomHasSockets internally and stops when the
    // receiver has gone offline (on-connect delivery handles that path instead).
    scheduleMessageRetry(messageId, message, receiverId);
    return true;
  };
  // ─────────────────────────────────────────────────────────────────────────────

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
      .populate('product_reference', PRODUCT_REFERENCE_SELECT)
      .populate('sender_id', 'name avatar role branding store_name is_online last_seen')
      .populate('receiver_id', 'name avatar role branding store_name is_online last_seen')
      .lean()
      .then(async (messages) => {
        if (!messages.length) return;

        // Push undelivered messages to the reconnected device immediately —
        // the client handles deduplication so this is safe to emit unconditionally.
        const sanitized = messages.map((msg) => {
          if (msg?.product_reference) {
            return { ...msg, product_reference: sanitizeProductReference(msg.product_reference) };
          }
          return msg;
        });
        sanitized.forEach((message) => {
          // Cancel any in-flight retry before re-delivering — the on-connect emit
          // supersedes it. Scheduling a fresh retry below ensures we still get an
          // ACK if this emit is also dropped.
          cancelMessageRetry(message._id.toString());
          socket.emit('receive_message', message);
          scheduleMessageRetry(message._id, message, socket.userId);
        });

      })
      .catch((error) => console.error('Failed to mark delivered messages:', error));

    socket.on('send_message', async (data) => {
      try {
        const { receiver_id, text, product_reference } = data;
        const message = await Message.create({
          sender_id: socket.userId,
          receiver_id,
          text,
          product_reference: product_reference || null,
          delivered_status: false,
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('product_reference', PRODUCT_REFERENCE_SELECT)
          .populate('sender_id', 'name avatar role branding store_name is_online last_seen')
          .populate('receiver_id', 'name avatar role branding store_name is_online last_seen')
          .lean();

        if (populatedMessage?.product_reference) {
          populatedMessage.product_reference = sanitizeProductReference(populatedMessage.product_reference);
        }

        // ── Instant delivery (non-blocking) ────────────────────────────────────
        // Both emits fire immediately so neither the receiver nor the sender
        // has to wait for ACK resolution (which can take up to 5 s on slow
        // networks or when ACK is never called by older clients).
        // The client's dedupeMessages handles the harmless duplicate that the
        // per-socket ackable emit below will also send to in-process sockets.
        io.deliverChatMessage(populatedMessage).catch((error) => {
          console.error('Socket message delivery scheduling failed:', error);
        });

        // ── Delivery confirmation (background, may take up to 5 s) ────────────
        // Per-socket ackable emits are used solely to get a client ACK so we
        // can mark delivered_status = true in the DB and show the sender a
        // double-tick. They do NOT gate the message reaching the receiver.

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

    // Keep typing responsive while still limiting rapid input-event bursts.
    const typingThrottle = new Map(); // key: receiverId, value: last-forwarded timestamp
    // Server-side fallback timers: if a client crashes without sending typing_stop,
    // these fire after 4.5 s and clear the indicator on the receiver's side.
    const typingTimers = new Map(); // key: receiverId, value: timeout id

    socket.on('typing_start', ({ receiver_id }) => {
      if (!receiver_id) return;
      const receiverKey = receiver_id.toString();
      const now = Date.now();
      if (now - (typingThrottle.get(receiverKey) || 0) < 350) return;
      typingThrottle.set(receiverKey, now);
      io.to(receiverKey).emit('partner_typing', {
        userId: socket.userId,
        receiverId: receiverKey,
        at: new Date().toISOString(),
      });
      // Reset server-side fallback timer on each heartbeat so it only fires
      // when the client goes silent (crash, tab close, lost connection).
      clearTimeout(typingTimers.get(receiverKey));
      typingTimers.set(receiverKey, setTimeout(() => {
        typingTimers.delete(receiverKey);
        io.to(receiverKey).emit('partner_stopped_typing', {
          userId: socket.userId,
          receiverId: receiverKey,
        });
      }, 4500));
    });

    socket.on('typing_stop', ({ receiver_id }) => {
      if (receiver_id) {
        const receiverKey = receiver_id.toString();
        clearTimeout(typingTimers.get(receiverKey));
        typingTimers.delete(receiverKey);
        io.to(receiverKey).emit('partner_stopped_typing', {
          userId: socket.userId,
          receiverId: receiverKey,
          at: new Date().toISOString(),
        });
      }
    });

    // A message is delivered only when the authenticated recipient confirms it
    // reached their local chat store. This survives missed broadcasts and is
    // safe to emit repeatedly from multiple devices.
    socket.on('message_received', async ({ messageId }) => {
      if (!messageId) return;
      try {
        await confirmMessageDelivery(messageId, socket.userId);
      } catch (error) {
        console.error('Socket (message_received) Error:', error);
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
        // Emit to the reader's FULL room so all their other devices (phone + laptop)
        // also clear the unread badge for this conversation immediately.
        io.to(socket.userId.toString()).emit('messages_read', { partnerId: senderId });
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
      // Clear server-side typing fallback timers and notify all receivers that
      // this user stopped typing — handles the case where the socket closes
      // without the client sending typing_stop (crash, browser close, etc.).
      for (const [receiverKey, timer] of typingTimers.entries()) {
        clearTimeout(timer);
        io.to(receiverKey).emit('partner_stopped_typing', { userId: socket.userId, receiverId: receiverKey });
      }
      typingTimers.clear();

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
