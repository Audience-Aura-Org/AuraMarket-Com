"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  Send, X, ArrowLeft, Package,
  MessageCircle, Check, CheckCheck, Loader2, Clock, WifiOff,
  Search, Trash2, Image as ImageIcon, AlertCircle, MoreVertical
} from 'lucide-react';
import api from '@/services/api';
import { uploadService } from '@/services/upload';
import { useAuthStore } from '@/hooks/useAuth';
import { toId, useChat } from '@/context/ChatContext';
import socketService from '@/services/socket';
import { QUICK_REPLIES, fmtDate, sameDay, sameGroup, bubbleRounding } from './chat/ChatUtils';
import { toast } from 'react-hot-toast';

const StatusViewer = dynamic(() => import('@/components/status/StatusViewer'), { ssr: false });

const CHAT_FULL_HEIGHT_KEY = 'aura_chat_full_viewport_height';

// ─── Offline Send Queue ───────────────────────────────────────────────────────
// Messages that failed due to a network error are queued here (localStorage) and
// retried automatically the moment the connection is restored — identical to
// how WhatsApp queues messages while offline.

const SEND_QUEUE_KEY = 'aura_send_queue';
const MAX_QUEUE_RETRIES = 6;
// Exponential backoff delays (ms) indexed by retry count.
// retry 0 = immediate, 1 = 3s, 2 = 10s, 3 = 30s, 4 = 60s, 5+ = 120s
const QUEUE_RETRY_DELAYS = [0, 3000, 10000, 30000, 60000, 120000];

const loadQueue = () => {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(SEND_QUEUE_KEY) || '[]'); } catch { return []; }
};
const saveQueue = (q) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SEND_QUEUE_KEY, JSON.stringify(q));
};
const enqueueMsg = (item) => {
  saveQueue([...loadQueue(), { ...item, retries: 0, lastAttemptAt: 0, queuedAt: Date.now() }]);
  // Register a Background Sync tag so the SW wakes this tab when connectivity
  // returns, even if the tab is backgrounded at the time.
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg) => reg.sync.register('aura-send-queue'))
      .catch(() => {});
  }
};
const dequeueMsg = (clientId) => saveQueue(loadQueue().filter((m) => m.clientId !== clientId));
const isNetworkError = (err) =>
  !err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error' || !navigator.onLine);

const getStoredChatFullHeight = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const stored = Number(window.localStorage?.getItem(CHAT_FULL_HEIGHT_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
};

const rememberChatFullHeight = (height) => {
  if (typeof window === 'undefined' || !Number.isFinite(height) || height < 500) return;
  try {
    const stored = getStoredChatFullHeight();
    if (height > stored) window.localStorage?.setItem(CHAT_FULL_HEIGHT_KEY, String(Math.round(height)));
  } catch {
    // localStorage can be unavailable in private contexts.
  }
};

const getChatViewportMetrics = () => {
  if (typeof window === 'undefined') return { height: 800, offsetTop: 0, keyboardOpen: false, zoomScale: 1 };
  const viewport = window.visualViewport;
  // layoutHeight: the CSS layout viewport (ignores keyboard, includes address bar)
  const layoutHeight =
    document.documentElement?.clientHeight ||
    window.innerHeight ||
    800;
  // visualHeight: shrinks when the keyboard is open (all browsers)
  const visualHeight = viewport?.height || layoutHeight;
  const offsetTop    = viewport?.offsetTop || 0;

  // Keyboard is open when the visual viewport is meaningfully smaller
  // than the layout viewport. 0.75 is slightly more conservative than
  // the previous 0.78, reducing false positives on Chrome when the
  // address bar collapses.
  const keyboardOpen = Boolean(viewport && visualHeight < layoutHeight * 0.75);

  // -- zoom is now reset to 1 on chat-open, so we never divide by it --
  // Keeping the read here for diagnostics / future use, but NOT dividing.
  const targetHeight = keyboardOpen
    ? visualHeight          // shrunk to visible area above keyboard
    : layoutHeight;         // full layout height (CSS dvh/svh will govern anyway)

  return {
    height: targetHeight,   // no longer divided by zoomScale
    offsetTop: keyboardOpen ? offsetTop : 0,
    keyboardOpen,
    zoomScale: 1,           // always 1 inside chat-open
  };
};

const androidNativeViewportState = {
  normalHeight: 0,
};

const getAndroidNativeViewportMetrics = (keyboardHeight = 0) => {
  if (typeof window === 'undefined') return { height: 800, offsetTop: 0, keyboardOpen: false };
  const layoutHeight = window.innerHeight || document.documentElement?.clientHeight || 800;
  const visualHeight = window.visualViewport?.height || layoutHeight;
  const reportedHeight = Math.max(layoutHeight, visualHeight);
  const keyboardOpen = Number(keyboardHeight || 0) > 0;

  if (!keyboardOpen) {
    androidNativeViewportState.normalHeight = Math.max(
      androidNativeViewportState.normalHeight,
      reportedHeight
    );
  }

  const baseHeight = Math.max(
    androidNativeViewportState.normalHeight || 0,
    reportedHeight
  );
  const nativeAdjustedHeight = Math.max(320, baseHeight - Number(keyboardHeight || 0));
  const webViewAlreadyResized = keyboardOpen && reportedHeight < baseHeight - 24;
  const targetHeight = keyboardOpen
    ? (webViewAlreadyResized ? Math.max(reportedHeight, nativeAdjustedHeight) : nativeAdjustedHeight)
    : baseHeight;
  const screenHeight = window.screen?.height || 0;
  const fullHeight = Math.max(
    Math.max(baseHeight, screenHeight),
    getStoredChatFullHeight()
  );

  return {
    height: targetHeight,
    fullHeight,
    offsetTop: 0,
    keyboardOpen,
    zoomScale: 1,
  };
};

const stableChatViewport = (() => {
  let normalHeight = 0;
  let keyboardHeight = 0;
  let lastMode = 'normal';
  const HEIGHT_JITTER_PX = 18;
  const MIN_KEYBOARD_VIEWPORT_RATIO = 0.52;

  return (metrics) => {
    const mode = metrics.keyboardOpen ? 'keyboard' : 'normal';
    const previous = mode === 'keyboard' ? keyboardHeight : normalHeight;
    let height = metrics.height;
    const keyboardFloor = mode === 'keyboard' && metrics.fullHeight
      ? metrics.fullHeight * MIN_KEYBOARD_VIEWPORT_RATIO
      : 0;

    if (keyboardFloor && metrics.height < keyboardFloor) {
      height = previous && previous >= keyboardFloor ? previous : keyboardFloor;
    } else if (previous && Math.abs(previous - metrics.height) <= HEIGHT_JITTER_PX) {
      height = previous;
    } else if (mode === 'keyboard') {
      keyboardHeight = metrics.height;
    } else {
      normalHeight = Math.max(normalHeight, metrics.height);
      height = normalHeight;
      rememberChatFullHeight(metrics.fullHeight || height);
    }

    if (mode !== lastMode) {
      lastMode = mode;
      if (mode === 'keyboard') keyboardHeight = height;
    }

    return {
      ...metrics,
      height,
      offsetTop: mode === 'keyboard' ? metrics.offsetTop : 0,
      mode,
    };
  };
})();

/**
 * MessagingHub - Premium Global Messaging Center
 * Features: Infinite scroll, typing indicators, grouped bubbles, and search.
 */
export default function MessagingHub({ vendorId: initialVendorId, product, initialData, notificationTitle, onClose, fullPage = false }) {
  const { user } = useAuthStore();
  const {
    isSystemWide,
    activePartnerId,
    activeMessages,
    activeConversation,
    conversations,
    typingIndicators,
    onlineUsersMap,
    setActiveConversation,
    upsertConversations,
    upsertMessages,
    receiveMessage,
    reconcileOptimisticMessage,
    markMessageFailed,
    markMessageQueued,
    markConversationRead,
    deleteMessage,
    syncInboxFromServer,
  } = useChat();
  // -- State --
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [pendingSendCount, setPendingSendCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [partnerBInfo, setPartnerBInfo] = useState(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [floatingMenu, setFloatingMenu] = useState(null);
  const [storyViewer, setStoryViewer] = useState({ statuses: null, storyId: null });
  const [mediaPreview, setMediaPreview] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(() => stableChatViewport(getChatViewportMetrics()));
  const viewportHeightRef = useRef(viewportHeight);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // UX Features
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const typingTimeoutRef = useRef(null);
  const typingHeartbeatRef = useRef(null);
  const typingPartnerIdRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputValueRef = useRef('');
  const activePartnerIdRef = useRef(activePartnerId);
  const messagesRef = useRef(activeMessages);
  const initialChatSyncRef = useRef(null);
  // Tracks when we last fetched messages per partner so we can rate-limit pre-send syncs
  const lastConvSyncRef = useRef({});
  const loadConversationRef = useRef(null); // always-fresh reference to loadConversation
  const chatRootRef = useRef(null);
  const viewportSyncRef = useRef(null);
  const viewportResumeUntilRef = useRef(0);
  const lastKeyboardViewportRef = useRef(null);
  const goBackOrCloseRef = useRef(null);  // always-fresh ref — avoids stale closures in back-button effects
  const backViaButtonRef = useRef(false); // true when browser/hardware back triggered the last navigation
  const suppressPopStateRef = useRef(false); // true during programmatic history.back() — prevents goBackOrClose re-firing

  const [deletedConvos, setDeletedConvos] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = JSON.parse(localStorage.getItem('aura_deleted_convos') || '{}');
      if (Array.isArray(stored)) return Object.fromEntries(stored.map((id) => [id, 0]));
      return stored && typeof stored === 'object' ? stored : {};
    } catch {
      return {};
    }
  });
  
  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const panelTouchRef = useRef(null);
  const [mobileLayout, setMobileLayout] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const inbox = conversations;
  const messages = activeMessages;
  const partnerInfo = useMemo(() => {
    const fromConversation = activeConversation?.partner;
    const seeded = initialData;
    const hasMeta = (p) => Boolean(
      p?.name || p?.store_name || p?.branding?.store_name || p?.avatar || p?.profile_picture || p?.branding?.logo
    );
    if (hasMeta(fromConversation)) return fromConversation;
    if (hasMeta(seeded)) return seeded;
    return fromConversation || seeded || null;
  }, [activeConversation?.partner, initialData]);
  const hasSeedPartnerData = Boolean(
    partnerInfo?.name ||
    partnerInfo?.store_name ||
    partnerInfo?.branding?.store_name ||
    notificationTitle
  );
  const partnerTyping = Boolean(activePartnerId && typingIndicators[activePartnerId]);
  const latestMessageKey = messages.length
    ? messages[messages.length - 1]?._id || messages[messages.length - 1]?.client_id || messages[messages.length - 1]?.createdAt
    : null;
  const draftKey = user?._id && activePartnerId ? `aura_chat_draft:${user._id}:${activePartnerId}` : null;
  const trimmedInput = input.trim();
  const initialVendorKey = initialVendorId?.toString?.() || '';
  const initialDataKey = toId(initialData) || '';

  useEffect(() => {
    const previousPartnerId = activePartnerIdRef.current?.toString?.();
    if (previousPartnerId && previousPartnerId !== activePartnerId?.toString?.()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
      if (typingPartnerIdRef.current) {
        socketService.emit('typing_stop', { receiver_id: typingPartnerIdRef.current });
      }
      typingPartnerIdRef.current = null;
      setIsTyping(false);

      // Mark the previous thread as read when switching away.
      // messagesRef.current still holds the previous partner's messages at this point
      // (the ref-sync effect runs after this one). We check for at least one unread
      // message to avoid a no-op API call on every thread switch.
      const prevMsgs = messagesRef.current || [];
      const hasUnread = prevMsgs.some(
        (m) => toId(m.sender_id) === previousPartnerId && !m.read_status
      );
      if (hasUnread) {
        // Socket emit gives the sender instant blue-tick feedback.
        socketService.emit('mark_messages_read', { sender_id: previousPartnerId });
        // HTTP call persists the read status and emits server-side socket events for
        // multi-tab sync and any clients not in the same Socket.IO process.
        api.patch(`/chat/read/${previousPartnerId}`)
          .then(() => markConversationRead(previousPartnerId))
          .catch(() => {});
      }
    }
    activePartnerIdRef.current = activePartnerId;
  }, [activePartnerId, markConversationRead]);

  useEffect(() => {
    messagesRef.current = activeMessages;
  }, [activeMessages]);

  useEffect(() => {
    viewportHeightRef.current = viewportHeight;
  }, [viewportHeight]);

  useEffect(() => {
    const objectUrl = mediaPreview?.objectUrl;
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaPreview?.objectUrl]);


  useEffect(() => {
    if (!activePartnerId || loadingMore || loading) return;
    scrollToBottom(mobileLayout ? 'auto' : 'smooth');
  }, [activePartnerId, latestMessageKey, partnerTyping, loading, loadingMore, mobileLayout]);

  useEffect(() => {
    if (!activePartnerId) return;

    const requestPresence = () => {
      socketService.emit('check_online_status', { userId: activePartnerId.toString() });
    };

    requestPresence();
    const retries = [750, 2000, 5000].map((delay) => setTimeout(requestPresence, delay));

    // On socket reconnect, also pull any messages that arrived while we were disconnected
    const onReconnect = () => {
      requestPresence();
      const pid = activePartnerIdRef.current;
      if (pid) {
        lastConvSyncRef.current[pid] = 0; // reset rate-limit so sync always fires on reconnect
        loadConversationRef.current?.(pid, 1, { silent: true, skipProfile: true, skipPresence: true });
      }
    };

    socketService.on('connect', onReconnect);
    return () => {
      retries.forEach(clearTimeout);
      socketService.off('connect', onReconnect);
    };
  }, [activePartnerId]);

  useEffect(() => {
    if (!draftKey || typeof window === 'undefined') {
      setInput('');
      inputValueRef.current = '';
      return;
    }

    const savedDraft = localStorage.getItem(draftKey) || '';
    setInput(savedDraft);
    inputValueRef.current = savedDraft;
  }, [draftKey]);

  useEffect(() => {
    if (!mobileLayout || !activePartnerId) return;

    viewportSyncRef.current?.();
    requestAnimationFrame(() => viewportSyncRef.current?.());
    const timers = [80, 180, 360, 700].map(delay => (
      setTimeout(() => viewportSyncRef.current?.(), delay)
    ));
    return () => timers.forEach(clearTimeout);
  }, [activePartnerId, mobileLayout]);

  useEffect(() => {
    if (!draftKey || typeof window === 'undefined') return;

    const timer = setTimeout(() => {
      const draft = input.trim();
      if (draft) localStorage.setItem(draftKey, input);
      else localStorage.removeItem(draftKey);
    }, 120);

    return () => clearTimeout(timer);
  }, [draftKey, input]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setMobileLayout(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const mobileQuery = window.matchMedia?.('(max-width: 767px)');
    const resetChatRootStyles = () => {
      chatRootRef.current?.style.removeProperty('--chat-shell-height');
      setViewportHeight(null);
    };
    const applyChatShellHeight = (metrics, isMobileChat) => {
      const root = chatRootRef.current;
      if (!root) return;
      if (!isMobileChat) {
        root.style.removeProperty('--chat-shell-height');
        return;
      }
      if (metrics?.keyboardOpen && Number.isFinite(metrics.height) && metrics.height > 0) {
        root.style.setProperty('--chat-shell-height', `${Math.round(metrics.height)}px`);
      } else {
        root.style.removeProperty('--chat-shell-height');
      }
    };
    const syncViewport = () => {
      const rawMetrics = getChatViewportMetrics();
      let metrics = stableChatViewport(rawMetrics);
      const isMobileChat = mobileQuery?.matches ?? window.innerWidth < 768;

      if (!isMobileChat) {
        resetChatRootStyles();
        return;
      }

      applyChatShellHeight(metrics, isMobileChat);

      const previousMetrics = viewportHeightRef.current;
      const resumeActive = Boolean(viewportResumeUntilRef.current && Date.now() < viewportResumeUntilRef.current);
      const focusedComposer = document.activeElement === inputRef.current;
      const lastKeyboardMetrics = lastKeyboardViewportRef.current;
      const implausibleKeyboardShrink = Boolean(
        lastKeyboardMetrics &&
        metrics.mode === 'keyboard' &&
        Math.abs(metrics.height - lastKeyboardMetrics.height) > 64 &&
        (resumeActive || focusedComposer)
      );

      if (implausibleKeyboardShrink) {
        metrics = {
          ...lastKeyboardMetrics,
          keyboardOpen: true,
          mode: 'keyboard',
        };
        scheduleSync(180);
      }

      if (
        previousMetrics &&
        resumeActive &&
        previousMetrics.mode === metrics.mode
      ) {
        return;
      }

      const viewportChanged = !previousMetrics ||
        previousMetrics.mode !== metrics.mode ||
        Math.abs(previousMetrics.height - metrics.height) >= 8;

      setViewportHeight(prev => {
        if (
          prev &&
          prev.mode === metrics.mode &&
          Math.abs(prev.height - metrics.height) < 8
        ) {
          return prev;
        }
        viewportHeightRef.current = metrics;
        return metrics;
      });

      if (metrics.mode === 'keyboard' && !resumeActive) {
        lastKeyboardViewportRef.current = metrics;
      }

      if (viewportChanged && activePartnerIdRef.current) {
        requestAnimationFrame(() => {
          pinToLatestMessage('auto');
        });
        queuePinToLatest([120, 260]);
      }
    };
    viewportSyncRef.current = syncViewport;

    const syncTimers = [];
    const scheduleSync = (delay) => {
      const timer = setTimeout(syncViewport, delay);
      syncTimers.push(timer);
    };
    const releaseComposerBeforeBackground = () => {
      if (document.activeElement === inputRef.current) {
        inputRef.current?.blur?.();
      }
      viewportResumeUntilRef.current = 0;
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    };
    const settleViewportAfterResume = () => {
      if (document.visibilityState === 'hidden') return;
      const wasKeyboardOpen = viewportHeightRef.current?.mode === 'keyboard';
      viewportResumeUntilRef.current = Date.now() + 1800;
      if (wasKeyboardOpen && lastKeyboardViewportRef.current) {
        viewportHeightRef.current = lastKeyboardViewportRef.current;
        setViewportHeight(lastKeyboardViewportRef.current);
        applyChatShellHeight(lastKeyboardViewportRef.current, true);
      }
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        pinToLatestMessage('auto');
      });
      [120, 260, 540, 900, 1300, 1850].forEach(scheduleSync);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') releaseComposerBeforeBackground();
      if (document.visibilityState === 'visible') settleViewportAfterResume();
    };

    syncViewport();
    requestAnimationFrame(syncViewport);
    [80, 180, 360, 700].forEach(scheduleSync);
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    window.addEventListener('pageshow', settleViewportAfterResume);
    window.addEventListener('focus', settleViewportAfterResume);
    window.addEventListener('pagehide', releaseComposerBeforeBackground);
    window.addEventListener('blur', releaseComposerBeforeBackground);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('pageshow', settleViewportAfterResume);
      window.removeEventListener('focus', settleViewportAfterResume);
      window.removeEventListener('pagehide', releaseComposerBeforeBackground);
      window.removeEventListener('blur', releaseComposerBeforeBackground);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      syncTimers.forEach(clearTimeout);
      viewportSyncRef.current = null;
      resetChatRootStyles();
    };
  }, []);

  useEffect(() => {
    if (!mobileLayout || typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverscroll = root.style.overscrollBehavior;
    const previousBodyOverscroll = body.style.overscrollBehavior;

    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    root.classList.add('chat-open');

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      root.style.overscrollBehavior = previousRootOverscroll;
      body.style.overscrollBehavior = previousBodyOverscroll;
      root.classList.remove('chat-open');
    };
  }, [mobileLayout]);

  const hideConversation = (partnerId) => {
    const updated = { ...deletedConvos, [partnerId]: Date.now() };
    setDeletedConvos(updated);
    localStorage.setItem('aura_deleted_convos', JSON.stringify(updated));
    setActiveConversation(null);
    syncInboxFromServer?.();
  };

  const pinToLatestMessage = (behavior = 'auto') => {
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  };

  const queuePinToLatest = (delays = [0, 80, 180, 320]) => {
    delays.forEach((delay) => {
      setTimeout(() => {
        requestAnimationFrame(() => pinToLatestMessage('auto'));
      }, delay);
    });
  };

  const scrollToBottom = (behavior = 'smooth') => {
    setTimeout(() => {
      requestAnimationFrame(() => pinToLatestMessage(behavior));
    }, behavior === 'smooth' ? 100 : 0);
  };

  const keepChatInView = (behavior = 'auto') => {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      if (window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      pinToLatestMessage(behavior);
    });
  };

  const resetComposerHeight = () => {
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = '42px';
      keepChatInView('auto');
    });
  };

  const keepComposerFocusedAfterSend = () => {
    if (!mobileLayout || !inputRef.current) return;

    const focusComposer = () => {
      inputRef.current?.focus?.({ preventScroll: true });
      viewportSyncRef.current?.();
      pinToLatestMessage('auto');
    };

    requestAnimationFrame(focusComposer);
    setTimeout(focusComposer, 60);
    setTimeout(focusComposer, 160);
  };

  const releaseMobileKeyboard = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const active = document.activeElement;
    if (active && typeof active.blur === 'function') active.blur();
    inputRef.current?.blur?.();

    const settle = () => {
      scrollToBottom('auto');
      if (window.visualViewport) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
      document.body.style.transform = 'translateZ(0)';
      requestAnimationFrame(() => {
        document.body.style.transform = '';
      });
    };

    requestAnimationFrame(settle);
    setTimeout(settle, 180);
    setTimeout(settle, 420);
  };

  useEffect(() => {
    const syncKey = `${initialVendorKey || 'inbox'}:${initialDataKey || 'no-data'}`;
    if (initialChatSyncRef.current === syncKey) return;
    initialChatSyncRef.current = syncKey;

    setActiveConversation(initialVendorKey || null, initialData || null);
    setPage(1);
    setHasMore(true);
  }, [initialVendorKey, initialDataKey, setActiveConversation]);

  // -- Data Fetching --
  useEffect(() => {
    if (activePartnerId) {
      loadConversation(activePartnerId, 1, {
        silent: hasSeedPartnerData,
        skipProfile: hasSeedPartnerData,
      });
    } else {
      loadInbox({ silent: inbox.length > 0 });
    }
  }, [activePartnerId, isSystemWide, hasSeedPartnerData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFocus = (event) => {
      const partnerId = event.detail?.partnerId?.toString();
      if (!partnerId) return;
      setActiveConversation(partnerId, event.detail?.partnerData || null, event.detail?.notificationTitle);
      // Use ref so we always call the latest loadConversation, never a stale closure
      loadConversationRef.current?.(partnerId, 1, {
        silent: true,
        skipProfile: Boolean(event.detail?.partnerData),
        skipPresence: Boolean(event.detail?.skipPresence),
      });
      queuePinToLatest([0, 80, 180, 360]);
    };
    window.addEventListener('aura_chat_focus', handleFocus);
    return () => window.removeEventListener('aura_chat_focus', handleFocus);
  }, [setActiveConversation]);

  useEffect(() => {
    if (!activePartnerId) return;

    let stopped = false;
    const reconcileActiveConversation = () => {
      if (stopped || document.visibilityState === 'hidden') return;
      loadConversation(activePartnerId, 1, {
        silent: true,
        skipProfile: true,
        skipPresence: true,
      });
    };

    // Socket.IO gives the instant path. This small foreground reconciliation
    // closes the at-most-once gap if a mobile radio drops a single socket frame.
    const warmup = setTimeout(reconcileActiveConversation, 1200);
    const interval = setInterval(reconcileActiveConversation, 4000);

    return () => {
      stopped = true;
      clearTimeout(warmup);
      clearInterval(interval);
    };
  }, [activePartnerId, isSystemWide, partnerBInfo?._id]);

  useEffect(() => {
    if (activePartnerId) return;

    let stopped = false;
    const pollInboxIfSocketUnavailable = () => {
      if (stopped || socketService.isConnected()) return;
      loadInbox({ silent: true });
    };

    const interval = setInterval(pollInboxIfSocketUnavailable, 20000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [activePartnerId, isSystemWide]);

  // Reload active conversation when tab becomes visible again (e.g. after replying to a status)
  useEffect(() => {
    const handleVisibilityResume = () => {
      if (document.visibilityState !== 'visible') return;
      if (!activePartnerIdRef.current) return;
      // Use ref so we always have the latest loadConversation and activePartnerId
      loadConversationRef.current?.(activePartnerIdRef.current, 1, {
        silent: true,
        skipProfile: true,
        skipPresence: true,
      });
    };
    document.addEventListener('visibilitychange', handleVisibilityResume);
    return () => document.removeEventListener('visibilitychange', handleVisibilityResume);
  }, []);

  // Pull the active conversation immediately when SocketProvider signals a message arrived
  // via push while the socket was down (no toast needed — message just appears in-chat).
  useEffect(() => {
    const onPullConversation = (e) => {
      const pid = e.detail?.partnerId?.toString?.();
      if (!pid || pid !== activePartnerIdRef.current?.toString?.()) return;
      loadConversationRef.current?.(pid, 1, { silent: true, skipProfile: true, skipPresence: true });
    };
    window.addEventListener('aura:pull-conversation', onPullConversation);
    return () => window.removeEventListener('aura:pull-conversation', onPullConversation);
  }, []);

  const loadInbox = async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) setInboxLoading(true);
    try {
      const endpoint = isSystemWide ? '/chat/admin/inbox' : '/chat';
      const res = await api.get(endpoint);
      if (res.data.success) {
        upsertConversations(res.data.data.activeChats || []);
      }
    } catch (err) {
      console.error('Inbox load failed:', err);
    } finally {
      if (!silent) setInboxLoading(false);
    }
  };

  const loadConversation = async (pid, pageNum = 1, options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
    }

    try {
      let chatEndpoint = `/chat/${pid}?page=${pageNum}&limit=30`;
      if (isSystemWide && partnerBInfo) {
        const pid2 = partnerBInfo?._id || partnerBInfo;
        chatEndpoint = `/chat/admin/all?userA=${pid}&userB=${pid2}&page=${pageNum}&limit=30`;
      }

      const shouldFetchProfile = pageNum === 1 && !options.skipProfile && !(
        activePartnerId?.toString?.() === pid?.toString?.() &&
        (partnerInfo?.name || partnerInfo?.store_name || partnerInfo?.branding?.logo || partnerInfo?.avatar)
      );

      const [chatRes, partnerRes] = await Promise.all([
        api.get(chatEndpoint),
        shouldFetchProfile ? api.get(`/auth/users/${pid}`).catch(() => null) : Promise.resolve(null)
      ]);

      if (chatRes.data.success) {
        const newMsgs = chatRes.data.data?.messages || [];
        const total = chatRes.data.data?.total || 0;
        
        if (pageNum > 1 && scrollRef.current) {
          const prevScrollHeight = scrollRef.current.scrollHeight;
          const prevScrollTop = scrollRef.current.scrollTop;
          
          upsertMessages(pid, newMsgs, { prepend: true });
          setHasMore((messagesRef.current.length + newMsgs.length) < total);
          
          setTimeout(() => {
            if (scrollRef.current) {
              const newScrollHeight = scrollRef.current.scrollHeight;
              scrollRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
            }
          }, 50);
        } else {
          upsertMessages(pid, newMsgs);
          // A history pull is also a successful receipt. This covers the rare
          // case where a socket frame was lost but the reconciliation request
          // restored the message a moment later.
          const currentUserId = user?._id?.toString?.();
          newMsgs.forEach((message) => {
            if (
              message?._id &&
              !message.delivered_status &&
              toId(message.receiver_id) === currentUserId
            ) {
              socketService.emit('message_received', { messageId: message._id.toString() });
            }
          });
          setHasMore(newMsgs.length < total);
          // Always pin to bottom on page-1 load so the user sees the latest messages
          // regardless of whether the content was cached or already rendered.
          scrollToBottom(silent ? 'smooth' : 'auto');
          queuePinToLatest([0, 80, 200, 400]);
          const hasUnreadFromPartner = newMsgs.some((msg) =>
            toId(msg.sender_id) === pid?.toString?.() && !msg.read_status
          );
          if (hasUnreadFromPartner) {
            markAsRead(pid);
          }
        }
      }
      
      // Prefer explicit partner profile when available
      if (partnerRes?.data?.success) {
        setActiveConversation(pid, partnerRes.data.data?.user || partnerRes.data.user);
      } else {
        // Fallback: derive partner info from messages if profile endpoint failed
        try {
          const fromMsgs = (chatRes.data.data?.messages || []);
          // Find first message where sender or receiver is a populated object
          const found = fromMsgs.find(m => {
            const s = m.sender_id;
            const r = m.receiver_id;
            return (s && typeof s === 'object' && (s.name || s.avatar || s.store_name)) || (r && typeof r === 'object' && (r.name || r.avatar || r.store_name));
          });
          if (found) {
            const candidate = ((found.sender_id && ((found.sender_id._id || found.sender_id) !== user?._id?.toString())) ? found.sender_id : found.receiver_id);
            if (candidate && typeof candidate === 'object') {
              setActiveConversation(pid, candidate);
            }
          }
        } catch (e) {
          // ignore fallback failures
        }
      }

      // Query real-time presence status (more accurate than DB field)
      if (pageNum === 1 && !options.skipPresence) {
        socketService.emit('check_online_status', { userId: pid.toString() });
      }
    } catch (err) {
      console.error('Conversation load error:', err);
    } finally {
      if (!silent) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  // Keep ref current so event handlers never close over a stale copy
  loadConversationRef.current = loadConversation;

  // Fire-and-forget silent refresh of the active conversation, rate-limited to once per 2s per partner.
  // Called on input focus and just before send to ensure pending messages are visible before the
  // user's optimistic bubble is added — instant on all platforms (web, PWA, APK).
  const syncActivePid = (pid) => {
    if (!pid) return;
    const now = Date.now();
    if (now - (lastConvSyncRef.current[pid] || 0) < 500) return;
    lastConvSyncRef.current[pid] = now;
    loadConversationRef.current?.(pid, 1, { silent: true, skipProfile: true, skipPresence: true });
  };

  // ── Offline queue drain ───────────────────────────────────────────────────
  // Iterate queued messages and POST them to the server. The backend is idempotent
  // on client_id so re-submitting a message that already reached the server is safe.
  const drainSendQueue = useCallback(async () => {
    const queue = loadQueue();
    if (queue.length === 0) return;
    for (const item of queue) {
      if (item.retries >= MAX_QUEUE_RETRIES) {
        dequeueMsg(item.clientId);
        markMessageFailed(item.partnerId, item.tempId);
        continue;
      }
      // Exponential backoff: skip items whose back-off window hasn't elapsed yet.
      const delay = QUEUE_RETRY_DELAYS[Math.min(item.retries, QUEUE_RETRY_DELAYS.length - 1)];
      if (Date.now() - (item.lastAttemptAt || 0) < delay) continue;

      try {
        const res = await api.post('/chat', {
          receiver_id: item.partnerId,
          text: item.text || '',
          image_url: item.imageUrl || null,
          client_id: item.clientId,
          ...(item.productRef && { product_reference: item.productRef }),
        });
        if (res.data.success) {
          dequeueMsg(item.clientId);
          const realMsg = res.data.data?.message || res.data.message;
          reconcileOptimisticMessage(item.partnerId, item.tempId, realMsg, item.clientId);
        }
      } catch (err) {
        if (isNetworkError(err)) {
          saveQueue(loadQueue().map((m) => m.clientId === item.clientId
            ? { ...m, retries: m.retries + 1, lastAttemptAt: Date.now() }
            : m));
        } else {
          dequeueMsg(item.clientId);
          markMessageFailed(item.partnerId, item.tempId);
        }
      }
    }
  }, [reconcileOptimisticMessage, markMessageFailed, markMessageQueued]);

  // Drain on mount (catches messages queued in a previous session), and again
  // whenever the socket reconnects, the browser goes back online, or the SW
  // fires a Background Sync event (covers backgrounded tabs).
  useEffect(() => {
    drainSendQueue();
    const onOnline = () => drainSendQueue();
    const onConnect = () => drainSendQueue();
    const onSWMessage = (event) => {
      if (event.data?.type === 'drain-send-queue') drainSendQueue();
    };
    window.addEventListener('online', onOnline);
    socketService.on('connect', onConnect);
    navigator.serviceWorker?.addEventListener('message', onSWMessage);
    return () => {
      window.removeEventListener('online', onOnline);
      socketService.off('connect', onConnect);
      navigator.serviceWorker?.removeEventListener('message', onSWMessage);
    };
  }, [drainSendQueue]);

  const locallyUpdateInbox = (msg) => {
    if (!msg) return;
    const currentUserId = user?._id?.toString();
    const senderId = toId(msg.sender_id);
    const receiverId = toId(msg.receiver_id);
    const partnerId = senderId === currentUserId ? receiverId : senderId;
    receiveMessage(msg, {
      partnerId,
      isActive: Boolean(partnerId && activePartnerIdRef.current === partnerId),
    });
  };

  const markAsRead = async (pid) => {
    try {
      await api.patch(`/chat/read/${pid}`);
      markConversationRead(pid);
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  };

  const handleScroll = (e) => {
    if (!activePartnerId) return;
    if (e.target.scrollTop === 0 && hasMore && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadConversation(activePartnerId, nextPage);
    }
  };

  const handleDeleteMessage = async (messageId, type) => {
    try {
      const res = await api.delete(`/chat/message/${messageId}`, { data: { type } });
      if (res.data.success) {
        deleteMessage({
          messageId,
          deletedFor: type === 'everyone' ? 'everyone' : 'me',
          text: 'This message was deleted',
        });
        setActiveMenuMsgId(null);
        setFloatingMenu(null);
      }
    } catch (err) {
      console.error('Delete message failed:', err);
    }
  };

  // -- Typing Logic --
  const handleTyping = (val) => {
    inputValueRef.current = val;
    setInput(val);
    const targetPartnerId = activePartnerId?.toString?.();
    if (!targetPartnerId) return;

    if (!val.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
      if (typingPartnerIdRef.current) {
        socketService.emit('typing_stop', { receiver_id: typingPartnerIdRef.current });
      }
      typingPartnerIdRef.current = null;
      setIsTyping(false);
      return;
    }

    if (!isTyping || typingPartnerIdRef.current !== targetPartnerId) {
      if (typingPartnerIdRef.current && typingPartnerIdRef.current !== targetPartnerId) {
        socketService.emit('typing_stop', { receiver_id: typingPartnerIdRef.current });
        if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
      }
      setIsTyping(true);
      typingPartnerIdRef.current = targetPartnerId;
      socketService.emit('typing_start', { receiver_id: targetPartnerId });
      // Heartbeat at 1500ms — keeps the receiver's 3s indicator alive during long typing sessions.
      // Using 1500ms (not 2000ms) so the idle-stop timeout (2500ms) always fires first,
      // preventing both from co-firing in the same event-loop tick (race → flicker).
      if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = setInterval(() => {
        if (typingPartnerIdRef.current) {
          socketService.emit('typing_start', { receiver_id: typingPartnerIdRef.current });
        }
      }, 1500);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    // 2500ms idle timeout — longer than heartbeat interval so the heartbeat always fires
    // and clears itself before the idle stop, eliminating the heartbeat/stop race.
    typingTimeoutRef.current = setTimeout(() => {
      const partnerId = typingPartnerIdRef.current;
      setIsTyping(false);
      typingPartnerIdRef.current = null;
      if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
      typingHeartbeatRef.current = null;
      if (partnerId) socketService.emit('typing_stop', { receiver_id: partnerId });
    }, 2500);
  };

  const closeMediaPreview = () => {
    setMediaPreview((current) => {
      if (current?.objectUrl) URL.revokeObjectURL(current.objectUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activePartnerId) return;

    if (!file.type?.startsWith('image/')) {
      toast.error('Select an image to send.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setMediaPreview({
      mode: 'compose',
      file,
      url: objectUrl,
      objectUrl,
      caption: inputValueRef.current || input,
    });
  };

  const sendPreviewMedia = async () => {
    if (!mediaPreview?.file || !activePartnerId || uploading) return;

    const file = mediaPreview.file;
    const caption = mediaPreview.caption || '';
    const objectUrl = mediaPreview.objectUrl;
    const sendPartnerId = activePartnerId.toString();

    // 1. Show image bubble immediately — exactly like WhatsApp.
    const sendStamp = Date.now();
    const tempId = `opt-${sendStamp}-${Math.random().toString(36).slice(2)}`;
    const clientId = `client-${sendStamp}-${Math.random().toString(36).slice(2)}`;
    const optimisticImg = {
      _id: tempId,
      client_id: clientId,
      text: caption,
      image_url: objectUrl,  // blob URL renders instantly
      _uploading: true,       // triggers spinner overlay
      sender_id: user?._id,
      receiver_id: sendPartnerId,
      createdAt: new Date().toISOString(),
      status: 'sending',
      delivered_status: onlineUsersMap[sendPartnerId] === true,
    };
    receiveMessage(optimisticImg, { partnerId: sendPartnerId, isActive: true });
    closeMediaPreview();
    if (caption) { inputValueRef.current = ''; setInput(''); }
    queuePinToLatest([0, 80, 180]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // 2. Upload + send in background — no UI blocking.
    setUploading(true);
    try {
      const uploadRes = await uploadService.uploadSingle(file, 'general');
      if (!uploadRes.success) throw new Error(uploadRes.message || 'Upload failed');

      const apiRes = await api.post('/chat', {
        receiver_id: sendPartnerId,
        text: caption,
        image_url: uploadRes.data.url,
        client_id: clientId,
      });
      if (apiRes.data.success) {
        const realMsg = apiRes.data.data?.message || apiRes.data.message;
        reconcileOptimisticMessage(sendPartnerId, tempId, realMsg, clientId);
      }
    } catch (err) {
      if (isNetworkError(err)) {
        // Queue for retry — show offline wifi icon so user knows it's queued, not lost.
        enqueueMsg({ partnerId: sendPartnerId, text: caption, imageUrl: null, clientId, tempId, productRef: null });
        markMessageQueued(sendPartnerId, tempId);
      } else {
        markMessageFailed(sendPartnerId, tempId);
        toast.error('Failed to send image');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (customText = null, imageUrl = null) => {
    const fromComposer = customText === null;
    const imageUsesComposerText = Boolean(imageUrl && customText === '');
    const shouldClearComposer = fromComposer || imageUsesComposerText;
    const text = (shouldClearComposer ? inputValueRef.current : customText || '').trim();
    if ((!text && !imageUrl) || !activePartnerId || (uploading && !imageUrl)) return;
    const sendPartnerId = activePartnerId.toString();
    const sentDraftKey = draftKey;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
    typingHeartbeatRef.current = null;
    const typingPartnerId = typingPartnerIdRef.current || activePartnerId?.toString?.();
    setIsTyping(false);
    typingPartnerIdRef.current = null;
    if (typingPartnerId) socketService.emit('typing_stop', { receiver_id: typingPartnerId });

    // Fire-and-forget: pull any pending messages before our optimistic bubble lands.
    // Non-blocking — the optimistic message still appears instantly.
    syncActivePid(sendPartnerId);

    setPendingSendCount(count => count + 1);
    const sendStamp = Date.now();
    const optimisticMsg = {
      _id: `opt-${sendStamp}-${Math.random().toString(36).slice(2)}`,
      client_id: `client-${sendStamp}-${Math.random().toString(36).slice(2)}`,
      text,
      image_url: imageUrl,
      product_reference: product ? {
        _id: product._id,
        name: product.name,
        price: product.price,
        images: product.images,
      } : null,
      sender_id: user?._id,
      receiver_id: sendPartnerId,
      createdAt: new Date().toISOString(),
      status: 'sending',
      delivered_status: onlineUsersMap[sendPartnerId] === true,
    };

    receiveMessage(optimisticMsg, {
      partnerId: sendPartnerId,
      isActive: true,
    });
    if (shouldClearComposer) inputValueRef.current = '';
    setInput('');
    resetComposerHeight();
    if (shouldClearComposer) keepComposerFocusedAfterSend();
    if (sentDraftKey && typeof window !== 'undefined') localStorage.removeItem(sentDraftKey);
    queuePinToLatest([0, 80, 180]);

    try {
      const res = await api.post('/chat', {
        receiver_id: activePartnerId,
        text,
        image_url: imageUrl,
        client_id: optimisticMsg.client_id,
        ...(product && { product_reference: product._id }),
      });
      if (res.data.success) {
        const realMsg = res.data.data?.message || res.data.message;
        reconcileOptimisticMessage(sendPartnerId, optimisticMsg._id, realMsg, optimisticMsg.client_id);
      }
    } catch (err) {
      if (isNetworkError(err)) {
        // Network is down — queue for automatic retry and show wifi-off icon so the
        // user knows the message is queued (not lost) and will send when back online.
        enqueueMsg({
          partnerId: sendPartnerId,
          text,
          imageUrl: imageUrl || null,
          clientId: optimisticMsg.client_id,
          tempId: optimisticMsg._id,
          productRef: product?._id || null,
        });
        markMessageQueued(sendPartnerId, optimisticMsg._id);
      } else {
        markMessageFailed(sendPartnerId, optimisticMsg._id);
        if (sentDraftKey && text && typeof window !== 'undefined') localStorage.setItem(sentDraftKey, text);
      }
    } finally {
      setPendingSendCount(count => Math.max(0, count - 1));
    }
  };

  // -- Computed --
  const filteredInbox = useMemo(() => {
    return inbox
      .filter(c => {
        const partnerId = (c.partner?._id || '').toString();
        const hiddenAt = deletedConvos[partnerId];
        if (hiddenAt === undefined) return true;
        return new Date(c.date || 0).getTime() > Number(hiddenAt || 0);
      })
      .filter(c => {
        const name = (c.partner?.store_name || c.partner?.name || '').toLowerCase();
        return name.includes(searchQuery.toLowerCase());
      });
  }, [inbox, deletedConvos, searchQuery]);

  const partnerName = (
    partnerInfo?.store_name       ||
    partnerInfo?.branding?.store_name ||
    partnerInfo?.name             ||
    initialData?.name             ||   // from senderData passed by SocketProvider
    initialData?.store_name       ||
    // Last resort: use the notification title that was already shown to the user.
    // This avoids the jarring "User" flash. Replace with your own prop name if different.
    notificationTitle             ||
    ''
  ).toString();
  const partnerAvatar = partnerInfo?.store?.logo || partnerInfo?.branding?.logo || partnerInfo?._id?.branding?.logo || partnerInfo?.avatar || partnerInfo?.profile_picture;
  const lastPartnerMessageAt = useMemo(() => {
    if (!activePartnerId) return null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      const senderId = toId(msg.sender_id);
      if (senderId && senderId === activePartnerId.toString()) {
        return msg.createdAt || msg.updatedAt || null;
      }
    }
    return null;
  }, [activePartnerId, messages]);
  const socketConnected = socketService.isConnected();
  const formatLastSeen = (value) => {
    if (!value) return 'offline';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'offline';
    return `last seen ${date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };
  const partnerIdStr = activePartnerId?.toString();
  const liveOnline = partnerIdStr ? onlineUsersMap[partnerIdStr] : undefined;
  const isOnline = typeof liveOnline === 'boolean' ? liveOnline : (partnerInfo?.is_online === true);

  const partnerStatus = (() => {
    if (partnerTyping) {
      return { label: 'typing...', className: 'text-emerald-400' };
    }
    if (isOnline) {
      return { label: 'online', className: 'text-emerald-400' };
    }
    return {
      label: formatLastSeen(partnerInfo?.last_seen || partnerInfo?.lastSeen || lastPartnerMessageAt),
      className: 'text-[var(--nav-text)]/55',
    };
  })();
  const composerBusy = uploading;

  const storyReplyMeta = (msg) => {
    const meta = msg?.metadata;
    return meta?.type === 'story_reply' ? meta : null;
  };

  const storyThumbnailSource = (meta) => {
    if (!meta) return null;
    return meta.storyThumbnail || meta.thumbnail_url || meta.storyPreviewUrl || null;
  };

  const storyPreviewSource = (meta) => {
    if (!meta) return null;
    if (meta.storyType === 'video') {
      return storyThumbnailSource(meta);
    }
    return meta.storyThumbnail || meta.storyPreviewUrl || meta.storyPreview || meta.content_url || null;
  };

  const renderFloatingMenu = () => {
    if (!floatingMenu) return null;

    const menuStyle = {
      top: floatingMenu.top,
      left: floatingMenu.left,
      zIndex: 90,
    };

    const menu = floatingMenu.type === 'chat' ? (
      <div
        className="absolute min-w-[206px] rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-1.5 text-[var(--text-primary)] shadow-2xl ring-1 ring-black/10"
        style={menuStyle}
        data-chat-action-menu="header"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            closeFloatingMenu();
            if (confirm('Delete this conversation from your inbox?')) hideConversation(activePartnerId.toString());
          }}
          className="flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/20"
        >
          <Trash2 className="size-4" />
          Delete conversation
        </button>
      </div>
    ) : (
      <div
        className="absolute min-w-[190px] rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-1.5 text-[var(--text-primary)] shadow-2xl ring-1 ring-black/10"
        style={menuStyle}
        data-chat-action-menu="message"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => handleDeleteMessage(floatingMenu.msg._id, 'me')}
          className="flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[var(--text-primary)] transition hover:bg-[var(--bg-secondary)]"
        >
          <Trash2 className="size-4 text-[var(--text-secondary)]" /> Delete for me
        </button>
        {floatingMenu.isOwn && (
          <button
            type="button"
            onClick={() => handleDeleteMessage(floatingMenu.msg._id, 'everyone')}
            className="flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <Trash2 className="size-4 text-red-500" /> Delete for everyone
          </button>
        )}
      </div>
    );

    return (
      <>
        <div className="absolute inset-0 cursor-default bg-transparent" style={{ zIndex: 89 }} onClick={closeFloatingMenu} />
        {menu}
      </>
    );
  };

  const openStoryReply = async (msg) => {
    const meta = storyReplyMeta(msg);
    const storyId = meta?.storyId || meta?.statusId;
    if (!storyId) return;
    try {
      const res = await api.get(`/statuses/story/${storyId}`);
      if (res.data.success && res.data.data) {
        setStoryViewer({ statuses: [res.data.data], storyId });
        return;
      }
      toast.error('That story is no longer active.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'That story is no longer active.');
    }
  };

  const dismissOverlay = () => {
    setChatMenuOpen(false);
    setFloatingMenu(null);
    setActiveConversation(null);
    onClose?.();
  };

  const goBackOrClose = () => {
    setChatMenuOpen(false);
    setFloatingMenu(null);
    if (activePartnerId) {
      setActiveConversation(null);
    } else {
      dismissOverlay();
    }
  };

  // Keep goBackOrClose fresh every render so back-button effects never hold stale closures.
  goBackOrCloseRef.current = goBackOrClose;

  // ── Browser back button (popstate) ────────────────────────────────────────
  // Pushes a dummy history entry when the panel mounts or the user moves between
  // the inbox and a thread. Pressing browser-back calls goBackOrClose() instead
  // of navigating away — mirrors WhatsApp: thread → inbox → close.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    backViaButtonRef.current = false;
    window.history.pushState({ chatInterceptor: true }, '');

    const onPopState = () => {
      // Ignore popstates triggered by our own programmatic history.back() calls (cleanup).
      // Those occur when navigating forward (inbox → thread), and should not call goBackOrClose.
      if (suppressPopStateRef.current) {
        suppressPopStateRef.current = false;
        return;
      }
      backViaButtonRef.current = true;
      goBackOrCloseRef.current?.();
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      // If the panel closed via UI (X / backdrop) rather than the back button,
      // clean up the dummy history entry so the browser stack stays clean.
      if (!backViaButtonRef.current && window.history.state?.chatInterceptor) {
        suppressPopStateRef.current = true; // suppress the resulting popstate in the new listener
        window.history.back();
      }
    };
  // Re-run when the user moves between inbox (null) and a thread (partnerId).
  // Each level of navigation needs its own dummy history entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePartnerId]);

  // ── Capacitor Android hardware back button ─────────────────────────────────
  // The OS fires the hardware back button event before popstate on Android WebView.
  // Intercept it and mirror browser-back behaviour: thread → inbox → close.
  useEffect(() => {
    let listener = null;
    let cancelled = false;

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || cancelled) return;
        const { App } = await import('@capacitor/app');
        listener = await App.addListener('backButton', () => {
          goBackOrCloseRef.current?.();
        });
        if (cancelled) listener?.remove?.();
      } catch (_) {}
    })();

    return () => {
      cancelled = true;
      listener?.remove?.();
    };
  }, []); // Once only — goBackOrCloseRef is always current

  /** Reliable swipe-down dismiss only. Horizontal swipes are ignored to avoid browser-history navigation. */
  const handlePanelTouchStart = (e) => {
    if (!mobileLayout) return;
    const t = e.touches?.[0];
    if (!t) return;
    panelTouchRef.current = {
      y: t.clientY,
      t: Date.now(),
      fromMessages: !!e.target.closest('[data-chat-messages]'),
      fromComposer: !!e.target.closest('[data-chat-composer]'),
    };
  };

  const handlePanelTouchEnd = (e) => {
    if (!mobileLayout || !panelTouchRef.current) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const start = panelTouchRef.current;
    panelTouchRef.current = null;

    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    if (dt > 650) return;

    if (dy > 64 && start.y < 120 && !start.fromComposer) {
      goBackOrClose();
    }
  };

  const pullToClose = (info) => {
    if (info.offset.y > 48 || info.velocity.y > 420) {
      dismissOverlay();
    }
  };

  const closeFloatingMenu = () => {
    setChatMenuOpen(false);
    setActiveMenuMsgId(null);
    setFloatingMenu(null);
  };

  const clampMenuPosition = (rect, width, height = 96, align = 'right') => {
    const root = chatRootRef.current;
    if (!root) return { top: 0, left: 0 };

    const rootRect = root.getBoundingClientRect();
    const scaleX = root.clientWidth ? rootRect.width / root.clientWidth : 1;
    const scaleY = root.clientHeight ? rootRect.height / root.clientHeight : 1;
    const toLocalX = (value) => (value - rootRect.left) / Math.max(scaleX, 0.01);
    const toLocalY = (value) => (value - rootRect.top) / Math.max(scaleY, 0.01);
    const gutter = 8;
    const localTop = toLocalY(rect.bottom) + 8;
    const localAboveTop = toLocalY(rect.top) - height - 8;
    const availableHeight = root.clientHeight || rootRect.height;
    const availableWidth = root.clientWidth || rootRect.width;
    const top = localTop + height <= availableHeight - gutter
      ? localTop
      : Math.max(gutter, localAboveTop);
    const localLeft = align === 'left'
      ? toLocalX(rect.left)
      : toLocalX(rect.right) - width;

    return {
      top: Math.round(Math.max(gutter, Math.min(top, availableHeight - height - gutter))),
      left: Math.round(Math.max(gutter, Math.min(localLeft, availableWidth - width - gutter))),
    };
  };

  const openChatMenu = (event) => {
    event.stopPropagation();
    if (chatMenuOpen) {
      closeFloatingMenu();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveMenuMsgId(null);
    setChatMenuOpen(true);
    setFloatingMenu({ type: 'chat', ...clampMenuPosition(rect, 206, 52, 'right') });
  };

  const openMessageMenu = (event, msg, isOwn) => {
    event.stopPropagation();
    if (activeMenuMsgId === msg._id) {
      closeFloatingMenu();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setChatMenuOpen(false);
    setActiveMenuMsgId(msg._id);
    setFloatingMenu({
      type: 'message',
      msg,
      isOwn,
      ...clampMenuPosition(rect, 190, isOwn ? 92 : 52, isOwn ? 'right' : 'left'),
    });
  };

  useEffect(() => {
    closeFloatingMenu();
  }, [activePartnerId]);

  const headerSwipeProps =
    mobileLayout
      ? {
          drag: 'y',
          dragConstraints: { top: 0, bottom: 0 },
          dragElastic: { top: 0, bottom: 0.28 },
          dragMomentum: false,
          onDragEnd: (_e, info) => {
            if (info.offset.y > 44 || info.velocity.y > 420) {
              goBackOrClose();
            }
          },
        }
      : {};
  const mobileShellStyle = mobileLayout
    ? {
        paddingTop: 'env(safe-area-inset-top, 0px)',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 'auto',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-secondary)',
      }
    : undefined;

  const outerClass = fullPage
    ? [
        'relative flex min-h-0 w-full flex-col overflow-hidden bg-[var(--bg-secondary)] touch-manipulation',
        'max-md:w-full',
        'md:h-full md:flex-1',
      ].join(' ')
    : [
        'fixed z-[600] flex min-h-0 flex-col overflow-hidden bg-[var(--bg-secondary)] touch-manipulation overscroll-contain',
        'max-md:w-full',
        'max-md:rounded-none max-md:border-0 max-md:shadow-none',
        'md:left-auto md:right-5 md:top-[max(1rem,env(safe-area-inset-top))] md:bottom-5',
        'md:h-[min(86dvh,760px)] md:max-h-[86dvh] md:w-[min(440px,calc(100vw-2.5rem))]',
        'md:rounded-2xl md:border md:border-[var(--glass-border)] md:shadow-[0_24px_72px_rgba(0,0,0,0.28)]',
      ].join(' ');
  const mobileMotionProps = mobileLayout
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 16 },
      };

  return (
    <motion.div
      id="chat-root"
      ref={chatRootRef}
      style={{...mobileShellStyle, contain: 'layout style paint' }}
      onTouchStart={handlePanelTouchStart}
      onTouchEnd={handlePanelTouchEnd}
      {...(!fullPage
        ? mobileMotionProps
        : {})}
      transition={mobileLayout ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
      className={outerClass}
    >

      {/* -- HEADER ------------------------------------------------- */}
      {renderFloatingMenu()}

      <AnimatePresence mode="wait">
        {activePartnerId ? (
          /* Chat Header */
          <motion.div
            key="chat-header"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="shrink-0 bg-[var(--nav-bg)] text-[var(--nav-text)] shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
            data-chat-header
          >
            <motion.div {...headerSwipeProps} className="touch-pan-y">
              <div className="flex min-h-[54px] items-center gap-1.5 px-2 py-1.5 sm:min-h-[60px] sm:gap-2 sm:px-3 sm:py-2">
                <button
                  type="button"
                  onClick={() => setActiveConversation(null)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--nav-text)]/95 transition-colors hover:bg-white/10 active:bg-white/15"
                  aria-label="Back to chats"
                >
                  <ArrowLeft className="size-5" />
                </button>

                <div className="relative shrink-0">
                  <div className="size-9 overflow-hidden rounded-full bg-white/15 ring-2 ring-white/20 sm:size-10">
                    {partnerAvatar && typeof partnerAvatar === 'string'
                      ? <img src={partnerAvatar} className="size-full object-cover" alt="" />
                      : <div className="flex size-full items-center justify-center text-sm font-semibold text-[var(--nav-text)]">{(partnerName || notificationTitle || '?')[0]}</div>}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[14px] font-semibold leading-tight text-[var(--nav-text)] capitalize sm:text-[15px]">
                    {isSystemWide && partnerBInfo
                      ? <span>{partnerName || notificationTitle} <span className="text-[var(--nav-text)]/40">&</span> {partnerBInfo?.name}</span>
                      : (partnerName || notificationTitle || 'Chat')}
                  </h3>
                  <div className="mt-0.5 flex items-center gap-1">
                    {partnerTyping ? (
                      <span className="flex items-center gap-1 text-[11px] text-[var(--nav-text)]/70">
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map(d => (
                            <motion.span
                              key={d}
                              className="inline-block size-[3px] rounded-full bg-[var(--nav-text)]/45"
                              animate={{ y: [0, -3, 0] }}
                              transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }}
                            />
                          ))}
                        </span>
                        typing...
                      </span>
                    ) : (
                      <p className={`text-[11px] sm:text-[12px] ${partnerStatus.className}`}>
                        {partnerStatus.label}
                      </p>
                    )}
                  </div>
                </div>

                <div className="relative flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={openChatMenu}
                    className="flex size-9 items-center justify-center rounded-full text-[var(--nav-text)]/80 transition-colors hover:bg-white/10 active:bg-white/15"
                    aria-label="Chat options"
                    aria-expanded={chatMenuOpen}
                  >
                    <MoreVertical className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={dismissOverlay}
                    className="flex size-9 items-center justify-center rounded-full text-[var(--nav-text)]/85 transition-colors hover:bg-white/10 active:bg-white/15"
                    aria-label="Close chat"
                  >
                    <X className="size-[20px]" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          /* Inbox Header */
          <motion.div
            key="inbox-header"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="shrink-0"
            data-chat-header
          >
            {/* Mobile drag pill */}
            {mobileLayout && (
              <motion.div
                role="presentation"
                aria-hidden
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.35 }}
                onDragEnd={(_e, info) => pullToClose(info)}
                className="flex w-full cursor-grab touch-none justify-center bg-[var(--nav-bg)] pb-1 pt-2 active:cursor-grabbing"
              >
                <span className="h-1 w-10 rounded-full bg-white/20" />
              </motion.div>
            )}
            <motion.div {...headerSwipeProps} className="bg-[var(--nav-bg)] px-3 pb-2.5 pt-2 sm:px-4 sm:pb-3 sm:pt-3 touch-pan-y">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-[16px] font-semibold tracking-tight text-[var(--nav-text)] sm:text-[18px]">Chats</h2>
                  {inbox.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-[var(--nav-text)]/70 sm:text-[12px]">
                      {inbox.filter(c => c.unread_count > 0).length > 0
                        ? `${inbox.filter(c => c.unread_count > 0).length} unread`
                        : `${inbox.length} chat${inbox.length > 1 ? 's' : ''}`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={dismissOverlay}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--nav-text)]/90 transition-colors hover:bg-white/10 active:bg-white/15"
                  aria-label="Close"
                >
                  <X className="size-[20px]" />
                </button>
              </div>
            </motion.div>
            <div className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)] px-2 py-1.5 sm:px-3 sm:py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-[15px] -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="search"
                  enterKeyHint="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full rounded-lg border-0 bg-[var(--bg-primary)] py-2 pl-8 pr-2.5 text-[13px] placeholder:text-[11px] placeholder:font-normal text-[var(--text-primary)] shadow-sm outline-none ring-1 ring-[var(--glass-border)] placeholder:text-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent)]/40 sm:py-2.5"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -- PRODUCT CONTEXT ---------------------------------------- */}
      {activePartnerId && product && (
        <div className="shrink-0 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-2 sm:px-4">
          <div className="flex items-center gap-3">
            <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-primary)] ring-1 ring-[var(--glass-border)] sm:size-11">
              <img src={product.images?.[0]?.url || product.images?.[0]} className="size-full object-cover" alt="" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">Product</p>
              <h4 className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{product.name}</h4>
              <p className="text-[11px] text-[var(--text-secondary)]">{(product.price || 0).toLocaleString()} XAF</p>
            </div>
            <button type="button" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-primary)] text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--glass-border)] transition active:bg-[var(--bg-secondary)]">
              <Package className="size-[17px]" />
            </button>
          </div>
        </div>
      )}

      {/* -- SCROLLABLE BODY (inbox list OR chat messages) ---------- */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        {...(activePartnerId ? { 'data-chat-messages': true } : {})}
        style={{ flex: 1, minHeight: 0, contain: 'layout style paint', scrollbarGutter: 'stable', willChange: 'transform' }}
        className={[
          'min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain',
          activePartnerId ? 'chat-bg-pattern chat-scrollbar' : 'bg-[var(--bg-secondary)]',
        ].join(' ')}
      >
        {!activePartnerId ? (
          /* - Inbox list - */
          <div className="p-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:p-3">
            <div className="space-y-px overflow-hidden rounded-xl bg-[var(--bg-primary)] shadow-sm ring-1 ring-[var(--glass-border)]">
              {filteredInbox.length === 0 ? (
                <div className="bg-[var(--bg-primary)] px-6 py-16 text-center">
                  <MessageCircle className="mx-auto mb-4 size-14 text-[var(--text-secondary)]" />
                  <p className="text-[15px] font-medium text-[var(--text-primary)]">
                    {inboxLoading ? 'Chats will appear here' : 'No chats yet'}
                  </p>
                  <p className="mt-2 text-[13px] leading-snug text-[var(--text-secondary)]">
                    {inboxLoading ? 'Your saved chats stay visible as they sync.' : 'Start a conversation from a product or store.'}
                  </p>
                </div>
              ) : (
                filteredInbox.map((chat, i) => (
                  <button
                    key={chat._id || i}
                    type="button"
                    onClick={() => {
                      setActiveConversation(chat.partner?._id, chat.partner);
                      if (chat.isSystemWide) setPartnerBInfo(chat.partnerB);
                    }}
                    className={`flex w-full items-center gap-3 border-b border-[var(--glass-border)] px-3 py-2.5 text-left transition-colors active:bg-[var(--bg-secondary)] sm:gap-4 sm:px-4 sm:py-3 ${
                      chat.unread_count > 0 ? 'bg-[var(--accent)]/[0.08]' : 'bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-[var(--component-bg)] sm:size-12">
                      {chat.partner?.avatar || chat.partner?.branding?.logo || chat.partner?.store?.logo
                        ? <img src={chat.partner?.avatar || chat.partner?.branding?.logo || chat.partner?.store?.logo} className="size-full object-cover" alt="" />
                        : <div className="flex size-full items-center justify-center text-lg font-semibold text-[var(--text-secondary)]">{(chat.partner?.store_name || chat.partner?.name || 'U')[0]}</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-start justify-between gap-2">
                        <h4 className={`truncate text-[14px] capitalize sm:text-[15px] ${chat.unread_count > 0 ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]'}`}>
                          {chat.isSystemWide
                            ? `${chat.partner?.name} & ${chat.partnerB?.name}`
                            : (chat.partner?.store_name || chat.partner?.name)}
                        </h4>
                        <span className="shrink-0 pt-0.5 text-[10px] text-[var(--text-secondary)] sm:text-[11px]">
                          {new Date(chat.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`min-w-0 flex-1 truncate text-[12px] leading-snug sm:text-[13px] ${chat.unread_count > 0 ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                          {chat.snippet
                            ? ((chat.last_message?.sender_id?._id || chat.last_message?.sender_id)?.toString() === user?._id?.toString()
                                ? `You: ${chat.snippet}`
                                : chat.snippet)
                            : 'Tap to open'}
                        </p>
                        {chat.unread_count > 0 && (
                          <span className="flex size-[20px] shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-semibold text-white">
                            {chat.unread_count > 99 ? '99+' : chat.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* - Messages - */
          <div className="mx-auto w-full max-w-4xl space-y-0.5 px-2 pb-4 pt-2 sm:space-y-1 sm:px-4 sm:pb-6">
            {messages.length === 0 && loading && hasSeedPartnerData ? null : messages.length === 0 ? (
              <div className="flex min-h-[42dvh] flex-col items-center justify-center px-8 py-16 text-center">
                <MessageCircle className="mb-4 size-12 text-[var(--text-secondary)]/70" />
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Start the conversation
                </p>
                <p className="mt-1 max-w-[280px] text-[13px] leading-snug text-[var(--text-secondary)]">
                  Send a message or pick a quick reply below.
                </p>
              </div>
            ) : (
              <>
              {messages.map((msg, i) => {
                const prevMsg = messages[i - 1];
                const nextMsg = messages[i + 1];
                const isOwn = (msg.sender_id?._id || msg.sender_id)?.toString() === user?._id?.toString();
                const showDate = !prevMsg || !sameDay(prevMsg.createdAt, msg.createdAt);
                const withPrev = sameGroup(prevMsg, msg);
                const withNext = sameGroup(msg, nextMsg);
                const rounding = bubbleRounding(isOwn, withPrev, withNext);
                const canDeleteMessage = Boolean(
                  msg._id &&
                  !msg._id.toString().startsWith('opt-') &&
                  msg.status !== 'sending'
                );

                return (
                  <div key={msg.client_id || msg.clientId || msg._id || i}>
                    {showDate && (
                      <div className="my-3 flex justify-center sm:my-5">
                        <span className="rounded-lg bg-[var(--bg-primary)]/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--glass-border)] sm:text-[11px]">
                          {fmtDate(msg.createdAt)}
                        </span>
                      </div>
                    )}

                    <div className={`flex w-full min-w-0 ${isOwn ? 'justify-end' : 'justify-start'} ${withNext ? 'mb-0.5' : 'mb-1.5 sm:mb-2.5'}`}>
                      <div className={`flex min-w-0 max-w-[88%] flex-col gap-0.5 sm:max-w-[72%] lg:max-w-[68%] ${isOwn ? 'items-end' : 'items-start'}`}>

                        <motion.div
                          initial={mobileLayout ? false : { opacity: 0, scale: 0.96, y: 8 }}
                          animate={mobileLayout ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                          transition={mobileLayout ? { duration: 0.08, ease: 'easeOut' } : { type: 'spring', stiffness: 350, damping: 28 }}
                          className={`
                            group relative min-w-[76px] max-w-full overflow-hidden px-2.5 py-1.5 pr-7 text-[13px] leading-snug break-words [overflow-wrap:anywhere]
                            shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] transition-colors duration-200
                            hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]
                            sm:px-3 sm:py-2 sm:pr-8 sm:text-[14.5px]
                            ${isOwn
                              ? 'border border-[var(--accent)]/25 bg-[var(--accent)]/12 text-[var(--text-primary)] hover:border-[var(--accent)]/35'
                              : 'border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-primary)]'}
                            ${rounding}
                          `}
                        >
                          {!msg.deleted_everyone && canDeleteMessage && (
                            <button
                              type="button"
                              onClick={(e) => openMessageMenu(e, msg, isOwn)}
                              className={`absolute right-1 top-1 flex size-5 items-center justify-center rounded bg-black/[0.03] text-[var(--text-secondary)] transition-opacity hover:bg-black/[0.08] md:opacity-0 md:group-hover:opacity-60 ${activeMenuMsgId === msg._id ? 'opacity-100' : 'opacity-70'}`}
                              aria-label="Message options"
                            >
                              <MoreVertical className="size-3" />
                            </button>
                          )}


                          {storyReplyMeta(msg) && (
                            <button
                              type="button"
                              onClick={() => openStoryReply(msg)}
                              className="mb-2 w-full overflow-hidden rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 p-2.5 text-left transition-colors active:bg-[var(--accent)]/15"
                            >
                              <div className="flex items-center gap-2">
                                {storyReplyMeta(msg).storyType === 'image' && storyPreviewSource(storyReplyMeta(msg)) ? (
                                  <img src={storyPreviewSource(storyReplyMeta(msg))} className="size-10 rounded-lg object-cover" alt="" />
                                ) : storyReplyMeta(msg).storyType === 'video' && storyThumbnailSource(storyReplyMeta(msg)) ? (
                                  <div className="relative size-10 overflow-hidden rounded-lg">
                                    <img src={storyThumbnailSource(storyReplyMeta(msg))} className="size-full object-cover" alt="" />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-[9px] font-bold uppercase tracking-wide text-white">Video</span>
                                  </div>
                                ) : (
                                  <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--accent)]/15">
                                    <MessageCircle className="size-4 text-[var(--accent)]" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">Story reply</p>
                                  <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--text-primary)]">
                                    {storyReplyMeta(msg).storyType === 'text'
                                      ? storyReplyMeta(msg).storyPreview
                                      : storyReplyMeta(msg).storyCaption || storyReplyMeta(msg).storyCategory || 'Replied to a story'}
                                  </p>
                                </div>
                              </div>
                            </button>
                          )}

                          {msg.image_url && (
                            <button
                              type="button"
                              onClick={() => !msg._uploading && setMediaPreview({ mode: 'view', url: msg.image_url, caption: msg.text || '' })}
                              className="-mx-0.5 mb-2 block overflow-hidden rounded-md border border-black/10 text-left relative"
                              aria-label="Preview shared image"
                            >
                              <img src={msg.image_url} className={`max-h-60 w-full object-cover ${msg._uploading ? 'opacity-60' : ''}`} alt="Shared" />
                              {msg._uploading && (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <Loader2 className="size-7 animate-spin text-white drop-shadow" />
                                </span>
                              )}
                            </button>
                          )}

                          {msg.product_reference && !withPrev && (
                            <button type="button" className="mb-2 flex w-full items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] p-2 text-left">
                              <img
                                src={msg.product_reference.images?.[0]?.url || msg.product_reference.images?.[0]}
                                className="size-10 rounded object-cover"
                                alt=""
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{msg.product_reference.name}</p>
                                <p className="text-[11px] text-[var(--text-secondary)]">{(msg.product_reference.price || 0).toLocaleString()} XAF</p>
                              </div>
                            </button>
                          )}

                          {msg.deleted_everyone ? (
                            <p className="whitespace-pre-wrap break-words text-[13px] italic text-[var(--text-secondary)]/60 [overflow-wrap:anywhere] sm:text-[14.5px]">
                              This message was deleted
                            </p>
                          ) : msg.text ? (
                            <p className="whitespace-pre-wrap break-words text-[13px] [overflow-wrap:anywhere] sm:text-[14.5px]">{msg.text}</p>
                          ) : null}

                          <div className={`mt-0.5 flex items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'} text-[10px] tabular-nums text-[var(--text-secondary)] sm:mt-1 sm:text-[11px]`}>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isOwn && (
                              msg.status === 'failed'
                                ? <AlertCircle className="size-3.5 text-red-500" />
                                : msg.status === 'queued'
                                  ? <WifiOff className="size-3 text-amber-500/70 transition-colors duration-300" />
                                  : msg.status === 'sending'
                                  ? <Clock className="size-3 text-[var(--text-secondary)]/50 transition-colors duration-300" />
                                  : msg.read_status
                                    ? <CheckCheck className="size-3.5 text-emerald-500 drop-shadow-[0_0_2px_rgba(16,185,129,0.3)] transition-colors duration-300" />
                                    : msg.delivered_status
                                      ? <CheckCheck className="size-3.5 text-[var(--text-secondary)]/60 transition-colors duration-300" />
                                      : <Check className="size-3.5 text-[var(--text-secondary)]/60 transition-colors duration-300" />
                            )}
                          </div>
                        </motion.div>

                        {msg.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleSend(msg.text)}
                            className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 ring-1 ring-red-200 transition-colors active:bg-red-100"
                          >
                            <AlertCircle className="size-3.5 shrink-0" /> Retry send
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {partnerTyping && (
                <div className="mt-1 flex w-full justify-start">
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-[12px] text-[var(--text-secondary)] shadow-sm"
                    aria-live="polite"
                  >
                    <span className="flex gap-1">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className="size-1.5 rounded-full bg-[var(--accent)]/70"
                          animate={{ y: [0, -4, 0], opacity: [0.55, 1, 0.55] }}
                          transition={{ repeat: Infinity, duration: 0.9, delay: dot * 0.14 }}
                        />
                      ))}
                    </span>
                    <span>{partnerName} is typing</span>
                  </motion.div>
                </div>
              )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* -- COMPOSER (only in an active chat) --------------------- */}
      {activePartnerId && (
        <div
          data-chat-composer
          className="shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]"
          style={{
            paddingBottom: viewportHeight?.mode === 'keyboard'
              ? '0px'
              : 'env(safe-area-inset-bottom, 0px)',
            flexShrink: 0,
            backgroundColor: 'var(--bg-secondary)',
            contain: 'layout style paint',
          }}
        >
          {/* Quick replies */}
          {messages.length < 5 && !input && (
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-[var(--glass-border)] px-2 py-2 sm:px-3" style={{ contain: 'layout style paint' }}>
              {QUICK_REPLIES.map(q => (
                <motion.button
                  key={q}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSend(q); }}
                  className="shrink-0 whitespace-nowrap rounded-full bg-[var(--bg-primary)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--accent)] shadow-sm ring-1 ring-[var(--glass-border)] transition-colors active:bg-[var(--bg-secondary)] sm:px-3 sm:py-1.5 sm:text-[12px]"
                >
                  {q}
                </motion.button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="mx-auto flex w-full max-w-4xl min-w-0 items-end gap-1.5 px-2 pb-1 pt-1.5 sm:gap-2 sm:px-3 sm:pb-1.5 sm:pt-2" style={{ contain: 'layout style paint' }}>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

            <motion.button
              type="button"
              whileHover={composerBusy ? {} : { scale: 1.08, rotate: 8 }}
              whileTap={composerBusy ? {} : { scale: 0.92 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={composerBusy}
              className="mb-0 flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-primary)] hover:text-[var(--accent)] active:bg-[var(--bg-primary)] disabled:opacity-50"
              aria-label="Attach image"
            >
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImageIcon className="size-[20px]" />}
            </motion.button>

            <div className="relative flex min-h-[42px] min-w-0 flex-1 items-end overflow-hidden rounded-[22px] bg-[var(--bg-primary)] shadow-sm ring-1 ring-[var(--glass-border)] transition-all duration-200 focus-within:ring-2 focus-within:ring-[var(--accent)]/35">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => handleTyping(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message"
                rows={1}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                spellCheck={false}
                className="max-h-[88px] min-h-[42px] w-full min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-[14px] leading-snug text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                style={{ height: 'auto', contain: 'layout style paint', willChange: 'height' }}
                onFocus={() => {
                  // Immediate — before keyboard starts rising
                  viewportSyncRef.current?.();
                  keepChatInView('auto');
                  // Mid-animation — catches most Android keyboards
                  setTimeout(() => { viewportSyncRef.current?.(); keepChatInView('auto'); }, 250);
                  // Fully open — catches iOS spring animation finish
                  setTimeout(() => { viewportSyncRef.current?.(); keepChatInView('auto'); }, 520);
                  // Pull any pending messages the moment the user taps to type — zero send-latency impact
                  syncActivePid(activePartnerIdRef.current);
                }}
                onBlur={() => {
                  setTimeout(() => viewportSyncRef.current?.(), 100);
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 88)}px`;
                  keepChatInView('auto');
                }}
              />
            </div>

            <motion.button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              whileHover={composerBusy || !trimmedInput ? {} : { scale: 1.05 }}
              whileTap={composerBusy || !trimmedInput ? {} : { scale: 0.92 }}
              onClick={() => handleSend()}
              disabled={composerBusy || !trimmedInput}
              aria-busy={pendingSendCount > 0 || uploading}
              className="mb-0 flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25 transition-all hover:shadow-[var(--accent)]/40 disabled:bg-[var(--text-secondary)] disabled:opacity-80 disabled:shadow-none"
              aria-label="Send"
            >
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-[18px]" />}
            </motion.button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {mediaPreview && (
          <motion.div
            className="fixed inset-0 z-[900] flex flex-col bg-black/95 text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex shrink-0 items-center justify-between px-3 py-3 sm:px-5">
              <button
                type="button"
                onClick={closeMediaPreview}
                className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
                aria-label="Close media preview"
              >
                <X className="size-5" />
              </button>
              <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-white/60">
                {mediaPreview.mode === 'compose' ? 'Preview' : 'Media'}
              </span>
              <div className="size-10" />
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center p-2 sm:p-6">
              <img
                src={mediaPreview.url}
                className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
                alt="Chat media preview"
              />
            </div>

            {mediaPreview.mode === 'compose' ? (
              <div className="shrink-0 border-t border-white/10 bg-black/90 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-5">
                <div className="mx-auto flex max-w-3xl items-end gap-2">
                  <textarea
                    value={mediaPreview.caption || ''}
                    onChange={(event) => setMediaPreview((current) => current ? { ...current, caption: event.target.value } : current)}
                    placeholder="Add a caption"
                    rows={1}
                    className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-[16px] leading-snug text-white outline-none placeholder:text-white/45 focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={sendPreviewMedia}
                    disabled={uploading}
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25 disabled:opacity-60"
                    aria-label="Send image"
                  >
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
                  </button>
                </div>
              </div>
            ) : mediaPreview.caption ? (
              <div className="shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-center text-[14px] text-white/80">
                {mediaPreview.caption}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {storyViewer.statuses && (
          <StatusViewer
            initialStatuses={storyViewer.statuses}
            initialStoryId={storyViewer.storyId}
            onClose={() => setStoryViewer({ statuses: null, storyId: null })}
          />
        )}
      </AnimatePresence>

    </motion.div>
  );
}
