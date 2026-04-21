"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Send, ArrowLeft, Package, Plus, 
  MessageCircle, CheckCheck, Check, Mic, Image as ImageIcon,
  ExternalLink, Search, Loader2, MoreVertical, Phone, Video
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';
import Link from 'next/link';

/**
 * ChatSlideOverlay - Global Pop-out Messaging Center
 * High-density WhatsApp-style interface with persistent product context.
 */
export default function ChatSlideOverlay({ vendorId: initialVendorId, product, initialData, onClose }) {
  const { user } = useAuthStore();
  const [activePartnerId, setActivePartnerId] = useState(initialVendorId);
  const [inbox, setInbox] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState(initialData);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setActivePartnerId(initialVendorId);
    if (initialData) setPartnerInfo(initialData);
  }, [initialVendorId, initialData]);

  // 1. Initial Loading Logic
  useEffect(() => {
    if (activePartnerId) {
      loadConversation(activePartnerId);
    } else {
      loadInbox();
    }
  }, [activePartnerId]);

  const loadInbox = async () => {
    setInboxLoading(true);
    try {
      const res = await api.get('/chat');
      if (res.data.success) {
        setInbox(res.data.data.activeChats || []);
      }
    } catch (err) {
      console.error('Inbox load failed:', err);
    } finally {
      setInboxLoading(false);
    }
  };

  const loadConversation = async (pid) => {
    setLoading(true);
    try {
      const [chatRes, partnerRes] = await Promise.all([
        api.get(`/chat/${pid}`),
        api.get(`/users/profile/${pid}`).catch(() => null)
      ]);

      if (chatRes.data.success) {
        setMessages(chatRes.data.data?.messages || chatRes.data.messages || []);
      }
      if (partnerRes?.data?.success) {
        setPartnerInfo(partnerRes.data.data?.user || partnerRes.data.user);
      }
    } catch (err) {
      console.error('Conversation load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Socket listeners
  useEffect(() => {
    const handleNewMessage = (msg) => {
      const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();
      const receiverId = (msg.receiver_id?._id || msg.receiver_id)?.toString();
      if (activePartnerId && (senderId === activePartnerId.toString() || receiverId === activePartnerId.toString())) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
      loadInbox();
    };
    socketService.on('receive_message', handleNewMessage);
    return () => socketService.off?.('receive_message', handleNewMessage);
  }, [activePartnerId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (customText = null) => {
    const text = (customText || input).trim();
    if (!text || !activePartnerId || sending) return;

    const optimisticMsg = {
      _id: `opt-${Date.now()}`,
      text,
      sender_id: user?._id,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    setMessages(prev => [...prev, optimisticMsg]);
    if (!customText) setInput('');
    setSending(true);

    try {
      const res = await api.post('/chat', {
        receiver_id: activePartnerId,
        text,
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

  const partnerName = partnerInfo?.store_name || partnerInfo?.branding?.store_name || partnerInfo?.name || 'User';
  const partnerAvatar = partnerInfo?.store?.logo || partnerInfo?.branding?.logo || partnerInfo?._id?.branding?.logo || partnerInfo?.avatar || partnerInfo?.profile_picture;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="fixed inset-y-0 right-0 z-[450] flex flex-col bg-[var(--bg-secondary)] w-full md:w-[420px] shadow-2xl md:border-l md:border-[var(--glass-border)] shadow-black/50 overflow-hidden"
    >
      {/* --- Optimized Header --- */}
      <div className="flex items-center gap-3.5 px-4 py-4 bg-[var(--bg-primary)] border-b border-[var(--glass-border)] sticky top-0 z-30">
        {activePartnerId ? (
          <button onClick={() => { setActivePartnerId(null); setPartnerInfo(null); setMessages([]); }} className="p-2 -ml-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <ArrowLeft className="size-6" />
          </button>
        ) : (
          <button onClick={onClose} className="p-2 -ml-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
             <X className="size-6" />
          </button>
        )}

        <div className="flex-1 min-w-0 flex items-center gap-3">
          {activePartnerId ? (
             <>
                <div className="size-10 rounded-full bg-[var(--bg-secondary)] overflow-hidden border border-[var(--glass-border)] shrink-0">
                   {partnerAvatar ? <img src={partnerAvatar} className="size-full object-cover" alt="" /> : <div className="size-full flex items-center justify-center text-sm font-black text-[var(--accent)]">{partnerName[0]}</div>}
                </div>
                <div className="min-w-0">
                   <h3 className="font-black text-sm md:text-base text-[var(--text-primary)] truncate tracking-tighter leading-tight capitalize whitespace-nowrap">{partnerName}</h3>
                   <div className="flex items-center gap-1.5 ">
                      <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">Active Now</p>
                   </div>
                </div>
             </>
          ) : (
            <div>
               <h3 className="font-black text-lg text-[var(--text-primary)] tracking-tight">Operational Channels</h3>
               <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 tracking-wide">Procurement Pipeline</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
           {activePartnerId ? (
             <>
                <button onClick={() => alert('Secure Video Transmission: Feature Encrypting...')} className="p-2 text-[var(--text-secondary)] opacity-60 hover:opacity-100"><Video className="size-5" /></button>
                <button onClick={() => alert('Encrypted Voice Pipeline: Feature Pending...')} className="p-2 text-[var(--text-secondary)] opacity-60 hover:opacity-100"><Phone className="size-5" /></button>
                <button onClick={() => alert('Node Configuration Menu')} className="p-2 text-[var(--text-secondary)] opacity-60 hover:opacity-100"><MoreVertical className="size-5" /></button>
             </>
           ) : (
              <Link href="/chat" onClick={onClose} className="p-2 text-[var(--text-secondary)] opacity-60 hover:opacity-100 hover:text-[var(--accent)]">
                <ExternalLink className="size-5" />
              </Link>
           )}
        </div>
      </div>

      {/* --- Persistent Product Context Bar --- */}
      {activePartnerId && product && (
        <div className="px-5 py-3 relative overflow-hidden bg-gradient-to-r from-[var(--bg-primary)] to-[var(--bg-secondary)] border-b border-[var(--glass-border)] z-20">
           <div className="absolute top-0 right-0 w-24 h-full bg-[var(--accent)]/5 blur-xl pointer-events-none" />
           <div className="flex items-center gap-4 relative z-10">
              <div className="size-14 rounded-2xl overflow-hidden border-2 border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                 <img src={product.images?.[0]?.url || product.images?.[0]} className="size-full object-cover" alt="" />
              </div>
              <div className="flex-1 min-w-0">
                 <p className="text-[10px] font-black text-[var(--accent)] uppercase tracking-[0.2em] mb-1 leading-none">Subject Payload</p>
                 <h4 className="text-[13px] font-black text-[var(--text-primary)] truncate uppercase tracking-tight">{product.name}</h4>
                 <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] font-black text-[var(--text-secondary)] opacity-80">{product.price?.toLocaleString()} XAF</p>
                    <div className="size-1 rounded-full bg-[var(--accent)] opacity-20" />
                    <span className="text-[9px] font-black text-[var(--accent)] uppercase opacity-40">Ready for Transfer</span>
                 </div>
              </div>
              <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] opacity-40 hover:opacity-100 cursor-pointer">
                 <Package className="size-5" />
              </div>
           </div>
        </div>
      )}

      {/* --- Body --- */}
      <div className="flex-1 overflow-y-auto relative bg-[var(--bg-secondary)] custom-scrollbar">
        {activePartnerId ? (
          <div className="flex flex-col min-h-full">
             <div className="flex-1 p-4 space-y-2">
                {loading && messages.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-20 opacity-20"><Loader2 className="animate-spin" /></div>
                ) : (
                  (() => {
                    let lastProductRef = null;
                    return messages.map((msg, i) => {
                      const isOwn = (msg.sender_id?._id || msg.sender_id)?.toString() === user?._id?.toString();
                      const currentRefId = (msg.product_reference?._id || msg.product_reference)?.toString();
                      const showProductContext = currentRefId && currentRefId !== lastProductRef;
                      lastProductRef = currentRefId;

                      return (
                        <div key={msg._id || i} className="space-y-2">
                          {showProductContext && msg.product_reference && (
                            <div className="flex justify-center my-4">
                               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm animate-in fade-in slide-in-from-bottom-1">
                                  <div className="size-5 rounded overflow-hidden border border-[var(--glass-border)]">
                                     <img src={msg.product_reference.images?.[0]?.url || msg.product_reference.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=50&q=80'} className="size-full object-cover" alt="" />
                                  </div>
                                  <span className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest truncate max-w-[120px]">
                                    {msg.product_reference.name}
                                  </span>
                               </div>
                            </div>
                          )}
                          <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                              max-w-[85%] px-4 py-3 rounded-2xl text-[14px] md:text-base font-medium leading-relaxed shadow-sm
                              ${isOwn ? 'bg-[var(--accent)] text-white rounded-br-sm' : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--glass-border)] rounded-bl-sm'}
                            `}>
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                              <div className={`flex items-center gap-1.5 mt-2 ${isOwn ? 'justify-end' : 'justify-start'} opacity-60 text-[10px]`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isOwn && <CheckCheck className="size-3" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
                <div ref={messagesEndRef} />
             </div>

             <div className="p-4 bg-[var(--bg-primary)] border-t border-[var(--glass-border)] flex items-center gap-2.5 sticky bottom-0">
                <div className="flex items-center gap-3 px-2">
                   <Plus className="size-6 text-[var(--text-secondary)] opacity-60 cursor-pointer hover:opacity-100" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Operational text..."
                  className="flex-1 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-full px-5 py-3 text-sm font-medium outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <button onClick={() => handleSend()} className="size-11 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-lg active:scale-95 transition-all shrink-0">
                  {input.trim() ? <Send className="size-5" /> : <Mic className="size-5" />}
                </button>
             </div>
          </div>
        ) : (
          <div className="p-4 space-y-2">
             <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 opacity-30" />
                <input type="text" placeholder="Search channels..." className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-3 pl-10 pr-4 text-[10px] font-medium outline-none tracking-normal placeholder:opacity-40" />
             </div>

             {inboxLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin opacity-20" /></div>
             ) : inbox.length === 0 ? (
                <div className="py-20 text-center opacity-30">
                   <MessageCircle className="size-12 mx-auto mb-4" />
                   <p className="text-xs font-black uppercase tracking-widest leading-loose">No active connections found</p>
                </div>
             ) : (
                inbox.map((chat) => (
                  <button
                    key={chat._id || chat.partner?._id || `chat-${chat.date}`}
                    onClick={() => {
                      setActivePartnerId(chat.partner?._id);
                      setPartnerInfo(chat.partner);
                    }}
                    className="w-full p-4 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:bg-[var(--accent)]/[0.04] hover:border-[var(--accent)]/50 transition-all flex items-center gap-4 group text-left shadow-sm mb-2"
                  >
                    <div className="size-14 rounded-full bg-[var(--bg-secondary)] overflow-hidden border border-[var(--glass-border)] flex items-center justify-center shrink-0">
                       {chat.partner?.store?.logo || chat.partner?.branding?.logo || chat.partner?.avatar 
                         ? <img src={chat.partner?.store?.logo || chat.partner?.branding?.logo || chat.partner?.avatar} className="size-full object-cover" alt="" />
                         : <div className="text-xl font-black text-[var(--accent)] uppercase">{chat.partner?.store_name?.[0] || chat.partner?.name?.[0]}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-start mb-0.5">
                          <h4 className="font-bold text-xs md:text-sm text-[var(--text-primary)] truncate pr-2 capitalize">{chat.partner?.store_name || chat.partner?.name}</h4>
                          <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 whitespace-nowrap">{new Date(chat.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                       </div>
                       <p className="text-xs text-[var(--text-secondary)] truncate opacity-60 leading-relaxed font-medium">{chat.snippet}</p>
                    </div>
                  </button>
                ))
             )}
          </div>
        )}
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
      `}</style>
    </motion.div>
  );
}
