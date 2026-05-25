"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, X, ArrowLeft, Package,
  MessageCircle, CheckCheck, Loader2, 
  Search, Trash2, Image as ImageIcon, AlertCircle, MoreVertical
} from 'lucide-react';
import api from '@/services/api';
import { uploadService } from '@/services/upload';
import { useAuthStore } from '@/hooks/useAuth';
import { toId, useChat } from '@/context/ChatContext';
import socketService from '@/services/socket';
import { QUICK_REPLIES, fmtDate, sameDay, sameGroup, bubbleRounding } from './chat/ChatUtils';
import { toast } from 'react-hot-toast';


/**
 * MessagingHub - Premium Global Messaging Center
 * Features: Infinite scroll, typing indicators, grouped bubbles, and search.
 */
export default function MessagingHub({ vendorId: initialVendorId, product, initialData, onClose, fullPage = false }) {
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
    markConversationRead,
    deleteMessage,
    syncInboxFromServer,
  } = useChat();
  // -- State --
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [partnerBInfo, setPartnerBInfo] = useState(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // UX Features
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const activePartnerIdRef = useRef(activePartnerId);
  const messagesRef = useRef(activeMessages);
  const initialChatSyncRef = useRef(null);
  const initialHeightRef = useRef(0);

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
  const [mobileLayout, setMobileLayout] = useState(false);
  const inbox = conversations;
  const messages = activeMessages;
  const partnerInfo = activeConversation?.partner || initialData || null;
  const partnerTyping = Boolean(activePartnerId && typingIndicators[activePartnerId]);
  const latestMessageKey = messages.length
    ? messages[messages.length - 1]?._id || messages[messages.length - 1]?.client_id || messages[messages.length - 1]?.createdAt
    : null;
  const draftKey = user?._id && activePartnerId ? `aura_chat_draft:${user._id}:${activePartnerId}` : null;
  const trimmedInput = input.trim();
  const initialVendorKey = initialVendorId?.toString?.() || '';
  const initialDataKey = toId(initialData) || '';

  useEffect(() => {
    activePartnerIdRef.current = activePartnerId;
  }, [activePartnerId]);

  useEffect(() => {
    messagesRef.current = activeMessages;
  }, [activeMessages]);

  useEffect(() => {
    if (!activePartnerId || loadingMore || loading) return;
    scrollToBottom(mobileLayout ? 'auto' : 'smooth');
  }, [activePartnerId, latestMessageKey, loading, loadingMore, mobileLayout]);

  useEffect(() => {
    if (!activePartnerId) return;

    const requestPresence = () => {
      socketService.emit('check_online_status', { userId: activePartnerId.toString() });
    };

    requestPresence();
    const retries = [750, 2000, 5000].map((delay) => setTimeout(requestPresence, delay));
    socketService.on('connect', requestPresence);
    return () => {
      retries.forEach(clearTimeout);
      socketService.off('connect', requestPresence);
    };
  }, [activePartnerId]);

  useEffect(() => {
    if (!draftKey || typeof window === 'undefined') {
      setInput('');
      return;
    }

    setInput(localStorage.getItem(draftKey) || '');
  }, [draftKey]);

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

    const root = document.documentElement;
    const setViewportVars = () => {
      const viewport = window.visualViewport;
      const layoutHeight = window.innerHeight || document.documentElement.clientHeight || viewport?.height || 0;
      if (layoutHeight > initialHeightRef.current) {
        initialHeightRef.current = layoutHeight;
      }
      const initialHeight = initialHeightRef.current || layoutHeight;
      const visualHeight = viewport?.height || layoutHeight;
      const visualTop = viewport?.offsetTop || 0;
      const keyboardInset = Math.max(0, initialHeight - visualHeight - visualTop);
      const activeElement = document.activeElement;
      const editingText = activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName);
      const keyboardOpen = editingText && (keyboardInset > 80 || layoutHeight - visualHeight > 80);
      const top = keyboardOpen ? visualTop : 0;
      const bottom = keyboardOpen ? keyboardInset : 0;
      const height = Math.max(0, initialHeight - top - bottom);

      root.style.setProperty('--aura-chat-vvh', `${Math.round(height)}px`);
      root.style.setProperty('--aura-chat-vvtop', `${Math.round(top)}px`);
      root.style.setProperty('--aura-chat-vvbottom', `${Math.round(bottom)}px`);
      root.style.setProperty('--aura-chat-composer-bottom-pad', keyboardOpen ? '2.5cm' : 'max(0.5rem, env(safe-area-inset-bottom))');

      if (keyboardOpen && activePartnerIdRef.current) {
        requestAnimationFrame(() => {
          pinToLatestMessage('auto');
        });
        queuePinToLatest([80, 180, 320, 520]);
      }
    };

    setViewportVars();
    window.visualViewport?.addEventListener('resize', setViewportVars);
    window.visualViewport?.addEventListener('scroll', setViewportVars);
    window.addEventListener('resize', setViewportVars);

    return () => {
      window.visualViewport?.removeEventListener('resize', setViewportVars);
      window.visualViewport?.removeEventListener('scroll', setViewportVars);
      window.removeEventListener('resize', setViewportVars);
      root.style.removeProperty('--aura-chat-vvh');
      root.style.removeProperty('--aura-chat-vvtop');
      root.style.removeProperty('--aura-chat-vvbottom');
      root.style.removeProperty('--aura-chat-composer-bottom-pad');
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
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior });
    }
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
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
      loadConversation(activePartnerId, 1);
    } else {
      loadInbox();
    }
  }, [activePartnerId, isSystemWide]);

  useEffect(() => {
    if (!activePartnerId) return;

    let stopped = false;
    const pollIfSocketUnavailable = () => {
      if (stopped || socketService.isConnected()) return;
      loadConversation(activePartnerId, 1, {
        silent: true,
        skipProfile: true,
        skipPresence: true,
      });
    };

    const warmup = setTimeout(pollIfSocketUnavailable, 1500);
    const interval = setInterval(pollIfSocketUnavailable, 10000);

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

      const [chatRes, partnerRes] = await Promise.all([
        api.get(chatEndpoint),
        pageNum === 1 && !options.skipProfile ? api.get(`/auth/users/${pid}`).catch(() => null) : Promise.resolve(null)
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
          const previousLastId = messagesRef.current[messagesRef.current.length - 1]?._id ||
            messagesRef.current[messagesRef.current.length - 1]?.client_id;
          const incomingLastId = newMsgs[newMsgs.length - 1]?._id || newMsgs[newMsgs.length - 1]?.client_id;
          upsertMessages(pid, newMsgs);
          setHasMore(newMsgs.length < total);
          if (!silent || (incomingLastId && incomingLastId !== previousLastId)) {
            scrollToBottom(silent ? 'smooth' : 'auto');
          }
          markAsRead(pid);
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
      }
    } catch (err) {
      console.error('Delete message failed:', err);
    }
  };

  // -- Typing Logic --
  const handleTyping = (val) => {
    setInput(val);
    if (!activePartnerId) return;

    if (!isTyping) {
      setIsTyping(true);
      socketService.emit('typing_start', { receiver_id: activePartnerId });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.emit('typing_stop', { receiver_id: activePartnerId });
    }, 2000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activePartnerId) return;

    setUploading(true);
    try {
      const res = await uploadService.uploadSingle(file, 'general');
      if (res.success) {
        await handleSend('', res.data.url);
      } else {
        throw new Error(res.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async (customText = null, imageUrl = null) => {
    const text = (customText || input).trim();
    if ((!text && !imageUrl) || !activePartnerId || sending || (uploading && !imageUrl)) return;
    const sendPartnerId = activePartnerId.toString();
    const sentDraftKey = draftKey;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socketService.emit('typing_stop', { receiver_id: activePartnerId });

    setSending(true);
    const optimisticMsg = {
      _id: `opt-${Date.now()}`,
      client_id: `client-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      image_url: imageUrl,
      sender_id: user?._id,
      receiver_id: sendPartnerId,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    receiveMessage(optimisticMsg, {
      partnerId: sendPartnerId,
      isActive: true,
    });
    setInput('');
    if (sentDraftKey && typeof window !== 'undefined') localStorage.removeItem(sentDraftKey);
    queuePinToLatest([0, 60, 140, 260, 420]);

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
      markMessageFailed(sendPartnerId, optimisticMsg._id);
      if (sentDraftKey && text && typeof window !== 'undefined') localStorage.setItem(sentDraftKey, text);
    } finally {
      setSending(false);
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

  const partnerName = (partnerInfo?.store_name || partnerInfo?.branding?.store_name || partnerInfo?.name || 'User').toString();
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
  const partnerRecentlyActive = lastPartnerMessageAt
    ? Date.now() - new Date(lastPartnerMessageAt).getTime() < 2 * 60 * 1000
    : false;
  const socketConnected = socketService.isConnected();
  const formatLastSeen = (value) => {
    if (!value) return 'offline';
    const last = new Date(value).getTime();
    if (!Number.isFinite(last)) return 'offline';
    const diff = Date.now() - last;
    if (diff < 60 * 1000) return 'last seen just now';
    if (diff < 60 * 60 * 1000) return `last seen ${Math.max(1, Math.floor(diff / 60000))}m ago`;
    if (diff < 24 * 60 * 60 * 1000) return `last seen ${Math.floor(diff / 3600000)}h ago`;
    return `last seen ${new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };
  const partnerIdStr = activePartnerId?.toString();
  const liveOnline = partnerIdStr ? onlineUsersMap[partnerIdStr] : undefined;
  const isOnline = typeof liveOnline === 'boolean' ? liveOnline : (partnerInfo?.is_online === true);

  const partnerStatus = (() => {
    if (partnerTyping || isOnline || partnerRecentlyActive) {
      return { label: 'online', className: 'text-emerald-400' };
    }
    return { label: formatLastSeen(partnerInfo?.last_seen || partnerInfo?.lastSeen), className: 'text-[var(--nav-text)]/55' };
  })();
  const composerBusy = sending || uploading;

  const dismissOverlay = () => {
    setChatMenuOpen(false);
    setActiveConversation(null);
    onClose?.();
  };

  const goBackOrClose = () => {
    setChatMenuOpen(false);
    if (activePartnerId) {
      setActiveConversation(null);
    } else {
      dismissOverlay();
    }
  };

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
        top: 'var(--aura-chat-vvtop, 0px)',
        bottom: 'var(--aura-chat-vvbottom, 0px)',
        height: 'auto',
        minHeight: 0,
        maxHeight: 'none',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }
    : undefined;

  const outerClass = fullPage
    ? [
        'flex min-h-0 w-full flex-col overflow-hidden bg-[var(--bg-secondary)] touch-manipulation',
        'max-md:fixed max-md:inset-0 max-md:w-full',
        'max-md:h-[var(--aura-chat-vvh,100dvh)] max-md:max-h-[var(--aura-chat-vvh,100dvh)]',
        'md:h-full md:flex-1',
      ].join(' ')
    : [
        'fixed z-[600] flex min-h-0 flex-col overflow-hidden bg-[var(--bg-secondary)] touch-manipulation overscroll-contain',
        'max-md:inset-0 max-md:h-[var(--aura-chat-vvh,100dvh)] max-md:max-h-[var(--aura-chat-vvh,100dvh)] max-md:w-full',
        'max-md:rounded-none max-md:border-0 max-md:shadow-none',
        'md:left-auto md:right-5 md:top-[max(1rem,env(safe-area-inset-top))] md:bottom-5',
        'md:h-[min(86dvh,760px)] md:max-h-[86dvh] md:w-[min(440px,calc(100vw-2.5rem))]',
        'md:rounded-2xl md:border md:border-[var(--glass-border)] md:shadow-[0_24px_72px_rgba(0,0,0,0.28)]',
      ].join(' ');

  return (
    <motion.div
      style={mobileShellStyle}
      onTouchStart={handlePanelTouchStart}
      onTouchEnd={handlePanelTouchEnd}
      {...(!fullPage
        ? {
            initial: { opacity: 0, y: 18 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: 16 },
          }
        : {})}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className={outerClass}
    >

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activePartnerId ? (
          /* Chat Header */
          <motion.div
            key="chat-header"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
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
                      : <div className="flex size-full items-center justify-center text-sm font-semibold text-[var(--nav-text)]">{partnerName[0]}</div>}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[14px] font-semibold leading-tight text-[var(--nav-text)] capitalize sm:text-[15px]">
                    {isSystemWide && partnerBInfo
                      ? <span>{partnerName} <span className="text-[var(--nav-text)]/40">&</span> {partnerBInfo?.name}</span>
                      : partnerName}
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
                    onClick={() => setChatMenuOpen(open => !open)}
                    className="flex size-9 items-center justify-center rounded-full text-[var(--nav-text)]/80 transition-colors hover:bg-white/10 active:bg-white/15"
                    aria-label="Chat options"
                    aria-expanded={chatMenuOpen}
                  >
                    <MoreVertical className="size-[18px]" />
                  </button>
                  {chatMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setChatMenuOpen(false)} />
                      <div className="absolute right-0 top-10 z-50 min-w-[190px] rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-1.5 text-[var(--text-primary)] shadow-xl ring-1 ring-black/5">
                        <button
                          type="button"
                          onClick={() => {
                            setChatMenuOpen(false);
                            if (confirm('Delete this conversation from your inbox?')) hideConversation(activePartnerId.toString());
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/20 whitespace-nowrap"
                        >
                          <Trash2 className="size-4" />
                          Delete conversation
                        </button>
                      </div>
                    </>
                  )}
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
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
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
                  className="w-full rounded-lg border-0 bg-[var(--bg-primary)] py-2 pl-8 pr-2.5 text-[13px] text-[var(--text-primary)] shadow-sm outline-none ring-1 ring-[var(--glass-border)] placeholder:text-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent)]/40 sm:py-2.5 sm:text-[14px]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PRODUCT CONTEXT ──────────────────────────────────────── */}
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

      {/* ── SCROLLABLE BODY (inbox list OR chat messages) ────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        {...(activePartnerId ? { 'data-chat-messages': true } : {})}
        className={[
          'min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain',
          activePartnerId ? 'chat-bg-pattern chat-scrollbar' : 'bg-[var(--bg-secondary)]',
        ].join(' ')}
      >
        {!activePartnerId ? (
          /* ─ Inbox list ─ */
          <div className="p-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:p-3">
            <div className="space-y-px overflow-hidden rounded-xl bg-[var(--bg-primary)] shadow-sm ring-1 ring-[var(--glass-border)]">
              {inboxLoading ? (
                <div className="flex flex-col items-center gap-4 bg-[var(--bg-primary)] py-20">
                  <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
                  <p className="text-[13px] font-medium text-[var(--text-secondary)]">Loading chats...</p>
                </div>
              ) : filteredInbox.length === 0 ? (
                <div className="bg-[var(--bg-primary)] px-6 py-16 text-center">
                  <MessageCircle className="mx-auto mb-4 size-14 text-[var(--text-secondary)]" />
                  <p className="text-[15px] font-medium text-[var(--text-primary)]">No chats yet</p>
                  <p className="mt-2 text-[13px] leading-snug text-[var(--text-secondary)]">Start a conversation from a product or store.</p>
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
                          {chat.snippet || 'Tap to open'}
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
          /* ─ Messages ─ */
          <div className="mx-auto w-full max-w-4xl space-y-0.5 px-2 pb-4 pt-2 sm:space-y-1 sm:px-4 sm:pb-6">
            {loadingMore && (
              <div className="flex justify-center py-3">
                <Loader2 className="size-4 animate-spin text-[var(--text-secondary)]" />
              </div>
            )}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 opacity-60">
                <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[42dvh] flex-col items-center justify-center px-8 py-16 text-center">
                <MessageCircle className="mb-4 size-12 text-[var(--text-secondary)]/70" />
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">Start the conversation</p>
                <p className="mt-1 max-w-[280px] text-[13px] leading-snug text-[var(--text-secondary)]">Send a message or pick a quick reply below.</p>
              </div>
            ) : (
              messages.map((msg, i) => {
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
                  <div key={msg._id || i}>
                    {showDate && (
                      <div className="my-3 flex justify-center sm:my-5">
                        <span className="rounded-lg bg-[var(--bg-primary)]/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--glass-border)] sm:text-[11px]">
                          {fmtDate(msg.createdAt)}
                        </span>
                      </div>
                    )}

                    <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} ${withNext ? 'mb-0.5' : 'mb-1.5 sm:mb-2.5'}`}>
                      <div className={`flex max-w-[88%] flex-col gap-0.5 sm:max-w-[72%] lg:max-w-[68%] ${isOwn ? 'items-end' : 'items-start'}`}>

                        <motion.div
                          initial={{ opacity: 0, scale: 0.96, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                          className={`
                            group relative min-w-[76px] px-2.5 py-1.5 pr-7 text-[13px] leading-snug
                            shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] transition-all duration-300
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
                              onClick={(e) => { e.stopPropagation(); setActiveMenuMsgId(activeMenuMsgId === msg._id ? null : msg._id); }}
                              className={`absolute right-1 top-1 flex size-5 items-center justify-center rounded bg-black/[0.03] text-[var(--text-secondary)] transition-opacity hover:bg-black/[0.08] ${activeMenuMsgId === msg._id ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                              aria-label="Message options"
                            >
                              <MoreVertical className="size-3" />
                            </button>
                          )}

                          {activeMenuMsgId === msg._id && (
                            <>
                              <div className="fixed inset-0 z-[45] cursor-default bg-transparent" onClick={(e) => { e.stopPropagation(); setActiveMenuMsgId(null); }} />
                              <div
                                className={`absolute z-50 min-w-[130px] rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] p-1 shadow-lg ring-1 ring-black/5 ${isOwn ? 'right-1 top-6' : 'left-1 top-6'}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg._id, 'me')}
                                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11.5px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                                >
                                  <Trash2 className="size-3 text-[var(--text-secondary)]" /> Delete for me
                                </button>
                                {isOwn && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMessage(msg._id, 'everyone')}
                                    className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11.5px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                  >
                                    <Trash2 className="size-3 text-red-500" /> Delete for everyone
                                  </button>
                                )}
                              </div>
                            </>
                          )}

                          {msg.image_url && (
                            <div className="-mx-0.5 mb-2 overflow-hidden rounded-md border border-black/10">
                              <img src={msg.image_url} className="max-h-60 w-full object-cover" alt="Shared" />
                            </div>
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
                            <p className="italic text-[var(--text-secondary)]/60 whitespace-pre-wrap text-[13px] sm:text-[14.5px]">
                              This message was deleted
                            </p>
                          ) : msg.text ? (
                            <p className="whitespace-pre-wrap text-[13px] sm:text-[14.5px]">{msg.text}</p>
                          ) : null}

                          <div className={`mt-0.5 flex items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'} text-[10px] tabular-nums text-[var(--text-secondary)] sm:mt-1 sm:text-[11px]`}>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isOwn && (
                              msg.status === 'failed'
                                ? <AlertCircle className="size-3.5 text-red-600" />
                                : <CheckCheck className={`size-3.5 transition-colors duration-300 ${msg.read_status ? 'text-emerald-500 drop-shadow-[0_0_2px_rgba(16,185,129,0.3)]' : 'text-[var(--text-secondary)]/50'}`} />
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
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── COMPOSER (only in an active chat) ───────────────────── */}
      {activePartnerId && (
        <div
          data-chat-composer
          className="shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/95 backdrop-blur-sm"
          style={{ paddingBottom: 'var(--aura-chat-composer-bottom-pad, max(0.5rem, env(safe-area-inset-bottom)))' }}
        >
          {/* Quick replies */}
          {messages.length < 5 && !input && (
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-[var(--glass-border)] px-2 py-2 sm:px-3">
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
          <div className="mx-auto flex w-full max-w-4xl items-end gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2.5">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

            <motion.button
              type="button"
              whileHover={composerBusy ? {} : { scale: 1.08, rotate: 8 }}
              whileTap={composerBusy ? {} : { scale: 0.92 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={composerBusy}
              className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-primary)] hover:text-[var(--accent)] active:bg-[var(--bg-primary)] disabled:opacity-50"
              aria-label="Attach image"
            >
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImageIcon className="size-[20px]" />}
            </motion.button>

            <div className="relative flex min-h-[42px] flex-1 items-end overflow-hidden rounded-[22px] bg-[var(--bg-primary)] shadow-sm ring-1 ring-[var(--glass-border)] transition-all duration-200 focus-within:ring-2 focus-within:ring-[var(--accent)]/35">
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
                className="max-h-[88px] min-h-[42px] w-full flex-1 resize-none bg-transparent px-3 py-2.5 text-[14px] leading-snug text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                style={{ height: 'auto' }}
                onFocus={() => {
                  keepChatInView('auto');
                  setTimeout(() => keepChatInView('auto'), 100);
                  setTimeout(() => keepChatInView('auto'), 300);
                  setTimeout(() => keepChatInView('auto'), 520);
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
              className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/25 transition-all hover:shadow-[var(--accent)]/40 disabled:bg-[var(--text-secondary)] disabled:opacity-80 disabled:shadow-none"
              aria-label="Send"
            >
              {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-[18px]" />}
            </motion.button>
          </div>
        </div>
      )}

    </motion.div>
  );
}
