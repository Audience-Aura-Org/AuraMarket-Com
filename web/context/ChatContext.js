'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import socketService from '@/services/socket';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';

const ChatContext = createContext(null);
const CHAT_CACHE_PREFIX = 'aura_chat_cache:';
const CHAT_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export const toId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return value._id?.toString?.() || value.id?.toString?.() || null;
};

const isRecord = (value) => value && typeof value === 'object';

const hasParticipantMetadata = (value) => {
  if (!isRecord(value)) return false;
  return Boolean(
    value.name ||
      value.username ||
      value.avatar ||
      value.profile_picture ||
      value.store_name ||
      value.branding?.store_name ||
      value.branding?.logo ||
      value.store?.logo ||
      value.verification ||
      value.is_verified !== undefined
  );
};

const withoutUndefined = (value) => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
};

export const stripPayloadPresence = (participant) => {
  if (!isRecord(participant)) return participant;
  const { is_online, online, ...rest } = participant;
  return rest;
};

export const mergeParticipantData = (existing, incoming, livePresence) => {
  const existingObj = isRecord(existing) ? existing : {};
  const incomingObj = isRecord(incoming) ? incoming : {};
  const id = toId(incoming) || toId(existing);
  const {
    is_online: incomingOnline,
    online: _incomingOnlineAlias,
    lastSeen: incomingLastSeenAlias,
    ...incomingWithoutPresence
  } = incomingObj;

  const merged = {
    ...existingObj,
    ...withoutUndefined(incomingWithoutPresence),
    ...(id ? { _id: id } : {}),
  };

  const live =
    typeof livePresence === 'boolean'
      ? livePresence
      : typeof existingObj.is_online === 'boolean'
        ? existingObj.is_online
        : typeof incomingOnline === 'boolean'
          ? incomingOnline
          : undefined;

  if (typeof live === 'boolean') merged.is_online = live;
  else delete merged.is_online;

  const lastSeen = incomingLastSeenAlias || incomingWithoutPresence.last_seen || existingObj.last_seen || existingObj.lastSeen;
  if (lastSeen) {
    merged.last_seen = lastSeen;
    merged.lastSeen = lastSeen;
  }

  return merged;
};

export const buildConversationPreview = (message) => {
  if (!message) return '';
  if (message.deleted_everyone) return 'This message was deleted';
  if (message.text) return message.text;
  if (message.product_reference) return 'Product';
  if (message.image_url) return 'Photo';
  return 'Message';
};

export const getMessageKey = (message) => {
  if (!message) return null;
  return message._id || message.client_id || message.clientId || null;
};

export const getConversationIdFromMessage = (message, currentUserId) => {
  const senderId = toId(message?.sender_id);
  const receiverId = toId(message?.receiver_id);
  if (!senderId || !receiverId || !currentUserId) return null;
  return senderId === currentUserId ? receiverId : senderId;
};

const sortByLatest = (ids, conversationsById) =>
  [...ids].sort((a, b) => {
    const da = new Date(conversationsById[a]?.date || 0).getTime();
    const db = new Date(conversationsById[b]?.date || 0).getTime();
    return db - da;
  });

const dedupeMessages = (existing = [], incoming = [], prepend = false) => {
  const byKey = new Map();
  const optimisticByClient = new Map();
  const optimisticBySignature = new Map();
  const ordered = prepend ? [...incoming, ...existing] : [...existing, ...incoming];

  for (let message of ordered) {
    if (!message) continue;
    const key = getMessageKey(message) || `anon-${message.createdAt}-${message.text || message.image_url || ''}`;
    const clientId = message.client_id || message.clientId;
    const signature = `${toId(message.sender_id)}|${message.text || ''}|${message.image_url || ''}`;

    if (clientId && optimisticByClient.has(clientId)) {
      const optimisticKey = optimisticByClient.get(clientId);
      const optimistic = byKey.get(optimisticKey);
      byKey.delete(optimisticKey);
      if (optimistic) {
        message = {
          ...message,
          sender_id: optimistic.sender_id ?? message.sender_id,
          receiver_id: optimistic.receiver_id ?? message.receiver_id,
        };
      }
    } else if (message.status === 'sending') {
      optimisticByClient.set(clientId, key);
      optimisticBySignature.set(signature, key);
    } else if (message._id && optimisticBySignature.has(signature)) {
      byKey.delete(optimisticBySignature.get(signature));
    }

    byKey.set(key, { ...(byKey.get(key) || {}), ...message });
  }

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );
};

const getChatCacheKey = (userId) => `${CHAT_CACHE_PREFIX}${userId}`;

const readChatCache = (userId) => {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getChatCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.state || Date.now() - Number(parsed.savedAt || 0) > CHAT_CACHE_TTL_MS) {
      window.localStorage.removeItem(getChatCacheKey(userId));
      return null;
    }
    return parsed.state;
  } catch {
    return null;
  }
};

const writeChatCache = (userId, state) => {
  if (!userId || typeof window === 'undefined') return;
  try {
    const hasChats = state.conversationOrder.length > 0 || Object.keys(state.messagesByConversation || {}).length > 0;
    if (!hasChats) return;
    window.localStorage.setItem(
      getChatCacheKey(userId),
      JSON.stringify({
        savedAt: Date.now(),
        state: {
          conversationsById: state.conversationsById,
          conversationOrder: state.conversationOrder,
          messagesByConversation: state.messagesByConversation,
        },
      })
    );
  } catch {
    // Storage can be full or unavailable; live chat still works without the offline snapshot.
  }
};

const normalizeConversation = (conversation, state) => {
  const currentUserId = state.currentUserId;
  const partnerId =
    toId(conversation.partner) ||
    toId(conversation.partner_id) ||
    toId(conversation.user) ||
    toId(conversation.user_id) ||
    getConversationIdFromMessage(conversation.last_message || conversation.message, currentUserId);

  if (!partnerId) return null;

  const existing = state.conversationsById[partnerId] || {};
  const livePresence = state.onlineUsersMap[partnerId];
  const partner = mergeParticipantData(existing.partner, conversation.partner || conversation.user || { _id: partnerId }, livePresence);

  const lastMessage = conversation.last_message || conversation.message || existing.last_message || null;
  const snippet = conversation.snippet || conversation.lastMessage || (lastMessage ? buildConversationPreview(lastMessage) : existing.snippet);
  const date = conversation.date || conversation.updatedAt || lastMessage?.createdAt || existing.date || new Date().toISOString();

  return {
    ...existing,
    ...conversation,
    _id: conversation._id || existing._id || partnerId,
    partner,
    snippet,
    last_message: lastMessage,
    date,
    unread_count: Number(conversation.unread_count ?? existing.unread_count ?? 0),
    read_status: conversation.read_status ?? existing.read_status ?? true,
  };
};

const initialState = {
  currentUserId: null,
  isOpen: false,
  activePartnerId: null,
  activeConversationId: null,
  contextProduct: null,
  initialPartnerData: null,
  notificationTitle: null,
  isSystemWide: false,
  conversationsById: {},
  conversationOrder: [],
  messagesByConversation: {},
  onlineUsersMap: {},
  typingIndicators: {},
};

function chatReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE_CACHE': {
      const cached = action.payload || {};
      const cachedConversations = cached.conversationsById || {};
      const cachedMessages = cached.messagesByConversation || {};
      const conversationsById = { ...cachedConversations, ...state.conversationsById };
      const messagesByConversation = {};
      const messagePartnerIds = new Set([
        ...Object.keys(cachedMessages),
        ...Object.keys(state.messagesByConversation),
      ]);

      messagePartnerIds.forEach((partnerId) => {
        messagesByConversation[partnerId] = dedupeMessages(
          cachedMessages[partnerId] || [],
          state.messagesByConversation[partnerId] || []
        );
      });

      const conversationOrder = sortByLatest(
        Array.from(new Set([...(cached.conversationOrder || []), ...state.conversationOrder])),
        conversationsById
      );

      return {
        ...state,
        conversationsById,
        conversationOrder,
        messagesByConversation,
      };
    }

    case 'SET_CURRENT_USER':
      if (!action.userId) return { ...initialState };
      if (state.currentUserId && state.currentUserId !== action.userId) {
        return { ...initialState, currentUserId: action.userId };
      }
      return { ...state, currentUserId: action.userId };

    case 'OPEN_CHAT': {
      if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
        console.log('[ChatContext] OPEN_CHAT reducer dispatched', {
          partnerId: action.partnerId,
          openOverlay: action.openOverlay,
          stack: new Error().stack,
        });
      }
      const partnerId = action.partnerId ? action.partnerId.toString() : null;
      let conversationsById = state.conversationsById;
      let conversationOrder = state.conversationOrder;

      if (partnerId && action.partnerData) {
        const existing = state.conversationsById[partnerId] || {};
        const partner = mergeParticipantData(existing.partner, action.partnerData, state.onlineUsersMap[partnerId]);
        conversationsById = {
          ...state.conversationsById,
          [partnerId]: {
            ...existing,
            _id: existing._id || partnerId,
            partner,
            date: existing.date || new Date().toISOString(),
            unread_count: 0,
            read_status: true,
          },
        };
        conversationOrder = state.conversationOrder.includes(partnerId)
          ? state.conversationOrder
          : [partnerId, ...state.conversationOrder];
      }

      return {
        ...state,
        isOpen: action.openOverlay !== false,
        activePartnerId: partnerId,
        activeConversationId: partnerId,
        contextProduct: action.product || null,
        initialPartnerData: action.partnerData ? stripPayloadPresence(action.partnerData) : null,
        notificationTitle: action.notificationTitle || null,
        isSystemWide: Boolean(action.global),
        conversationsById,
        conversationOrder,
      };
    }

    case 'CLOSE_CHAT':
      return {
        ...state,
        isOpen: false,
        activePartnerId: null,
        activeConversationId: null,
        contextProduct: null,
        initialPartnerData: null,
        notificationTitle: null,
        isSystemWide: false,
        typingIndicators: {},
      };

    case 'SET_ACTIVE_CONVERSATION': {
      const partnerId = action.partnerId ? action.partnerId.toString() : null;
      if (!partnerId) {
        if (!state.activePartnerId && !state.activeConversationId && !state.initialPartnerData) return state;
        return {
          ...state,
          activePartnerId: null,
          activeConversationId: null,
          initialPartnerData: null,
          typingIndicators: {},
        };
      }

      const existing = state.conversationsById[partnerId] || {};
      const partner = mergeParticipantData(existing.partner, action.partnerData || { _id: partnerId }, state.onlineUsersMap[partnerId]);
      const alreadyActive = state.isOpen && state.activePartnerId === partnerId && state.activeConversationId === partnerId;
      const hasNoNewPartnerData = !action.partnerData;
      const alreadyRead = Number(existing.unread_count || 0) === 0 && existing.read_status === true;

      if (alreadyActive && hasNoNewPartnerData && alreadyRead) return state;

      const seededPartner = action.partnerData
        ? stripPayloadPresence(action.partnerData)
        : (toId(state.initialPartnerData) === partnerId ? state.initialPartnerData : null);

      return {
        ...state,
        // Do NOT set isOpen: true here — only OPEN_CHAT (openChat()) opens the overlay.
        // Any background setActiveConversation() call (socket event, aura_chat_focus
        // firing after a close, etc.) must not reopen the overlay the user dismissed.
        isOpen: state.isOpen,
        activePartnerId: partnerId,
        activeConversationId: partnerId,
        initialPartnerData: seededPartner,
        notificationTitle: action.notificationTitle !== undefined ? action.notificationTitle : state.notificationTitle,
        conversationsById: {
          ...state.conversationsById,
          [partnerId]: {
            ...existing,
            _id: existing._id || partnerId,
            partner,
            unread_count: 0,
            read_status: true,
          },
        },
        conversationOrder: state.conversationOrder.includes(partnerId)
          ? state.conversationOrder
          : [partnerId, ...state.conversationOrder],
        typingIndicators: { ...state.typingIndicators, [partnerId]: false },
      };
    }

    case 'UPSERT_CONVERSATIONS': {
      const conversationsById = { ...state.conversationsById };
      const nextIds = new Set(state.conversationOrder);

      for (const conversation of action.conversations || []) {
        const normalized = normalizeConversation(conversation, { ...state, conversationsById });
        if (!normalized) continue;
        const partnerId = toId(normalized.partner);
        // If this conversation is currently open, the user has already seen the messages.
        // Don't let a stale server unread count (from a sync racing with markAsRead)
        // re-badge a thread the user is actively viewing.
        if (state.isOpen && state.activePartnerId === partnerId) {
          normalized.unread_count = 0;
          normalized.read_status = true;
        }
        conversationsById[partnerId] = normalized;
        nextIds.add(partnerId);
      }

      return {
        ...state,
        conversationsById,
        conversationOrder: sortByLatest(Array.from(nextIds), conversationsById),
      };
    }

    case 'UPSERT_MESSAGES': {
      const partnerId = action.partnerId?.toString();
      if (!partnerId) return state;
      const existing = state.messagesByConversation[partnerId] || [];
      const messages = dedupeMessages(existing, action.messages || [], Boolean(action.prepend));

      // Keep the inbox snippet / date in sync with the freshest known message.
      // Only do this when loading page 1 (not prepend/pagination of older history).
      let conversationsById = state.conversationsById;
      let conversationOrder = state.conversationOrder;
      if (!action.prepend && messages.length > 0) {
        const latestMsg = messages[messages.length - 1];
        const existingConv = state.conversationsById[partnerId];
        const existingDate = existingConv?.date ? new Date(existingConv.date).getTime() : 0;
        const latestDate = latestMsg?.createdAt ? new Date(latestMsg.createdAt).getTime() : 0;
        if (latestMsg && latestDate >= existingDate) {
          conversationsById = {
            ...state.conversationsById,
            [partnerId]: {
              ...(existingConv || { _id: partnerId, partner: { _id: partnerId } }),
              snippet: buildConversationPreview(latestMsg),
              last_message: latestMsg,
              date: latestMsg.createdAt,
            },
          };
          // Re-sort inbox so conversations with newly-arrived messages bubble to the top
          const ids = conversationOrder.includes(partnerId)
            ? conversationOrder
            : [partnerId, ...conversationOrder];
          conversationOrder = sortByLatest(ids, conversationsById);
        }
      }

      return {
        ...state,
        conversationsById,
        conversationOrder,
        messagesByConversation: {
          ...state.messagesByConversation,
          [partnerId]: messages,
        },
      };
    }

    case 'RECEIVE_MESSAGE': {
      const message = action.message;
      const partnerId = action.partnerId || getConversationIdFromMessage(message, state.currentUserId);
      if (!partnerId) return state;

      const senderId = toId(message.sender_id);
      const isSentByMe = senderId === state.currentUserId;
      const rawPartner = isSentByMe ? message.receiver_id : message.sender_id;
      const existing = state.conversationsById[partnerId] || {};
      const active = action.isActive ?? (state.isOpen && state.activePartnerId === partnerId);
      const shouldCountUnread = !isSentByMe && !active;
      const livePresence = state.onlineUsersMap[partnerId];
      const partner = mergeParticipantData(
        existing.partner,
        hasParticipantMetadata(rawPartner) ? rawPartner : { _id: partnerId },
        livePresence
      );
      const unread_count = shouldCountUnread ? Number(existing.unread_count || 0) + 1 : active ? 0 : Number(existing.unread_count || 0);
      const conversation = {
        ...existing,
        _id: existing._id || partnerId,
        partner,
        snippet: buildConversationPreview(message),
        last_message: message,
        date: message.createdAt || new Date().toISOString(),
        unread_count,
        read_status: isSentByMe || active,
      };
      const currentMessages = state.messagesByConversation[partnerId] || [];
      const messages = dedupeMessages(currentMessages, [message]);
      const conversationsById = { ...state.conversationsById, [partnerId]: conversation };

      return {
        ...state,
        conversationsById,
        conversationOrder: sortByLatest([partnerId, ...state.conversationOrder.filter((id) => id !== partnerId)], conversationsById),
        messagesByConversation: {
          ...state.messagesByConversation,
          [partnerId]: messages,
        },
        typingIndicators: { ...state.typingIndicators, [partnerId]: false },
      };
    }

    case 'RECONCILE_OPTIMISTIC': {
      const partnerId = action.partnerId?.toString();
      if (!partnerId) return state;
      const current = state.messagesByConversation[partnerId] || [];
      const optimistic = current.find((m) => m._id === action.tempId);
      const confirmed = {
        ...action.message,
        sender_id: optimistic?.sender_id || action.message?.sender_id || state.currentUserId,
        receiver_id: optimistic?.receiver_id || action.message?.receiver_id || partnerId,
        createdAt: optimistic?.createdAt || action.message?.createdAt || new Date().toISOString(),
        status: 'sent',
        client_id: action.clientId || action.message?.client_id,
        // Preserve the optimistic delivered_status so the tick doesn't flicker
        // single→double→single while waiting for the server's message_delivery_ack.
        delivered_status: action.message?.delivered_status || optimistic?.delivered_status || false,
      };
      const messages = dedupeMessages(
        current.filter((m) => m._id !== action.tempId),
        [confirmed]
      );
      const existing = state.conversationsById[partnerId] || {};
      const conversation = {
        ...existing,
        snippet: buildConversationPreview(confirmed),
        last_message: confirmed,
        date: confirmed.createdAt,
        read_status: true,
      };
      const conversationsById = { ...state.conversationsById, [partnerId]: conversation };

      return {
        ...state,
        conversationsById,
        conversationOrder: sortByLatest([partnerId, ...state.conversationOrder.filter((id) => id !== partnerId)], conversationsById),
        messagesByConversation: {
          ...state.messagesByConversation,
          [partnerId]: messages,
        },
      };
    }

    case 'MARK_MESSAGE_FAILED': {
      const partnerId = action.partnerId?.toString();
      if (!partnerId) return state;
      return {
        ...state,
        messagesByConversation: {
          ...state.messagesByConversation,
          [partnerId]: (state.messagesByConversation[partnerId] || []).map((m) =>
            m._id === action.tempId ? { ...m, status: 'failed' } : m
          ),
        },
      };
    }

    case 'MARK_MESSAGE_QUEUED': {
      const partnerId = action.partnerId?.toString();
      if (!partnerId) return state;
      return {
        ...state,
        messagesByConversation: {
          ...state.messagesByConversation,
          [partnerId]: (state.messagesByConversation[partnerId] || []).map((m) =>
            m._id === action.tempId ? { ...m, status: 'queued' } : m
          ),
        },
      };
    }

    case 'MARK_READ': {
      const partnerId = action.partnerId?.toString();
      if (!partnerId || !state.conversationsById[partnerId]) return state;
      return {
        ...state,
        conversationsById: {
          ...state.conversationsById,
          [partnerId]: {
            ...state.conversationsById[partnerId],
            unread_count: 0,
            read_status: true,
          },
        },
      };
    }

    case 'MESSAGES_READ': {
      const partnerId = action.partnerId?.toString();
      if (!partnerId) return state;
      return {
        ...state,
        conversationsById: state.conversationsById[partnerId]
          ? {
              ...state.conversationsById,
              [partnerId]: {
                ...state.conversationsById[partnerId],
                unread_count: 0,
                read_status: true,
              },
            }
          : state.conversationsById,
        messagesByConversation: {
          ...state.messagesByConversation,
          [partnerId]: (state.messagesByConversation[partnerId] || []).map((m) =>
            toId(m.sender_id) === state.currentUserId ? { ...m, read_status: true } : m
          ),
        },
      };
    }

    case 'MESSAGES_DELIVERED': {
      const partnerId = action.partnerId?.toString();
      if (!partnerId) return state;
      return {
        ...state,
        messagesByConversation: {
          ...state.messagesByConversation,
          [partnerId]: (state.messagesByConversation[partnerId] || []).map((m) =>
            toId(m.sender_id) === state.currentUserId ? { ...m, delivered_status: true } : m
          ),
        },
      };
    }

    case 'MESSAGE_DELIVERY_ACK': {
      const partnerId = action.partnerId?.toString();
      if (!partnerId || !action.messageId) return state;
      return {
        ...state,
        messagesByConversation: {
          ...state.messagesByConversation,
          [partnerId]: (state.messagesByConversation[partnerId] || []).map((m) => {
            if (!m) return m;
            const messageId = m._id?.toString?.() || m.client_id?.toString?.();
            if (messageId !== action.messageId?.toString()) return m;
            return {
              ...m,
              delivered_status: true,
              delivered_at: action.deliveredAt || action.at || m.delivered_at || m.deliveredAt || null,
            };
          }),
        },
      };
    }

    case 'PRESENCE_UPDATE': {
      const userId = action.userId?.toString();
      if (!userId) return state;
      const isOnline = action.isOnline === true || action.isOnline === 'true';
      const onlineUsersMap = { ...state.onlineUsersMap, [userId]: isOnline };
      const lastSeen = action.lastSeen || action.last_seen;
      const conversation = state.conversationsById[userId];
      return {
        ...state,
        onlineUsersMap,
        conversationsById: conversation
          ? {
              ...state.conversationsById,
              [userId]: {
                ...conversation,
                partner: mergeParticipantData(
                  conversation.partner,
                  { _id: userId, last_seen: lastSeen, lastSeen },
                  isOnline
                ),
              },
            }
          : state.conversationsById,
      };
    }

    case 'TYPING_UPDATE': {
      const userId = action.userId?.toString();
      if (!userId) return state;
      return {
        ...state,
        typingIndicators: {
          ...state.typingIndicators,
          [userId]: Boolean(action.isTyping),
        },
      };
    }

    case 'DELETE_MESSAGE': {
      const { messageId, deletedFor, text } = action;
      if (!messageId) return state;
      const messagesByConversation = {};
      for (const [partnerId, messages] of Object.entries(state.messagesByConversation)) {
        messagesByConversation[partnerId] =
          deletedFor === 'everyone'
            ? messages.map((m) =>
                m._id === messageId
                  ? {
                      ...m,
                      text: text || 'This message was deleted',
                      product_reference: null,
                      image_url: null,
                      deleted_everyone: true,
                    }
                  : m
              )
            : messages.filter((m) => m._id !== messageId);
      }
      return { ...state, messagesByConversation };
    }

    case 'CLEAR_STALE_ONLINE': {
      // After a socket reconnect, mark every previously-online user as offline until
      // check_online_status is re-confirmed. Prevents "always online" ghost indicators.
      const cleared = {};
      for (const uid of Object.keys(state.onlineUsersMap)) {
        if (state.onlineUsersMap[uid]) cleared[uid] = false;
      }
      if (Object.keys(cleared).length === 0) return state;
      return { ...state, onlineUsersMap: { ...state.onlineUsersMap, ...cleared } };
    }

    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const stateRef = useRef(state);
  const syncInFlightRef = useRef(false);
  const typingExpiryTimersRef = useRef({});
  const lastInboxSyncAtRef = useRef(0);
  const inboxRateLimitedUntilRef = useRef(0);
  const lastClosedAtRef = useRef(0);
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    // Reset rate-limit refs when the user changes so a new user doesn't inherit
    // a lockout or debounce window that belongs to the previous session.
    inboxRateLimitedUntilRef.current = 0;
    lastInboxSyncAtRef.current = 0;
    dispatch({ type: 'SET_CURRENT_USER', userId: user?._id?.toString?.() || null });
  }, [user?._id]);

  useEffect(() => {
    const userId = user?._id?.toString?.();
    if (!userId) return;
    const cached = readChatCache(userId);
    if (cached) {
      dispatch({ type: 'HYDRATE_CACHE', payload: cached });
    }
  }, [user?._id]);

  useEffect(() => {
    const userId = user?._id?.toString?.();
    if (!userId) return;
    const timer = setTimeout(() => writeChatCache(userId, state), 300);
    return () => clearTimeout(timer);
  }, [user?._id, state.conversationsById, state.conversationOrder, state.messagesByConversation]);

  const syncInboxFromServer = useCallback(async (options = {}) => {
    if (!user?._id || syncInFlightRef.current) return;
    const now = Date.now();
    const force = Boolean(options.force);
    if (!force && now < inboxRateLimitedUntilRef.current) return;
    if (!force && now - lastInboxSyncAtRef.current < 8000) return;
    lastInboxSyncAtRef.current = now;
    syncInFlightRef.current = true;
    try {
      const res = await api.get('/chat');
      if (res.data?.success) {
        dispatch({ type: 'UPSERT_CONVERSATIONS', conversations: res.data.data?.activeChats || [] });
      }
    } catch (error) {
      if (error?.response?.status === 429) {
        inboxRateLimitedUntilRef.current = Date.now() + 2 * 60 * 1000;
        toast('Chat inbox sync paused. Will retry in 2 minutes.', { icon: '⏳', duration: 4000 });
        console.warn('[ChatContext] Inbox sync paused after rate limit.');
      } else {
        console.error('[ChatContext] Inbox sync failed:', error);
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) return;

    syncInboxFromServer();

    let stopped = false;
    const tick = () => {
      if (stopped) return;
      // Always poll — not just when socket is down.
      // A second logged-in device won't receive sent_message_echo events from the first
      // device, so it relies on this poll to discover new outgoing messages in the inbox.
      // syncInboxFromServer's own 8-second debounce prevents hammering the API.
      syncInboxFromServer();
    };

    const interval = setInterval(tick, 15000);
    const onFocus = () => syncInboxFromServer();
    const onOnline = () => syncInboxFromServer({ force: true });
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncInboxFromServer();
    };
    // When socket reconnects after a drop:
    // 1. Clear stale online-status flags — users who went offline during the gap
    //    would otherwise remain shown as online.
    // 2. Re-fetch the inbox to surface any messages missed during downtime.
    const onSocketReconnect = () => {
      dispatch({ type: 'CLEAR_STALE_ONLINE' });
      syncInboxFromServer({ force: true });
    };

    // When a push arrives and the socket is down, SocketProvider dispatches this event.
    // MessagingHub handles it when open, but we also sync the inbox here so the badge
    // and conversation list update even when the chat panel is closed.
    const onPullConversation = () => syncInboxFromServer({ force: true });

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    window.addEventListener('aura:pull-conversation', onPullConversation);
    document.addEventListener('visibilitychange', onVisible);
    socketService.on('connect', onSocketReconnect);

    return () => {
      stopped = true;
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('aura:pull-conversation', onPullConversation);
      document.removeEventListener('visibilitychange', onVisible);
      socketService.off('connect', onSocketReconnect);
    };
  }, [user?._id, syncInboxFromServer]);

  useEffect(() => {
    if (!user?._id) return;

    const onReceiveMessage = (message, ack) => {
      const current = stateRef.current;
      const partnerId = getConversationIdFromMessage(message, current.currentUserId);
      const senderId = toId(message?.sender_id);
      const isActive = Boolean(current.isOpen && partnerId && current.activePartnerId === partnerId);

      dispatch({ type: 'RECEIVE_MESSAGE', message, partnerId, isActive });

      // This is the durable delivery receipt. A room being online is not enough
      // on mobile: the socket can close while an event is in flight.
      if (partnerId && message?._id) {
        socketService.emit('message_received', { messageId: message._id.toString() });
      }

      if (isActive && senderId && senderId !== current.currentUserId) {
        socketService.emit('mark_messages_read', { sender_id: senderId });
      }

      // Acknowledge receipt so the server marks the message as delivered in DB
      if (typeof ack === 'function') ack();
    };

    const onSentEcho = (message) => {
      const current = stateRef.current;
      const partnerId = getConversationIdFromMessage(message, current.currentUserId);
      dispatch({ type: 'RECEIVE_MESSAGE', message, partnerId, isActive: current.activePartnerId === partnerId });
    };

    const onMessagesRead = ({ sender_id, userId, partnerId }) => {
      dispatch({ type: 'MESSAGES_READ', partnerId: sender_id || userId || partnerId });
    };
    const onMessagesDelivered = ({ sender_id, userId, partnerId }) => {
      dispatch({ type: 'MESSAGES_DELIVERED', partnerId: sender_id || userId || partnerId });
    };
    const onMessageDeliveryAck = ({ messageId, partnerId, at }) => {
      dispatch({ type: 'MESSAGE_DELIVERY_ACK', partnerId, messageId, deliveredAt: at });
    };

    const clearTypingExpiry = (userId) => {
      const key = userId?.toString?.();
      if (!key || !typingExpiryTimersRef.current[key]) return;
      clearTimeout(typingExpiryTimersRef.current[key]);
      delete typingExpiryTimersRef.current[key];
    };
    const onTyping = ({ userId }) => {
      const key = userId?.toString?.();
      if (!key || key === stateRef.current.currentUserId) return;
      clearTypingExpiry(key);
      dispatch({ type: 'TYPING_UPDATE', userId: key, isTyping: true });
      // 5 s window: comfortably longer than the 800 ms sender heartbeat so the
      // indicator never flickers off between heartbeat arrivals.
      typingExpiryTimersRef.current[key] = setTimeout(() => {
        delete typingExpiryTimersRef.current[key];
        dispatch({ type: 'TYPING_UPDATE', userId: key, isTyping: false });
      }, 5000);
    };
    const onStoppedTyping = ({ userId }) => {
      const key = userId?.toString?.();
      if (!key) return;
      clearTypingExpiry(key);
      dispatch({ type: 'TYPING_UPDATE', userId: key, isTyping: false });
    };
    const onPresence = ({ userId, isOnline, online, lastSeen, last_seen }) =>
      dispatch({ type: 'PRESENCE_UPDATE', userId, isOnline: isOnline ?? online, lastSeen: lastSeen || last_seen });
    const onDeleted = (payload) => dispatch({ type: 'DELETE_MESSAGE', ...payload });

    // Batch of messages that arrived while this device was offline/disconnected.
    // The server pushes these on reconnect so the inbox is immediately up-to-date
    // without waiting for the next 15s poll.
    const onOfflineMessages = (messages) => {
      if (!Array.isArray(messages) || !messages.length) return;
      const current = stateRef.current;
      for (const message of messages) {
        const partnerId = getConversationIdFromMessage(message, current.currentUserId);
        if (!partnerId) continue;
        dispatch({ type: 'RECEIVE_MESSAGE', message, partnerId, isActive: false });
        if (message?._id) {
          socketService.emit('message_received', { messageId: message._id.toString() });
        }
      }
    };

    const eventMap = {
      receive_message: onReceiveMessage,
      sent_message_echo: onSentEcho,
      offline_messages: onOfflineMessages,
      messages_read: onMessagesRead,
      messages_delivered: onMessagesDelivered,
      message_delivery_ack: onMessageDeliveryAck,
      partner_typing: onTyping,
      partner_stopped_typing: onStoppedTyping,
      user_presence: onPresence,
      online_status: onPresence,
      message_deleted: onDeleted,
    };

    Object.entries(eventMap).forEach(([event, handler]) => socketService.on(event, handler));
    return () => {
      Object.entries(eventMap).forEach(([event, handler]) => socketService.off(event, handler));
      Object.values(typingExpiryTimersRef.current).forEach(clearTimeout);
      typingExpiryTimersRef.current = {};
    };
  }, [user?._id]);

  const openChat = useCallback(
    (partnerId, product = null, partnerData = null, global = false, notificationTitle = null, openOverlay = true) => {
      if (!user) {
        router.push('/login?from=chat');
        return;
      }
      // Suppress synthetic 300ms ghost clicks on mobile WebView right after user closed overlay
      if (openOverlay !== false && Date.now() - lastClosedAtRef.current < 450) {
        console.warn('[ChatContext] Suppressed ghost openChat call within 450ms of closeChat');
        return;
      }
      dispatch({
        type: 'OPEN_CHAT',
        partnerId: partnerId ? partnerId.toString() : null,
        product,
        partnerData: partnerData ? stripPayloadPresence(partnerData) : null,
        notificationTitle: notificationTitle || null,
        global,
        openOverlay,
      });
    },
    [user, router]
  );

  const closeChat = useCallback(() => {
    lastClosedAtRef.current = Date.now();
    dispatch({ type: 'CLOSE_CHAT' });
  }, []);

  const setActiveConversation = useCallback((partnerId, partnerData = null, notificationTitle = undefined) => {
    dispatch({
      type: 'SET_ACTIVE_CONVERSATION',
      partnerId: partnerId ? partnerId.toString() : null,
      partnerData: partnerData ? stripPayloadPresence(partnerData) : null,
      notificationTitle,
    });
  }, []);

  const upsertConversations = useCallback((conversations) => {
    dispatch({ type: 'UPSERT_CONVERSATIONS', conversations });
  }, []);

  const upsertMessages = useCallback((partnerId, messages, options = {}) => {
    dispatch({ type: 'UPSERT_MESSAGES', partnerId, messages, prepend: options.prepend });
  }, []);

  const receiveMessage = useCallback((message, options = {}) => {
    dispatch({
      type: 'RECEIVE_MESSAGE',
      message,
      partnerId: options.partnerId,
      isActive: options.isActive,
    });
  }, []);

  const reconcileOptimisticMessage = useCallback((partnerId, tempId, message, clientId) => {
    dispatch({ type: 'RECONCILE_OPTIMISTIC', partnerId, tempId, message, clientId });
  }, []);

  const markMessageFailed = useCallback((partnerId, tempId) => {
    dispatch({ type: 'MARK_MESSAGE_FAILED', partnerId, tempId });
  }, []);

  const markMessageQueued = useCallback((partnerId, tempId) => {
    dispatch({ type: 'MARK_MESSAGE_QUEUED', partnerId, tempId });
  }, []);

  const markConversationRead = useCallback((partnerId) => {
    dispatch({ type: 'MARK_READ', partnerId });
  }, []);

  const updatePresence = useCallback((userId, isOnline, lastSeen = null) => {
    dispatch({ type: 'PRESENCE_UPDATE', userId, isOnline, lastSeen });
  }, []);

  const deleteMessage = useCallback((payload) => {
    dispatch({ type: 'DELETE_MESSAGE', ...payload });
  }, []);

  const value = useMemo(() => {
    const activeConversationId = state.activeConversationId;
    const activeConversation = activeConversationId ? state.conversationsById[activeConversationId] : null;
    const activeMessages = activeConversationId ? state.messagesByConversation[activeConversationId] || [] : [];
    const conversations = state.conversationOrder
      .map((id) => state.conversationsById[id])
      .filter(Boolean);

    return {
      ...state,
      conversations,
      activeConversation,
      activeMessages,
      activePartnerId: state.activePartnerId,
      openChat,
      closeChat,
      setActiveConversation,
      upsertConversations,
      upsertMessages,
      receiveMessage,
      reconcileOptimisticMessage,
      markMessageFailed,
      markMessageQueued,
      markConversationRead,
      updatePresence,
      deleteMessage,
      syncInboxFromServer,
    };
  }, [
    state,
    openChat,
    closeChat,
    setActiveConversation,
    upsertConversations,
    upsertMessages,
    receiveMessage,
    reconcileOptimisticMessage,
    markMessageFailed,
    markMessageQueued,
    markConversationRead,
    updatePresence,
    deleteMessage,
    syncInboxFromServer,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};
