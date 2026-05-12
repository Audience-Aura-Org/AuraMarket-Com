"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, X, ArrowLeft, Package,
  MessageCircle, CheckCheck, Loader2, 
  Search, Trash2, Image as ImageIcon, AlertCircle
} from 'lucide-react';
import api from '@/services/api';
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
  const router = useRouter();
  
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
        
        setMessages(prev => pageNum === 1 ? newMsgs : [...newMsgs, ...prev]);
        setHasMore(messages.length + newMsgs.length < total);
        if (pageNum === 1) {
          scrollToBottom('auto');
          markAsRead(pid);
        }
      }
      
      if (partnerRes?.data?.success) {
        setPartnerInfo(partnerRes.data.data?.user || partnerRes.data.user);
      }
    } catch (err) {
      console.error('Conversation load error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const markAsRead = async (pid) => {
    try {
      await api.patch(`/chat/read/${pid}`);
      loadInbox(); // Refresh unread counts in sidebar
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

  // -- Socket Events --
  useEffect(() => {
    if (!socketService.connected) return;

    const handleNewMessage = (msg) => {
      const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();
      const receiverId = (msg.receiver_id?._id || msg.receiver_id)?.toString();
      
      // Ignore messages from self (they are handled via optimistic updates in handleSend)
      if (senderId === user?._id?.toString()) return;
      
      if (activePartnerId && (senderId === activePartnerId.toString() || receiverId === activePartnerId.toString())) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        setPartnerTyping(false);
        scrollToBottom();
      }
      loadInbox();
    };

    const onPartnerTyping = ({ userId }) => {
      if (userId === activePartnerId?.toString()) setPartnerTyping(true);
    };

    const onPartnerStoppedTyping = ({ userId }) => {
      if (userId === activePartnerId?.toString()) setPartnerTyping(false);
    };

    const onUserPresence = ({ userId, isOnline }) => {
      if (activePartnerId && userId === activePartnerId.toString()) {
        setPartnerInfo(prev => prev ? { ...prev, is_online: isOnline } : prev);
      }
      setInbox(prev => prev.map(chat => {
        if (chat.partner?._id === userId) {
          return { ...chat, partner: { ...chat.partner, is_online: isOnline } };
        }
        return chat;
      }));
    };

    socketService.on('receive_message', handleNewMessage);
    socketService.on('partner_typing', onPartnerTyping);
    socketService.on('partner_stopped_typing', onPartnerStoppedTyping);
    socketService.on('user_presence', onUserPresence);

    return () => {
      socketService.off('receive_message', handleNewMessage);
      socketService.off('partner_typing', onPartnerTyping);
      socketService.off('partner_stopped_typing', onPartnerStoppedTyping);
      socketService.off('user_presence', onUserPresence);
    };
  }, [activePartnerId]);

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
      const formData = new FormData();
      formData.append('image', file);
      
      const res = await api.post('/upload/single', formData);
      if (res.data.success) {
        handleSend('', res.data.data.url);
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

  return (
    <motion.div
      {...(true && { // Enable drag for both overlay and fullPage
        initial: !fullPage ? { x: '100%' } : false,
        animate: { x: 0 },
        exit: !fullPage ? { x: '100%' } : false,
        drag: "x",
        dragConstraints: { left: 0, right: 0 },
        dragElastic: { left: 0, right: 0.5 },
        onDragEnd: (e, info) => {
          if (info.offset.x > 100) {
            if (activePartnerId) {
              setActivePartnerId(null);
              setPartnerInfo(null);
              setMessages([]);
            } else {
              // If in Inbox, go back in history (native feel)
              if (window.history.length > 1) {
                router.back();
              }
              onClose?.();
            }
          }
        }
      })}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className={
        fullPage
          ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#ece5dd] touch-manipulation'
          : [
              'fixed z-[600] flex min-h-0 max-h-[100dvh] flex-col overflow-hidden bg-[#ece5dd] shadow-2xl touch-manipulation',
              'inset-0 h-[100dvh] max-h-[100dvh] w-full',
              'pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]',
              'md:inset-auto md:right-4 md:top-auto md:bottom-4 md:left-auto md:h-[min(82dvh,680px)] md:max-h-[82dvh] md:w-[min(420px,calc(100vw-2rem))]',
              'md:rounded-2xl md:border md:border-black/10 md:shadow-[0_12px_48px_rgba(0,0,0,0.28)]',
            ].join(' ')
      }
    >
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
            className="relative z-30 shrink-0 bg-[#075e54] text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
          >
            <div className="flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3 sm:py-2.5">
              <button
                type="button"
                onClick={() => { setActivePartnerId(null); setPartnerInfo(null); setMessages([]); }}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-white/95 transition-colors hover:bg-white/10 active:bg-white/15 sm:size-10"
                aria-label="Back to chats"
              >
                <ArrowLeft className="size-[22px] sm:size-5" />
              </button>

              <div className="relative shrink-0">
                <div className="size-10 overflow-hidden rounded-full bg-white/15 ring-2 ring-white/20 sm:size-11">
                  {partnerAvatar && typeof partnerAvatar === 'string'
                    ? <img src={partnerAvatar} className="size-full object-cover" alt="" />
                    : <div className="flex size-full items-center justify-center text-lg font-semibold text-white">{partnerName[0]}</div>}
                </div>
                <div className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-[#075e54] sm:size-3.5 ${
                  partnerInfo?.is_online ? 'bg-[#25d366]' : 'bg-neutral-400'
                }`} />
              </div>

              <div className="min-w-0 flex-1 py-0.5">
                <h3 className="truncate text-[16px] font-semibold leading-tight tracking-tight text-white sm:text-[17px] capitalize">
                  {isSystemWide && partnerBInfo
                    ? <span>{partnerName} <span className="text-white/40">&</span> {partnerBInfo?.name}</span>
                    : partnerName}
                </h3>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {partnerTyping ? (
                    <span className="flex items-center gap-1.5 text-[13px] text-[#b8e5d1]">
                      <span className="flex gap-0.5">
                        {[0,1,2].map(d => (
                          <motion.span key={d} className="inline-block size-1 rounded-full bg-[#b8e5d1]"
                            animate={{ y: [0,-3,0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />
                        ))}
                      </span>
                      typing…
                    </span>
                  ) : (
                    <p className={`text-[13px] ${partnerInfo?.is_online ? 'text-[#25d366]' : 'text-white/55'}`}>
                      {partnerInfo?.is_online ? 'online' : 'offline'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => { if (confirm('Delete this conversation?')) hideConversation(activePartnerId.toString()); }}
                  className="flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
                  aria-label="Delete chat"
                >
                  <Trash2 className="size-[18px]" />
                </button>
                <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15" aria-label="Close chat">
                  <X className="size-[22px] sm:size-5" />
                </button>
              </div>
            </div>
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
          >
            <div className="bg-[#075e54] px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[19px] font-semibold tracking-tight text-white sm:text-[20px]">Chats</h2>
                  {inbox.length > 0 && (
                    <p className="mt-0.5 text-[13px] text-[#b8e5d1]">
                      {inbox.filter(c => c.unread_count > 0).length > 0
                        ? `${inbox.filter(c => c.unread_count > 0).length} unread`
                        : `${inbox.length} chat${inbox.length > 1 ? 's' : ''}`}
                    </p>
                  )}
                </div>
                <button type="button" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 active:bg-white/15" aria-label="Close">
                  <X className="size-[22px]" />
                </button>
              </div>
            </div>
            <div className="border-b border-black/5 bg-[#f0f2f5] px-2 py-2 sm:px-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-[#667781]" />
                <input
                  type="search"
                  enterKeyHint="search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full rounded-lg border-0 bg-white py-2.5 pl-10 pr-3 text-[15px] text-[#111b21] shadow-sm outline-none ring-1 ring-black/[0.06] placeholder:text-[#667781] focus:ring-2 focus:ring-[#00a884]/40"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Context */}
      {activePartnerId && product && (
        <div className="z-20 shrink-0 border-b border-black/5 bg-[#f0f2f5] px-3 py-2 sm:px-4">
           <div className="flex items-center gap-3">
              <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-black/5 sm:size-12">
                 <img src={product.images?.[0]?.url || product.images?.[0]} className="size-full object-cover" alt="" />
              </div>
              <div className="min-w-0 flex-1">
                 <p className="text-[11px] font-medium uppercase tracking-wide text-[#667781]">Product</p>
                 <h4 className="truncate text-[14px] font-semibold text-[#111b21]">{product.name}</h4>
                 <p className="text-[12px] text-[#667781]">{(product.price || 0).toLocaleString()} XAF</p>
              </div>
              <button type="button" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-[#54656f] shadow-sm ring-1 ring-black/5 transition active:bg-[#f0f2f5]">
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
        className="chat-scrollbar relative min-h-0 flex-1 overflow-y-auto bg-[#f0f2f5]"
      >
          <div className="p-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-3">
             <div className="space-y-px overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.06]">
                {inboxLoading ? (
                  <div className="flex flex-col items-center gap-4 bg-white py-20">
                    <Loader2 className="size-8 animate-spin text-[#00a884]" />
                    <p className="text-[13px] font-medium text-[#667781]">Loading chats…</p>
                  </div>
                ) : filteredInbox.length === 0 ? (
                  <div className="bg-white px-6 py-16 text-center">
                    <MessageCircle className="mx-auto mb-4 size-14 text-[#8696a0]" />
                    <p className="text-[16px] font-medium text-[#111b21]">No chats yet</p>
                    <p className="mt-2 text-[14px] leading-snug text-[#667781]">Start a conversation from a product or store.</p>
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
                      className={`flex w-full items-center gap-3 border-b border-[#f0f2f5] px-3 py-3 text-left transition-colors active:bg-[#f5f6f6] sm:gap-4 sm:px-4 ${
                        chat.unread_count > 0 ? 'bg-[#f0fff4]' : 'bg-white hover:bg-[#f5f6f6]'
                      }`}
                    >
                      <div className="relative size-[52px] shrink-0 overflow-hidden rounded-full bg-[#dfe5e7] sm:size-14">
                         {chat.partner?.avatar || chat.partner?.branding?.logo || chat.partner?.store?.logo 
                           ? <img src={chat.partner?.avatar || chat.partner?.branding?.logo || chat.partner?.store?.logo} className="size-full object-cover" alt="" />
                           : <div className="flex size-full items-center justify-center text-xl font-semibold text-[#54656f]">{(chat.partner?.store_name || chat.partner?.name || 'U')[0]}</div>}
                         {chat.partner?.is_online && (
                           <div className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-white bg-[#25d366]" />
                         )}
                      </div>
                      <div className="min-w-0 flex-1">
                         <div className="mb-0.5 flex items-start justify-between gap-2">
                            <h4 className={`truncate text-[16px] capitalize ${chat.unread_count > 0 ? 'font-semibold text-[#111b21]' : 'font-medium text-[#111b21]'}`}>
                              {chat.isSystemWide ? `${chat.partner?.name} & ${chat.partnerB?.name}` : (chat.partner?.store_name || chat.partner?.name)}
                            </h4>
                            <span className="shrink-0 pt-0.5 text-[12px] text-[#667781]">{new Date(chat.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                         </div>
                         <div className="flex items-center justify-between gap-2">
                            <p className={`min-w-0 flex-1 truncate text-[14px] leading-snug ${chat.unread_count > 0 ? 'font-medium text-[#111b21]' : 'text-[#667781]'}`}>
                              {chat.snippet || 'Tap to open'}
                            </p>
                            {chat.unread_count > 0 && (
                              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#25d366] text-[12px] font-semibold text-white">
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
        className="chat-bg-pattern chat-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
          <div className="space-y-1 p-3 pb-4 pt-2 sm:p-4">
                {loadingMore && <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin text-[#8696a0]" /></div>}
                
                {loading ? (
                   <div className="flex flex-col items-center justify-center py-24 opacity-60"><Loader2 className="size-8 animate-spin text-[#00a884]" /></div>
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
                          <div className="my-5 flex justify-center sm:my-6">
                            <span className="rounded-lg bg-white/95 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-[#54656f] shadow-sm ring-1 ring-black/[0.06]">
                              {fmtDate(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} ${withNext ? 'mb-0.5' : 'mb-2.5'}`}>
                          <div className={`flex max-w-[88%] flex-col gap-1 sm:max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                            
                            <div className={`
                              px-3 py-2 text-[14.5px] leading-snug shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]
                              ${isOwn
                                ? 'bg-[#dcf8c6] text-[#111b21]'
                                : 'border border-black/[0.06] bg-white text-[#111b21]'}
                              ${rounding}
                            `}>
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
                                    <p className="truncate text-[12px] font-semibold text-[#111b21]">{msg.product_reference.name}</p>
                                    <p className="text-[11px] text-[#667781]">{(msg.product_reference.price || 0).toLocaleString()} XAF</p>
                                  </div>
                                </button>
                              )}

                              {msg.text ? <p className="whitespace-pre-wrap text-[14.5px]">{msg.text}</p> : null}
                              
                              <div className={`mt-1 flex items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'} text-[11px] tabular-nums text-[#667781]`}>
                                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {isOwn && (
                                  msg.status === 'failed' ? <AlertCircle className="size-3.5 text-red-600" /> :
                                  <CheckCheck className={`size-3.5 ${msg.read_status ? 'text-[#53bdeb]' : 'text-[#667781]'}`} />
                                )}
                              </div>
                            </div>

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

      <div className="z-20 shrink-0 border-t border-[#e9edef] bg-[#f0f2f5] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
                {messages.length < 5 && !input && (
                  <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-[#e9edef]/80 px-2 py-2 sm:px-3">
                    {QUICK_REPLIES.map(q => (
                      <motion.button
                        key={q}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSend(q); }}
                        className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-2 text-[13px] font-medium text-[#075e54] shadow-sm ring-1 ring-black/[0.06] transition-colors active:bg-[#e9edef]"
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 px-2 pb-2 pt-1 sm:px-3 sm:pb-3 sm:pt-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-[#e9edef] active:bg-[#e9edef]"
                    aria-label="Attach image"
                  >
                    <ImageIcon className="size-[22px]" />
                  </button>

                  <div className="relative flex min-h-[44px] flex-1 items-end overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-black/[0.08] focus-within:ring-2 focus-within:ring-[#00a884]/35">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => handleTyping(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Message"
                      rows={1}
                      className="max-h-28 min-h-[44px] w-full flex-1 resize-none bg-transparent px-4 py-3 text-[15px] leading-snug text-[#111b21] outline-none placeholder:text-[#8696a0]"
                      style={{ height: 'auto' }}
                      onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`; }}
                    />
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleSend()}
                    disabled={sending || !input.trim()}
                    className="mb-0.5 flex size-12 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-md transition-all disabled:bg-[#8696a0] disabled:opacity-90 disabled:shadow-none"
                    aria-label="Send"
                  >
                    {sending ? <Loader2 className="size-6 animate-spin" /> : <Send className="size-[22px]" />}
                  </motion.button>
                </div>
             </div>
      </>
      )}

      <style jsx global>{`
        .chat-bg-pattern {
          background-color: #ece5dd;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'%3E%3Cg fill='%23000' fill-opacity='0.035'%3E%3Cpath d='M40 36c8-14 22-24 38-24 24 0 44 20 44 44 0 22-18 40-40 40H36c-13 0-24-11-24-24 0-15 12-28 28-36z'/%3E%3Cpath d='M188 210c10-18 28-30 48-30 32 0 58 26 58 58 0 28-22 52-50 52h-52c-17 0-32-14-32-32 0-20 16-38 28-48z'/%3E%3C/g%3E%3C/svg%3E");
        }
        .chat-scrollbar::-webkit-scrollbar { width: 5px; }
        .chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </motion.div>
  );
}
