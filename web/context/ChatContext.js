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

const ChatContext = createContext(null);

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
  if (message.product_reference) return 'Shared a product';
  if (message.image_url) return 'Sent a photo';
  return 'Sent a message';
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
  isSystemWide: false,
  conversationsById: {},
  conversationOrder: [],
  messagesByConversation: {},
  onlineUsersMap: {},
  typingIndicators: {},
};

function chatReducer(state, action) {
  switch (action.type) {
    case 'SET_CURRENT_USER':
      if (!action.userId) return { ...initialState };
      return { ...state, currentUserId: action.userId };

    case 'OPEN_CHAT': {
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
        isOpen: true,
        activePartnerId: partnerId,
        activeConversationId: partnerId,
        contextProduct: action.product || null,
        initialPartnerData: action.partnerData ? stripPayloadPresence(action.partnerData) : null,
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

      return {
        ...state,
        isOpen: true,
        activePartnerId: partnerId,
        activeConversationId: partnerId,
        initialPartnerData: action.partnerData ? state.initialPartnerData : null,
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
      return {
        ...state,
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
        status: 'sent',
        client_id: action.clientId || action.message?.client_id,
      };
      const messages = dedupeMessages(
        current.filter((m) => m._id !== action.tempId),
        [confirmed]
      );
      return {
        ...state,
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

    case 'PRESENCE_UPDATE': {
      const userId = action.userId?.toString();
      if (!userId) return state;
      const onlineUsersMap = { ...state.onlineUsersMap, [userId]: Boolean(action.isOnline) };
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
                  Boolean(action.isOnline)
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

    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const stateRef = useRef(state);
  const syncInFlightRef = useRef(false);
  const lastInboxSyncAtRef = useRef(0);
  const inboxRateLimitedUntilRef = useRef(0);
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    dispatch({ type: 'SET_CURRENT_USER', userId: user?._id?.toString?.() || null });
  }, [user?._id]);

  const syncInboxFromServer = useCallback(async () => {
    if (!user?._id || syncInFlightRef.current) return;
    const now = Date.now();
    if (now < inboxRateLimitedUntilRef.current) return;
    if (now - lastInboxSyncAtRef.current < 8000) return;
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
      if (!socketService.isConnected()) syncInboxFromServer();
    };

    const interval = setInterval(tick, 15000);
    const onFocus = () => syncInboxFromServer();
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncInboxFromServer();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?._id, syncInboxFromServer]);

  useEffect(() => {
    if (!user?._id) return;

    const onReceiveMessage = (message) => {
      const current = stateRef.current;
      const partnerId = getConversationIdFromMessage(message, current.currentUserId);
      const senderId = toId(message?.sender_id);
      const isActive = Boolean(current.isOpen && partnerId && current.activePartnerId === partnerId);

      dispatch({ type: 'RECEIVE_MESSAGE', message, partnerId, isActive });

      if (isActive && senderId && senderId !== current.currentUserId) {
        socketService.emit('mark_messages_read', { sender_id: senderId });
      }
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

    const onTyping = ({ userId }) => dispatch({ type: 'TYPING_UPDATE', userId, isTyping: true });
    const onStoppedTyping = ({ userId }) => dispatch({ type: 'TYPING_UPDATE', userId, isTyping: false });
    const onPresence = ({ userId, isOnline, online, lastSeen, last_seen }) =>
      dispatch({ type: 'PRESENCE_UPDATE', userId, isOnline: isOnline ?? online, lastSeen: lastSeen || last_seen });
    const onDeleted = (payload) => dispatch({ type: 'DELETE_MESSAGE', ...payload });

    const eventMap = {
      receive_message: onReceiveMessage,
      sent_message_echo: onSentEcho,
      messages_read: onMessagesRead,
      messages_delivered: onMessagesDelivered,
      partner_typing: onTyping,
      partner_stopped_typing: onStoppedTyping,
      user_presence: onPresence,
      online_status: onPresence,
      message_deleted: onDeleted,
    };

    Object.entries(eventMap).forEach(([event, handler]) => socketService.on(event, handler));
    return () => {
      Object.entries(eventMap).forEach(([event, handler]) => socketService.off(event, handler));
    };
  }, [user?._id]);

  const openChat = useCallback(
    (partnerId, product = null, partnerData = null, global = false) => {
      if (!user) {
        router.push('/login?from=chat');
        return;
      }
      dispatch({
        type: 'OPEN_CHAT',
        partnerId: partnerId ? partnerId.toString() : null,
        product,
        partnerData: partnerData ? stripPayloadPresence(partnerData) : null,
        global,
      });
    },
    [user, router]
  );

  const closeChat = useCallback(() => {
    dispatch({ type: 'CLOSE_CHAT' });
  }, []);

  const setActiveConversation = useCallback((partnerId, partnerData = null) => {
    dispatch({
      type: 'SET_ACTIVE_CONVERSATION',
      partnerId: partnerId ? partnerId.toString() : null,
      partnerData: partnerData ? stripPayloadPresence(partnerData) : null,
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
    dispatch({ type: 'RECEIVE_MESSAGE', message, partnerId, isActive: true });
  }, []);

  const markMessageFailed = useCallback((partnerId, tempId) => {
    dispatch({ type: 'MARK_MESSAGE_FAILED', partnerId, tempId });
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
