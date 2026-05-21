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
import { useChat } from '@/context/ChatContext';
import socketService from '@/services/socket';
import { QUICK_REPLIES, fmtDate, sameDay, sameGroup, bubbleRounding } from './chat/ChatUtils';

/**
 * MessagingHub - Premium Global Messaging Center
 * Features: Infinite scroll, typing indicators, grouped bubbles, and search.
 */
export default function MessagingHub({ vendorId: initialVendorId, product, initialData, onClose, fullPage = false }) {
  const { user } = useAuthStore();
  const { isSystemWide } = useChat();
  
  // -- State --
  const [activePartnerId, setActivePartnerId] = useState(initialVendorId);
  const [inbox, setInbox] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState(initialData);
  const [partnerBInfo, setPartnerBInfo] = useState(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // UX Features
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  const [deletedConvos, setDeletedConvos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aura_deleted_convos') || '[]'); } catch { return []; }
  });
  
  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const panelTouchRef = useRef(null);
  const [mobileLayout, setMobileLayout] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setMobileLayout(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const hideConversation = (partnerId) => {
    const updated = [...new Set([...deletedConvos, partnerId])];
    setDeletedConvos(updated);
    localStorage.setItem('aura_deleted_convos', JSON.stringify(updated));
    setActivePartnerId(null);
    setPartnerInfo(null);
    setMessages([]);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
  };

  useEffect(() => {
    setActivePartnerId(initialVendorId);
    if (initialData) setPartnerInfo(initialData);
    setPage(1);
    setHasMore(true);
  }, [initialVendorId, initialData]);

  // -- Data Fetching --
  useEffect(() => {
    if (activePartnerId) {
      loadConversation(activePartnerId, 1);
    } else {
      loadInbox();
    }
  }, [activePartnerId, isSystemWide]);

  const loadInbox = async () => {
    setInboxLoading(true);
    try {
      const endpoint = isSystemWide ? '/chat/admin/inbox' : '/chat';
      const res = await api.get(endpoint);
      if (res.data.success) {
        setInbox(res.data.data.activeChats || []);
      }
    } catch (err) {
      console.error('Inbox load failed:', err);
    } finally {
      setInboxLoading(false);
    }
  };

  const loadConversation = async (pid, pageNum = 1) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      let chatEndpoint = `/chat/${pid}?page=${pageNum}&limit=30`;
      if (isSystemWide && partnerBInfo) {
        const pid2 = partnerBInfo?._id || partnerBInfo;
        chatEndpoint = `/chat/admin/all?userA=${pid}&userB=${pid2}&page=${pageNum}&limit=30`;
      }

      const [chatRes, partnerRes] = await Promise.all([
        api.get(chatEndpoint),
        pageNum === 1 ? api.get(`/users/profile/${pid}`).catch(() => null) : Promise.resolve(null)
      ]);

      if (chatRes.data.success) {
        const newMsgs = chatRes.data.data?.messages || [];
        const total = chatRes.data.data?.total || 0;
        
        if (pageNum > 1 && scrollRef.current) {
          const prevScrollHeight = scrollRef.current.scrollHeight;
          const prevScrollTop = scrollRef.current.scrollTop;
          
          setMessages(prev => [...newMsgs, ...prev]);
          setHasMore((messages.length + newMsgs.length) < total);
          
          setTimeout(() => {
            if (scrollRef.current) {
              const newScrollHeight = scrollRef.current.scrollHeight;
              scrollRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
            }
          }, 50);
        } else {
          setMessages(newMsgs);
          setHasMore(newMsgs.length < total);
          scrollToBottom('auto');
          markAsRead(pid);
        }
      }
      
      if (partnerRes?.data?.success) {
        setPartnerInfo(partnerRes.data.data?.user || partnerRes.data.user);
      }

      // Query real-time presence status (more accurate than DB field)
      if (pageNum === 1) {
        socketService.emit('check_online_status', { userId: pid.toString() });
      }
    } catch (err) {
      console.error('Conversation load error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const locallyUpdateInbox = (msg) => {
    if (!msg) return;
    const currentUserId = user?._id?.toString();
    if (!currentUserId) return;

    const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();
    const receiverId = (msg.receiver_id?._id || msg.receiver_id)?.toString();
    
    const isSentByMe = senderId === currentUserId;
    const partnerId = isSentByMe ? receiverId : senderId;

    // ✅ Only use partnerObj if it's a full populated object (has a name or avatar field)
    const rawPartnerObj = isSentByMe ? msg.receiver_id : msg.sender_id;
    const isPopulated = rawPartnerObj && typeof rawPartnerObj === 'object' && (rawPartnerObj.name || rawPartnerObj.avatar || rawPartnerObj.store_name);
    
    if (!partnerId) return;

    setInbox(prev => {
      const existingIdx = prev.findIndex(chat => (chat.partner?._id || chat.partner)?.toString() === partnerId);
      
      let baseChat = {};
      let prevUnread = 0;
      if (existingIdx > -1) {
        baseChat = prev[existingIdx];
        prevUnread = baseChat.unread_count || 0;
      }

      // If active conversation is open with this partner, don't increment unread count
      const isActiveChat = activePartnerId?.toString() === partnerId;
      const isUnread = !isSentByMe && !isActiveChat;
      const newUnreadCount = isUnread ? prevUnread + 1 : (isActiveChat ? 0 : prevUnread);

      const snippetText = msg.text || (msg.product_reference ? '📦 Shared a product' : (msg.image_url ? '📷 Sent a photo' : 'Sent you a message'));

      // ✅ Merge partner: prefer populated data from message, fall back to existing inbox entry
      //    This prevents partner name/avatar being lost when API returns unpopulated IDs
      const mergedPartner = isPopulated
        ? { ...(baseChat.partner || {}), ...rawPartnerObj }
        : (baseChat.partner || { _id: partnerId });

      const updatedChat = {
        ...baseChat,
        partner: mergedPartner,
        snippet: snippetText,
        unread_count: newUnreadCount,
        read_status: isSentByMe || isActiveChat,
        date: msg.createdAt || new Date().toISOString()
      };

      const remaining = [...prev];
      if (existingIdx > -1) {
        remaining.splice(existingIdx, 1);
      }
      
      return [updatedChat, ...remaining];
    });
  };

  const markAsRead = async (pid) => {
    try {
      await api.patch(`/chat/read/${pid}`);
      // Mark local unread as zero instantly
      setInbox(prev => prev.map(chat => {
        if ((chat.partner?._id || chat.partner)?.toString() === pid?.toString()) {
          return { ...chat, unread_count: 0, read_status: true };
        }
        return chat;
      }));
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
      const res = await api.delete(`/chat/message/${messageId}?type=${type}`);
      if (res.data.success) {
        if (type === 'everyone') {
          setMessages(prev => prev.map(m => m._id === messageId ? { ...m, text: 'This message was deleted', product_reference: null, image_url: null, deleted_everyone: true } : m));
        } else {
          setMessages(prev => prev.filter(m => m._id !== messageId));
        }
        setActiveMenuMsgId(null);
      }
    } catch (err) {
      console.error('Delete message failed:', err);
    }
  };

  // -- Socket Events --
  useEffect(() => {
    const handleNewMessage = (msg) => {
      const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();
      const receiverId = (msg.receiver_id?._id || msg.receiver_id)?.toString();
      
      // Ignore messages from self (handled via optimistic updates in handleSend)
      if (senderId === user?._id?.toString()) return;
      
      if (activePartnerId && (senderId === activePartnerId.toString() || receiverId === activePartnerId.toString())) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        setPartnerTyping(false);
        scrollToBottom();
        // ✅ Auto-mark as read: user is actively viewing this conversation
        markAsRead(activePartnerId);
      }
      locallyUpdateInbox(msg);
    };

    const handleSentMessageEcho = (msg) => {
      const receiverId = (msg.receiver_id?._id || msg.receiver_id)?.toString();
      const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();

      if (activePartnerId && (senderId === activePartnerId.toString() || receiverId === activePartnerId.toString())) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          
          // Match any optimistic message starting with 'opt-' that shares the same content
          const tempMsg = prev.find(m => 
            m._id.toString().startsWith?.('opt-') && 
            ((m.text && m.text === msg.text) || (m.image_url && m.image_url === msg.image_url))
          );
          
          if (tempMsg) {
            return prev.map(m => m._id === tempMsg._id ? { ...msg, status: 'sent' } : m);
          }
          
          return [...prev, msg];
        });
        scrollToBottom();
      }
      locallyUpdateInbox(msg);
    };

    // ✅ Real-time blue-tick update: when receiver reads our messages, update read_status instantly
    const handleMessagesRead = ({ sender_id }) => {
      const readSenderId = sender_id?.toString();
      if (!readSenderId) return;

      // Update messages sent by current user to this partner — mark them as read
      setMessages(prev => prev.map(m => {
        const msgSenderId = (m.sender_id?._id || m.sender_id)?.toString();
        if (msgSenderId === user?._id?.toString()) {
          return { ...m, read_status: true };
        }
        return m;
      }));

      // Update inbox thread: clear unread badge for this partner
      setInbox(prev => prev.map(chat => {
        const partnerId = (chat.partner?._id || chat.partner)?.toString();
        if (partnerId === readSenderId) {
          return { ...chat, unread_count: 0, read_status: true };
        }
        return chat;
      }));
    };

    const onPartnerTyping = ({ userId }) => {
      if (userId === activePartnerId?.toString()) setPartnerTyping(true);
    };

    const onPartnerStoppedTyping = ({ userId }) => {
      if (userId === activePartnerId?.toString()) setPartnerTyping(false);
    };

    const onUserPresence = ({ userId, isOnline }) => {
      const uid = userId?.toString();
      if (activePartnerId && uid === activePartnerId.toString()) {
        setPartnerInfo(prev => prev ? { ...prev, is_online: isOnline } : prev);
      }
      setInbox(prev => prev.map(chat => {
        const partnerId = (chat.partner?._id || chat.partner)?.toString();
        if (partnerId === uid) {
          return {
            ...chat,
            partner: typeof chat.partner === 'object' && chat.partner
              ? { ...chat.partner, is_online: isOnline }
              : chat.partner
          };
        }
        return chat;
      }));
    };

    const handleMessageDeleted = ({ messageId, deletedFor, text }) => {
      if (deletedFor === 'everyone') {
        setMessages(prev => prev.map(m => m._id === messageId ? { ...m, text: text || 'This message was deleted', product_reference: null, image_url: null, deleted_everyone: true } : m));
      } else if (deletedFor === 'me') {
        setMessages(prev => prev.filter(m => m._id !== messageId));
      }
    };

    socketService.on('receive_message', handleNewMessage);
    socketService.on('sent_message_echo', handleSentMessageEcho);
    socketService.on('messages_read', handleMessagesRead);
    socketService.on('partner_typing', onPartnerTyping);
    socketService.on('partner_stopped_typing', onPartnerStoppedTyping);
    socketService.on('user_presence', onUserPresence);
    socketService.on('message_deleted', handleMessageDeleted);

    return () => {
      socketService.off('receive_message', handleNewMessage);
      socketService.off('sent_message_echo', handleSentMessageEcho);
      socketService.off('messages_read', handleMessagesRead);
      socketService.off('partner_typing', onPartnerTyping);
      socketService.off('partner_stopped_typing', onPartnerStoppedTyping);
      socketService.off('user_presence', onUserPresence);
      socketService.off('message_deleted', handleMessageDeleted);
    };
  }, [activePartnerId, user?._id]);

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

    setSending(true);
    try {
      const res = await uploadService.uploadSingle(file, 'general');
      if (res.success) {
        handleSend('', res.data.url);
      } else {
        throw new Error(res.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload image');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async (customText = null, imageUrl = null) => {
    const text = (customText || input).trim();
    if ((!text && !imageUrl) || !activePartnerId || sending) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socketService.emit('typing_stop', { receiver_id: activePartnerId });

    setSending(true);
    const optimisticMsg = {
      _id: `opt-${Date.now()}`,
      text,
      image_url: imageUrl,
      sender_id: user?._id,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setInput('');
    scrollToBottom();

    try {
      const res = await api.post('/chat', {
        receiver_id: activePartnerId,
        text,
        image_url: imageUrl,
        ...(product && { product_reference: product._id }),
      });
      if (res.data.success) {
        const realMsg = res.data.data?.message || res.data.message;
        setMessages(prev => prev.map(m => m._id === optimisticMsg._id ? { ...realMsg, status: 'sent' } : m));
        locallyUpdateInbox(realMsg);
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m._id === optimisticMsg._id ? { ...m, status: 'failed' } : m));
    } finally {
      setSending(false);
    }
  };

  // -- Computed --
  const filteredInbox = useMemo(() => {
    return inbox
      .filter(c => !deletedConvos.includes((c.partner?._id || '').toString()))
      .filter(c => {
        const name = (c.partner?.store_name || c.partner?.name || '').toLowerCase();
        return name.includes(searchQuery.toLowerCase());
      });
  }, [inbox, deletedConvos, searchQuery]);

  const partnerName = (partnerInfo?.store_name || partnerInfo?.branding?.store_name || partnerInfo?.name || 'User').toString();
  const partnerAvatar = partnerInfo?.store?.logo || partnerInfo?.branding?.logo || partnerInfo?._id?.branding?.logo || partnerInfo?.avatar || partnerInfo?.profile_picture;

  const dismissOverlay = () => {
    onClose?.();
  };

  const goBackOrClose = () => {
    if (activePartnerId) {
      setActivePartnerId(null);
      setPartnerInfo(null);
      setMessages([]);
    } else {
      dismissOverlay();
    }
  };

  /** Reliable swipe-right / swipe-down dismiss (works alongside framer drag on header). */
  const handlePanelTouchStart = (e) => {
    if (!mobileLayout) return;
    const t = e.touches?.[0];
    if (!t) return;
    panelTouchRef.current = {
      x: t.clientX,
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

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    if (dt > 650) return;

    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.1;
    const fromLeftEdge = start.x < 80;
    const strongSwipeRight = dx > 72 || (dx > 48 && fromLeftEdge);

    if (horizontal && strongSwipeRight) {
      if (!start.fromComposer && (!start.fromMessages || dx > 90 || fromLeftEdge)) {
        goBackOrClose();
        return;
      }
    }

    if (!horizontal && dy > 64 && dy > Math.abs(dx) && start.y < 120) {
      goBackOrClose();
    }
  };

  const pullToClose = (info) => {
    if (info.offset.y > 48 || info.velocity.y > 420) {
      goBackOrClose();
    }
  };

  const headerSwipeProps =
    mobileLayout
      ? {
          drag: 'x',
          dragConstraints: { left: 0, right: 0 },
          dragElastic: { left: 0, right: 0.5 },
          dragMomentum: false,
          onDragEnd: (_e, info) => {
            if (info.offset.x > 40 || info.velocity.x > 380) {
              goBackOrClose();
            }
          },
        }
      : {};

  return (
    <motion.div
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
      className={
        fullPage
          ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--bg-secondary)] touch-manipulation'
          : [
              'fixed z-[600] flex min-h-0 flex-col overflow-hidden bg-[var(--bg-secondary)] touch-manipulation',
              'max-md:inset-0 max-md:h-full max-md:max-h-full max-md:w-full max-md:rounded-none max-md:border-0 max-md:shadow-none',
              'md:left-auto md:right-5 md:top-[max(1rem,env(safe-area-inset-top))] md:bottom-5',
              'md:h-[min(82dvh,700px)] md:max-h-[85dvh] md:w-[min(420px,calc(100vw-2.5rem))]',
              'md:rounded-2xl md:border md:border-black/10 md:shadow-[0_20px_64px_rgba(0,0,0,0.28)]',
            ].join(' ')
      }
    >
      {/* Mobile: pull handle — swipe down to close / go back */}
      {mobileLayout && (
        <div className="flex shrink-0 flex-col items-center border-b border-[var(--glass-border)] bg-[var(--bg-secondary)] md:hidden">
          <motion.div
            role="presentation"
            aria-hidden
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_e, info) => pullToClose(info)}
            className="flex w-full cursor-grab touch-none justify-center py-2 active:cursor-grabbing"
          >
            <span className="h-1 w-10 rounded-full bg-black/20" />
          </motion.div>
        </div>
      )}

      {/* ── Header ── */}
      <AnimatePresence mode="wait">
        {activePartnerId ? (
          /* Chat Header */
          <motion.div
            key="chat-header"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="relative z-30 shrink-0 bg-[var(--nav-bg)] text-[var(--nav-text)] shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
            data-chat-header
          >
            <motion.div {...headerSwipeProps} className="block w-full touch-pan-y">
            <div className="flex items-center gap-1.5 px-2 py-1.5 max-md:gap-2 max-md:py-2 sm:gap-3 sm:px-3 sm:py-2.5">
              <button
                type="button"
                onClick={() => { setActivePartnerId(null); setPartnerInfo(null); setMessages([]); }}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--nav-text)]/95 transition-colors hover:bg-white/10 active:bg-white/15 sm:size-10"
                aria-label="Back to chats"
              >
                <ArrowLeft className="size-[22px] sm:size-5" />
              </button>

              <div className="relative shrink-0">
                <div className="size-10 overflow-hidden rounded-full bg-white/15 ring-2 ring-white/20 sm:size-11">
                  {partnerAvatar && typeof partnerAvatar === 'string'
                    ? <img src={partnerAvatar} className="size-full object-cover" alt="" />
                    : <div className="flex size-full items-center justify-center text-lg font-semibold text-[var(--nav-text)]">{partnerName[0]}</div>}
                </div>
                {/* Status dot removed per user preference to only show online/offline text */}
              </div>

              <div className="min-w-0 flex-1 py-0.5">
                <h3 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--nav-text)] max-md:text-[14px] sm:text-[17px] capitalize">
                  {isSystemWide && partnerBInfo
                    ? <span>{partnerName} <span className="text-[var(--nav-text)]/40">&</span> {partnerBInfo?.name}</span>
                    : partnerName}
                </h3>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {partnerTyping ? (
                    <span className="flex items-center gap-1.5 text-[12px] text-[var(--nav-text)]/70 max-md:text-[11px] sm:text-[13px]">
                      <span className="flex gap-0.5">
                        {[0,1,2].map(d => (
                          <motion.span key={d} className="inline-block size-1 rounded-full bg-[var(--nav-text)]/45"
                            animate={{ y: [0,-3,0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />
                        ))}
                      </span>
                      typing…
                    </span>
                  ) : (
                    <p className={`text-[12px] max-md:text-[11px] sm:text-[13px] ${partnerInfo?.is_online ? 'text-emerald-400' : 'text-[var(--nav-text)]/55'}`}>
                      {partnerInfo?.is_online ? 'online' : 'offline'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => { if (confirm('Delete this conversation?')) hideConversation(activePartnerId.toString()); }}
                  className="flex size-10 items-center justify-center rounded-full text-[var(--nav-text)]/80 transition-colors hover:bg-white/10 hover:text-[var(--nav-text)] active:bg-white/15"
                  aria-label="Delete chat"
                >
                  <Trash2 className="size-[18px]" />
                </button>
                <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full text-[var(--nav-text)]/85 transition-colors hover:bg-white/10 hover:text-[var(--nav-text)] active:bg-white/15" aria-label="Close chat">
                  <X className="size-[22px] sm:size-5" />
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
            transition={{ duration: 0.2 }}
            className="relative z-30 shrink-0"
            data-chat-header
          >
            <motion.div {...headerSwipeProps} className="bg-[var(--nav-bg)] px-3 pb-2.5 pt-2.5 max-md:pb-2 max-md:pt-2 sm:px-4 sm:pb-4 sm:pt-4 touch-pan-y">
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <h2 className="text-[17px] font-semibold tracking-tight text-[var(--nav-text)] max-md:text-[16px] sm:text-[20px]">Chats</h2>
                  {inbox.length > 0 && (
                    <p className="mt-0.5 text-[12px] text-[var(--nav-text)]/70 max-md:text-[11px] sm:text-[13px]">
                      {inbox.filter(c => c.unread_count > 0).length > 0
                        ? `${inbox.filter(c => c.unread_count > 0).length} unread`
                        : `${inbox.length} chat${inbox.length > 1 ? 's' : ''}`}
                    </p>
                  )}
                </div>
                <button type="button" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--nav-text)]/90 transition-colors hover:bg-white/10 active:bg-white/15" aria-label="Close">
                  <X className="size-[22px]" />
                </button>
              </div>
            </motion.div>
            <div className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)] px-2 py-1.5 max-md:py-1.5 sm:px-3 sm:py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-[16px] -translate-y-1/2 text-[var(--text-secondary)] max-md:left-2 max-md:size-[15px] sm:left-3 sm:size-[18px]" />
                <input
                  type="search"
                  enterKeyHint="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full rounded-lg border-0 bg-[var(--bg-primary)] py-2 pl-9 pr-2.5 text-[14px] text-[var(--text-primary)] shadow-sm outline-none ring-1 ring-[var(--glass-border)] placeholder:text-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--accent)]/40 max-md:py-2 max-md:text-[13px] sm:py-2.5 sm:pl-10 sm:pr-3 sm:text-[15px]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Context */}
      {activePartnerId && product && (
        <div className="z-20 shrink-0 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-2 sm:px-4">
           <div className="flex items-center gap-3">
              <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-primary)] ring-1 ring-[var(--glass-border)] sm:size-12">
                 <img src={product.images?.[0]?.url || product.images?.[0]} className="size-full object-cover" alt="" />
              </div>
              <div className="min-w-0 flex-1">
                 <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">Product</p>
                 <h4 className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{product.name}</h4>
                 <p className="text-[12px] text-[var(--text-secondary)]">{(product.price || 0).toLocaleString()} XAF</p>
              </div>
              <button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-primary)] text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--glass-border)] transition active:bg-[var(--bg-secondary)]">
                 <Package className="size-[18px]" />
              </button>
           </div>
        </div>
      )}

      {/* Main Body: inbox scrolls full column; chat = messages scroll + fixed composer */}
      {!activePartnerId ? (
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 touch-pan-y overflow-y-auto bg-[var(--bg-secondary)]"
      >
          <div className="p-1.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] max-md:space-y-0 sm:p-3">
             <div className="space-y-px overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.06]">
                {inboxLoading ? (
                  <div className="flex flex-col items-center gap-4 bg-white py-20">
                    <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
                    <p className="text-[13px] font-medium text-[var(--text-secondary)]">Loading chats…</p>
                  </div>
                ) : filteredInbox.length === 0 ? (
                  <div className="bg-white px-6 py-16 text-center">
                    <MessageCircle className="mx-auto mb-4 size-14 text-[var(--text-secondary)]" />
                    <p className="text-[16px] font-medium text-[var(--text-primary)]">No chats yet</p>
                    <p className="mt-2 text-[14px] leading-snug text-[var(--text-secondary)]">Start a conversation from a product or store.</p>
                  </div>
                ) : (
                  filteredInbox.map((chat, i) => (
                    <button
                      key={chat._id || i}
                      type="button"
                      onClick={() => {
                        setActivePartnerId(chat.partner?._id);
                        setPartnerInfo(chat.partner);
                        if (chat.isSystemWide) setPartnerBInfo(chat.partnerB);
                      }}
                      className={`flex w-full items-center gap-2.5 border-b border-[var(--glass-border)] px-2.5 py-2.5 text-left transition-colors active:bg-[var(--bg-secondary)] max-md:gap-3 max-md:px-3 max-md:py-2.5 sm:gap-4 sm:px-4 sm:py-3 ${
                        chat.unread_count > 0 ? 'bg-[var(--accent)]/[0.08]' : 'bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      <div className="relative size-[46px] shrink-0 overflow-hidden rounded-full bg-[var(--component-bg)] max-md:size-11 sm:size-14">
                         {chat.partner?.avatar || chat.partner?.branding?.logo || chat.partner?.store?.logo 
                           ? <img src={chat.partner?.avatar || chat.partner?.branding?.logo || chat.partner?.store?.logo} className="size-full object-cover" alt="" />
                           : <div className="flex size-full items-center justify-center text-xl font-semibold text-[var(--text-secondary)]">{(chat.partner?.store_name || chat.partner?.name || 'U')[0]}</div>}
                         {/* Status dot removed per user preference to only show online/offline status */}
                      </div>
                      <div className="min-w-0 flex-1">
                         <div className="mb-0.5 flex items-start justify-between gap-2">
                            <h4 className={`truncate text-[15px] capitalize max-md:text-[14px] sm:text-[16px] ${chat.unread_count > 0 ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]'}`}>
                              {chat.isSystemWide ? `${chat.partner?.name} & ${chat.partnerB?.name}` : (chat.partner?.store_name || chat.partner?.name)}
                            </h4>
                            <span className="shrink-0 pt-0.5 text-[11px] text-[var(--text-secondary)] max-md:text-[10px] sm:text-[12px]">{new Date(chat.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                         </div>
                         <div className="flex items-center justify-between gap-2">
                            <p className={`min-w-0 flex-1 truncate text-[13px] leading-snug max-md:text-[12px] sm:text-[14px] ${chat.unread_count > 0 ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                              {chat.snippet || 'Tap to open'}
                            </p>
                            {chat.unread_count > 0 && (
                              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-semibold text-white">
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
      </div>
      ) : (
      <>
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        data-chat-messages
        className="chat-bg-pattern chat-scrollbar relative min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain"
      >
          <div className="space-y-0.5 p-2 pb-3 pt-1.5 max-md:space-y-px sm:space-y-1 sm:p-4">
                {loadingMore && <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin text-[var(--text-secondary)]" /></div>}
                
                {loading ? (
                   <div className="flex flex-col items-center justify-center py-24 opacity-60"><Loader2 className="size-8 animate-spin text-[var(--accent)]" /></div>
                ) : (
                  messages.map((msg, i) => {
                    const prevMsg = messages[i - 1];
                    const nextMsg = messages[i + 1];
                    const isOwn = (msg.sender_id?._id || msg.sender_id)?.toString() === user?._id?.toString();
                    
                    const showDate = !prevMsg || !sameDay(prevMsg.createdAt, msg.createdAt);
                    const withPrev = sameGroup(prevMsg, msg);
                    const withNext = sameGroup(msg, nextMsg);
                    
                    const rounding = bubbleRounding(isOwn, withPrev, withNext);

                    return (
                      <div key={msg._id || i}>
                        {showDate && (
                          <div className="my-3 flex justify-center max-md:my-3.5 sm:my-6">
                            <span className="rounded-lg bg-[var(--bg-primary)]/95 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--glass-border)] max-md:px-2 max-md:text-[9px] sm:px-3 sm:py-1.5 sm:text-[11px]">
                              {fmtDate(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} ${withNext ? 'mb-0.5' : 'mb-1.5 max-md:mb-1 sm:mb-2.5'}`}>
                          <div className={`flex max-w-[92%] flex-col gap-0.5 sm:max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                            
                            <motion.div
                              initial={{ opacity: 0, scale: 0.96, y: 8 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ type: "spring", stiffness: 350, damping: 28 }}
                              className={`
                                group relative px-2.5 py-1.5 pr-6 text-[13px] leading-snug shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] max-md:px-2.5 max-md:py-1.5 max-md:text-[12.5px] sm:px-3 sm:py-2 sm:text-[14.5px]
                                hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-300
                                ${isOwn
                                  ? 'border border-[var(--accent)]/25 bg-[var(--accent)]/12 text-[var(--text-primary)] hover:border-[var(--accent)]/35'
                                  : 'border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:border-[var(--glass-border)]/40'}
                                ${rounding}
                              `}
                            >
                              {!msg.deleted_everyone && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setActiveMenuMsgId(activeMenuMsgId === msg._id ? null : msg._id); }}
                                  className={`absolute right-1 top-1 size-5 rounded bg-black/[0.03] text-[var(--text-secondary)] transition-opacity hover:bg-black/[0.08] flex items-center justify-center ${activeMenuMsgId === msg._id ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}
                                  aria-label="Message options"
                                >
                                  <MoreVertical className="size-3" />
                                </button>
                              )}

                              {activeMenuMsgId === msg._id && (
                                <>
                                  <div className="fixed inset-0 z-45 cursor-default bg-transparent" onClick={(e) => { e.stopPropagation(); setActiveMenuMsgId(null); }} />
                                  <div className={`absolute z-50 min-w-[130px] rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in duration-100 ${isOwn ? 'right-1 top-6' : 'left-1 top-6'}`} onClick={(e) => e.stopPropagation()}>
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
                                <p className="italic text-[var(--text-secondary)]/60 whitespace-pre-wrap text-[13px] max-md:text-[12.5px] sm:text-[14.5px]">
                                  This message was deleted
                                </p>
                              ) : msg.text ? (
                                <p className="whitespace-pre-wrap text-[13px] max-md:text-[12.5px] sm:text-[14.5px]">{msg.text}</p>
                              ) : null}
                              
                              <div className={`mt-0.5 flex items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'} text-[10px] tabular-nums text-[var(--text-secondary)] max-md:text-[9.5px] sm:mt-1 sm:text-[11px]`}>
                                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {isOwn && (
                                  msg.status === 'failed' ? <AlertCircle className="size-3.5 text-red-600" /> :
                                  <CheckCheck className={`size-3.5 transition-colors duration-300 ${msg.read_status ? 'text-emerald-500 drop-shadow-[0_0_2px_rgba(16,185,129,0.3)]' : 'text-[var(--text-secondary)]/50'}`} />
                                )}
                              </div>
                            </motion.div>

                            {msg.status === 'failed' && (
                              <button type="button" onClick={() => handleSend(msg.text)} className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-600 ring-1 ring-red-200 transition-colors active:bg-red-100">
                                <AlertCircle className="size-4 shrink-0" /> Retry send
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
             </div>

      <div data-chat-composer className="z-20 shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
                {messages.length < 5 && !input && (
                  <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-[var(--glass-border)] px-2 py-2 sm:px-3">
                    {QUICK_REPLIES.map(q => (
                      <motion.button
                        key={q}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSend(q); }}
                        className="shrink-0 whitespace-nowrap rounded-full bg-[var(--bg-primary)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--accent)] shadow-sm ring-1 ring-[var(--glass-border)] transition-colors active:bg-[var(--bg-secondary)] max-md:px-2.5 max-md:py-1.5 max-md:text-[11px] sm:px-3 sm:py-2 sm:text-[13px]"
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-1.5 px-2 pb-1.5 pt-0.5 max-md:gap-1.5 sm:gap-2 sm:px-3 sm:pb-3 sm:pt-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1, rotate: 8 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-primary)] hover:text-[var(--accent)] active:bg-[var(--bg-primary)]"
                    aria-label="Attach image"
                  >
                    <ImageIcon className="size-[22px]" />
                  </motion.button>

                  <div className="relative flex min-h-[44px] flex-1 items-end overflow-hidden rounded-[24px] bg-[var(--bg-primary)] shadow-sm ring-1 ring-[var(--glass-border)] focus-within:ring-2 focus-within:ring-[var(--accent)]/35 transition-all duration-300">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => handleTyping(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Message"
                      rows={1}
                      className="max-h-24 min-h-[40px] w-full flex-1 resize-none bg-transparent px-3 py-2.5 text-[14px] leading-snug text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] max-md:min-h-[40px] max-md:px-3 max-md:py-2 max-md:text-[13px] sm:min-h-[44px] sm:px-4 sm:py-3 sm:text-[15px]"
                      style={{ height: 'auto' }}
                      onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`; }}
                    />
                  </div>

                  <motion.button
                    type="button"
                    whileHover={sending || !input.trim() ? {} : { scale: 1.05 }}
                    whileTap={sending || !input.trim() ? {} : { scale: 0.92 }}
                    onClick={() => handleSend()}
                    disabled={sending || !input.trim()}
                    className="mb-0.5 flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 transition-all hover:shadow-[var(--accent)]/45 disabled:bg-[var(--text-secondary)] disabled:opacity-90 disabled:shadow-none"
                    aria-label="Send"
                  >
                    {sending ? <Loader2 className="size-6 animate-spin" /> : <Send className="size-[22px]" />}
                  </motion.button>
                </div>
             </div>
      </>
      )}

    </motion.div>
  );
}
