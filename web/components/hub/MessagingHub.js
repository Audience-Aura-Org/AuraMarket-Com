"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
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
      {...(!fullPage && {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
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
              onClose();
            }
          }
        }
      })}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className={fullPage 
        ? "flex-1 flex flex-col bg-[var(--bg-secondary)] w-full h-full overflow-hidden"
        : "fixed inset-y-0 right-0 z-[600] flex flex-col bg-[var(--bg-secondary)] w-full md:w-[420px] shadow-2xl md:border-l md:border-[var(--glass-border)] shadow-black/50 overflow-hidden touch-none"
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
            className="sticky top-0 z-30 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-[var(--glass-border)]"
          >
            {/* Accent bar */}
            <div className="h-0.5 w-full bg-gradient-to-r from-[var(--accent)]/60 via-[var(--accent)] to-[var(--accent)]/30" />
            <div className="flex items-center gap-3 px-3 py-3">
              <button
                onClick={() => { setActivePartnerId(null); setPartnerInfo(null); setMessages([]); }}
                className="size-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-all shrink-0"
              >
                <ArrowLeft className="size-5" />
              </button>

              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="size-11 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent)]/5 overflow-hidden border border-[var(--accent)]/20 shadow-md">
                  {partnerAvatar && typeof partnerAvatar === 'string'
                    ? <img src={partnerAvatar} className="size-full object-cover" alt="" />
                    : <div className="size-full flex items-center justify-center text-base font-black text-[var(--accent)]">{partnerName[0]}</div>}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--bg-primary)] ${
                  partnerInfo?.is_online ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-gray-400'
                }`} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-[14px] text-[var(--text-primary)] truncate tracking-tight leading-tight capitalize">
                  {isSystemWide && partnerBInfo
                    ? <span>{partnerName} <span className="opacity-20">&</span> {partnerBInfo?.name}</span>
                    : partnerName}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {partnerTyping ? (
                    <span className="flex items-center gap-1 text-[var(--accent)] text-[11px] font-bold">
                      <span className="flex gap-0.5">
                        {[0,1,2].map(d => (
                          <motion.span key={d} className="inline-block size-1 rounded-full bg-[var(--accent)]"
                            animate={{ y: [0,-3,0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />
                        ))}
                      </span>
                      typing
                    </span>
                  ) : (
                    <p className={`text-[11px] font-semibold ${
                      partnerInfo?.is_online ? 'text-emerald-500' : 'text-[var(--text-secondary)] opacity-40'
                    }`}>
                      {partnerInfo?.is_online ? '● Online' : 'Offline'}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { if (confirm('Delete this conversation?')) hideConversation(activePartnerId.toString()); }}
                  className="size-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] opacity-30 hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="size-4" />
                </button>
                <button onClick={onClose} className="size-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] opacity-40 hover:opacity-100 hover:bg-[var(--bg-secondary)] transition-all">
                  <X className="size-5" />
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
            className="sticky top-0 z-30"
          >
            <div className="bg-gradient-to-r from-[var(--accent)] to-[#c0347a] px-5 pt-3 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[18px] font-black text-white tracking-tight leading-none">Messages</h2>
                  {inbox.length > 0 && (
                    <p className="text-[11px] font-semibold text-white/60 mt-0.5">
                      {inbox.filter(c => c.unread_count > 0).length > 0
                        ? `${inbox.filter(c => c.unread_count > 0).length} unread`
                        : `${inbox.length} conversation${inbox.length > 1 ? 's' : ''}`}
                    </p>
                  )}
                </div>
                <button onClick={onClose} className="size-8 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-all">
                  <X className="size-4" />
                </button>
              </div>
            </div>
            {/* Search below gradient */}
            <div className="bg-[var(--bg-primary)] border-b border-[var(--glass-border)] px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--accent)] opacity-50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl py-2.5 pl-10 pr-4 text-[13px] font-medium outline-none focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/20 transition-all placeholder:opacity-30"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Context */}
      {activePartnerId && product && (
        <div className="px-5 py-3 bg-gradient-to-r from-[var(--bg-primary)] to-[var(--bg-secondary)] border-b border-[var(--glass-border)] z-20">
           <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0 shadow-sm">
                 <img src={product.images?.[0]?.url || product.images?.[0]} className="size-full object-cover" alt="" />
              </div>
              <div className="flex-1 min-w-0">
                 <p className="text-[9px] font-bold text-[var(--accent)] tracking-[0.15em] mb-0.5 uppercase">Subject Payload</p>
                 <h4 className="text-[13px] font-bold text-[var(--text-primary)] truncate tracking-tight">{product.name}</h4>
                 <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60">{(product.price || 0).toLocaleString()} XAF</p>
              </div>
              <button className="size-9 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] opacity-40 hover:opacity-100 transition-opacity">
                 <Package className="size-4" />
              </button>
           </div>
        </div>
      )}

      {/* Main Body */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative custom-scrollbar"
        style={activePartnerId ? {
          background: 'var(--bg-secondary)',
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--glass-border) 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        } : { background: 'var(--bg-secondary)' }}
      >
        {activePartnerId ? (
          <div className="flex flex-col min-h-full">
             <div className="flex-1 p-4 space-y-1">
                {loadingMore && <div className="py-4 flex justify-center"><Loader2 className="animate-spin size-4 opacity-30" /></div>}
                
                {loading ? (
                   <div className="flex flex-col items-center justify-center py-20 opacity-20"><Loader2 className="animate-spin" /></div>
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
                          <div className="flex justify-center my-6">
                            <span className="px-3 py-1 rounded-full bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-widest shadow-sm">
                              {fmtDate(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'} ${withNext ? 'mb-0.5' : 'mb-3'}`}>
                          <div className={`max-w-[85%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                            
                            <div className={`
                              relative group px-4 py-2.5 text-[14px] md:text-[15px] font-medium leading-relaxed
                              ${isOwn
                                ? 'bg-gradient-to-br from-[var(--accent)] to-[#c0347a] text-white shadow-lg shadow-[var(--accent)]/25'
                                : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--glass-border)] shadow-sm'}
                              ${rounding}
                            `}>
                              {msg.image_url && (
                                <div className="mb-2 -mx-1 rounded-lg overflow-hidden border border-black/10">
                                  <img src={msg.image_url} className="w-full max-h-60 object-cover" alt="Shared" />
                                </div>
                              )}
                              
                              {msg.product_reference && !withPrev && (
                                <button className="mb-2 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 flex items-center gap-2 text-left w-full">
                                  <img 
                                    src={msg.product_reference.images?.[0]?.url || msg.product_reference.images?.[0]} 
                                    className="size-10 rounded object-cover" 
                                    alt="" 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold truncate">{msg.product_reference.name}</p>
                                    <p className="text-[10px] opacity-60">{(msg.product_reference.price || 0).toLocaleString()} XAF</p>
                                  </div>
                                </button>
                              )}

                              <p className="whitespace-pre-wrap">{msg.text}</p>
                              
                              <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'} opacity-40 text-[9px] font-bold tabular-nums`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isOwn && (
                                  msg.status === 'failed' ? <AlertCircle className="size-3 text-red-300" /> :
                                  <CheckCheck className={`size-3 ${msg.read_status ? 'text-blue-300' : ''}`} />
                                )}
                              </div>

                              {msg.status === 'failed' && (
                                <button onClick={() => handleSend(msg.text)} className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 text-red-500 hover:scale-110 transition-transform">
                                  <AlertCircle className="size-5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
             </div>

             {/* Input Area */}
             <div className="bg-[var(--bg-primary)]/95 backdrop-blur-xl border-t border-[var(--glass-border)] sticky bottom-0 z-20">
                {/* Quick Replies */}
                {messages.length < 5 && activePartnerId && !input && (
                  <div className="flex gap-2 px-3 py-2.5 overflow-x-auto no-scrollbar border-b border-[var(--glass-border)]/60">
                    {QUICK_REPLIES.map(q => (
                      <motion.button
                        key={q}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSend(q); }}
                        className="whitespace-nowrap px-4 py-1.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[11px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-all shadow-sm"
                      >
                        {q}
                      </motion.button>
                    ))}
                  </div>
                )}

                <div className="px-3 py-3 flex items-end gap-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="size-10 mb-0.5 rounded-2xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all shrink-0"
                  >
                    <ImageIcon className="size-5" />
                  </button>

                  {/* Input pill */}
                  <div className="flex-1 relative bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-[22px] flex items-end focus-within:border-[var(--accent)]/50 focus-within:ring-1 focus-within:ring-[var(--accent)]/20 transition-all overflow-hidden">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => handleTyping(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type a message..."
                      rows={1}
                      className="flex-1 bg-transparent px-4 py-3 text-[14px] font-medium outline-none resize-none max-h-28 overflow-y-auto w-full"
                      style={{ height: 'auto' }}
                      onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    />
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSend()}
                    disabled={!input.trim() && !sending}
                    className="size-11 mb-0.5 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[#c0347a] text-white flex items-center justify-center shadow-lg shadow-[var(--accent)]/30 disabled:opacity-40 disabled:grayscale transition-all shrink-0"
                  >
                    {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-4" />}
                  </motion.button>
                </div>
             </div>
          </div>
        ) : (
          <div className="p-4">

             <div className="space-y-2">
                {inboxLoading ? (
                  <div className="py-20 flex flex-col items-center gap-4 opacity-20">
                    <Loader2 className="animate-spin size-8" />
                    <p className="text-[10px] font-bold tracking-widest uppercase">Connecting to Pipeline</p>
                  </div>
                ) : filteredInbox.length === 0 ? (
                  <div className="py-20 text-center opacity-20">
                    <MessageCircle className="size-16 mx-auto mb-4" />
                    <p className="text-sm font-bold">No channels found</p>
                    <p className="text-[10px] mt-1 font-medium italic">Start a conversation from any product or store</p>
                  </div>
                ) : (
                  filteredInbox.map((chat, i) => (
                    <button
                      key={chat._id || i}
                      onClick={() => {
                        setActivePartnerId(chat.partner?._id);
                        setPartnerInfo(chat.partner);
                        if (chat.isSystemWide) setPartnerBInfo(chat.partnerB);
                      }}
                      className={`w-full p-4 rounded-[1.5rem] border transition-all flex items-center gap-4 group text-left shadow-sm active:scale-[0.98] ${
                        chat.unread_count > 0
                          ? 'bg-[var(--accent)]/5 border-[var(--accent)]/30 border-l-2 border-l-[var(--accent)] hover:bg-[var(--accent)]/10'
                          : 'bg-[var(--bg-primary)] border-[var(--glass-border)] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent)]/30'
                      }`}
                    >
                      <div className="size-14 rounded-full bg-[var(--bg-secondary)] overflow-hidden border border-[var(--glass-border)] shrink-0 shadow-sm relative">
                         {chat.partner?.avatar || chat.partner?.branding?.logo || chat.partner?.store?.logo 
                           ? <img src={chat.partner?.avatar || chat.partner?.branding?.logo || chat.partner?.store?.logo} className="size-full object-cover" alt="" />
                           : <div className="size-full flex items-center justify-center text-xl font-bold text-[var(--accent)] bg-[var(--accent)]/5">{(chat.partner?.store_name || chat.partner?.name || 'U')[0]}</div>}
                         
                         {chat.partner?.is_online && (
                           <div className="absolute bottom-0 right-0 size-3.5 bg-emerald-500 border-2 border-[var(--bg-primary)] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                         )}
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-start mb-1">
                            <h4 className="font-bold text-[14px] text-[var(--text-primary)] truncate pr-2 capitalize">
                              {chat.isSystemWide ? `${chat.partner?.name} & ${chat.partnerB?.name}` : (chat.partner?.store_name || chat.partner?.name)}
                            </h4>
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 whitespace-nowrap">{new Date(chat.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                         </div>
                         <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] text-[var(--text-secondary)] truncate opacity-60 font-medium flex-1">
                              {chat.snippet || 'Click to open conversation'}
                            </p>
                            {chat.unread_count > 0 && (
                              <div className="px-2 py-0.5 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold shadow-lg shadow-[var(--accent)]/20">
                                {chat.unread_count}
                              </div>
                            )}
                         </div>
                      </div>
                    </button>
                  ))
                )}
             </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </motion.div>
  );
}
