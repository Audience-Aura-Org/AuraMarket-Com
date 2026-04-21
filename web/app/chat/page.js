"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search, MessageCircle, MoreVertical, 
  Send, Image as ImageIcon, Smile, 
  CheckCheck, Check, ArrowLeft, Phone, Video,
  ShieldCheck, Loader2, User, Package,
  ExternalLink, X, Plus, Mic, Menu,
  Settings, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';

/**
 * WhatsApp-Elite Messaging Page
 * High-density operational pipeline with Multi-Product Context support.
 * FULL DARK THEME (No Light Variables).
 */
function ChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token } = useAuthStore();
  
  const [inbox, setInbox] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextProduct, setContextProduct] = useState(null);
  
  const scrollRef = useRef(null);
  const activeChatRef = useRef(null);

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  // ─── Initial Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token && !user?._id) {
      setLoading(false);
      return;
    }

    const initChat = async () => {
      setLoading(true);
      try {
        const inboxRes = await api.get('/chat');
        if (inboxRes.data.success) {
          const chats = inboxRes.data.data.activeChats || [];
          setInbox(chats);

          const vendorId = searchParams.get('vendorId');
          const productId = searchParams.get('productId');

          if (vendorId) {
            const existing = chats.find(c => (c.partner?._id || c.partner) === vendorId);
            if (existing) {
              setActiveChat(existing.partner);
            } else {
              const res = await api.get(`/users/profile/${vendorId}`).catch(() => null);
              if (res?.data?.success) setActiveChat(res.data.data.user);
            }
          }

          if (productId) {
            api.get(`/products/${productId}`).then(res => {
              if (res.data.success) setContextProduct(res.data.data.product || res.data.product);
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Chat initialization failed', err);
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [searchParams, user?._id]);

  // ─── Conversation Handlers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!activeChat) return;
    const partnerId = activeChat._id || activeChat;

    const fetchConv = async () => {
      try {
        const res = await api.get(`/chat/${partnerId}`);
        if (res.data.success) {
          setMessages(res.data.data.messages || []);
          if (res.data.data.messages.some(m => !m.read_status && m.receiver_id === user?._id)) {
            api.patch(`/chat/read/${partnerId}`).catch(() => {});
          }
        }
      } catch (err) { console.error(err); }
    };
    fetchConv();
  }, [activeChat, user?._id]);

  useEffect(() => {
    if (!user?._id) return;
    const handleInbound = (msg) => {
      const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();
      const receiverId = (msg.receiver_id?._id || msg.receiver_id)?.toString();
      const currentActive = activeChatRef.current?._id?.toString();
      if (currentActive && (senderId === currentActive || receiverId === currentActive)) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
      api.get('/chat').then(res => { if (res.data.success) setInbox(res.data.data.activeChats || []); });
    };
    socketService.on('receive_message', handleInbound);
    return () => socketService.off('receive_message', handleInbound);
  }, [user?._id]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeChat || sending) return;

    setSending(true);
    const text = newMessage.trim();
    const partnerId = activeChat._id || activeChat;

    const optimistic = {
      _id: `temp-${Date.now()}`,
      text,
      sender_id: user?._id,
      createdAt: new Date().toISOString(),
      status: 'sending'
    };

    setMessages(prev => [...prev, optimistic]);
    setNewMessage('');

    try {
      const res = await api.post('/chat', { 
        receiver_id: partnerId, 
        text,
        product_reference: contextProduct?._id
      });
      if (res.data.success) {
        setMessages(prev => prev.map(m => m._id === optimistic._id ? res.data.data.message : m));
      }
    } catch {
      setMessages(prev => prev.map(m => m._id === optimistic._id ? { ...m, status: 'failed' } : m));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const filteredInbox = useMemo(() => {
    return inbox.filter(c => (c.partner?.store_name || c.partner?.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [inbox, searchQuery]);

  const partnerName = activeChat?.store_name || activeChat?.branding?.store_name || activeChat?.name || 'User';
  const partnerAvatar = activeChat?.store?.logo || activeChat?.branding?.logo || activeChat?.avatar || activeChat?.profile_picture;

  // Track product context changes for thread rendering
  let lastProductRef = null;

  return (
    <div className="fixed inset-0 flex bg-[#0c0c0c] text-[#e9edef] overflow-hidden">
      {/* Sidebar Left */}
      <aside className={`w-full md:w-[400px] border-r border-[#202c33] flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'} z-20 bg-[#111b21]`}>
        {/* Sidebar Header - FIXED BG */}
        <div className="h-[64px] bg-[#202c33] px-4 flex items-center justify-between border-b border-[#111b21]">
           <div className="size-10 rounded-full overflow-hidden bg-[#111b21] border border-white/10">
              {user?.branding?.logo || user?.avatar ? <img src={user.branding?.logo || user.avatar} className="size-full object-cover" alt="" /> : <User className="m-auto mt-2 opacity-20" />}
           </div>
           <div className="flex items-center gap-5 text-[#aebac1]">
              <MessageCircle className="size-5 cursor-pointer hover:text-white" />
              <Settings className="size-5 cursor-pointer hover:text-white" />
              <Menu className="size-5 cursor-pointer hover:text-white" />
           </div>
        </div>

        <div className="p-3">
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[#aebac1] opacity-40 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
              <input 
                type="text" 
                placeholder="Search or start new session" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#202c33] border-none rounded-xl py-2.5 pl-12 pr-4 text-[13px] outline-none placeholder:text-[#aebac1]/40"
              />
           </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
           {loading ? (
             <div className="flex justify-center py-20 opacity-20"><Loader2 className="animate-spin" /></div>
           ) : (
             filteredInbox.map(chat => (
               <button key={chat._id || chat.partner?._id || `inbox-${chat.date}`} onClick={() => setActiveChat(chat.partner)} className={`w-full h-[72px] px-3 flex items-center gap-3 hover:bg-[#202c33] transition-all relative ${activeChat?._id === chat.partner?._id ? 'bg-[#2a3942]' : ''}`}>
                 <div className="size-12 rounded-full overflow-hidden shrink-0 border border-white/5 bg-[#111b21]">
                    {chat.partner?.store?.logo || chat.partner?.branding?.logo || chat.partner?.avatar ? <img src={chat.partner?.store?.logo || chat.partner?.branding?.logo || chat.partner?.avatar} className="size-full object-cover" alt="" /> : <div className="size-full flex items-center justify-center bg-[var(--accent)] text-xs font-black">{chat.partner?.name?.[0]}</div>}
                 </div>
                 <div className="flex-1 border-b border-[#202c33] h-full flex flex-col justify-center min-w-0 pr-2 transition-all">
                    <div className="flex justify-between items-center mb-0.5">
                       <h3 className="font-medium text-[#e9edef] truncate pr-2 tracking-tight">{chat.partner?.store_name || chat.partner?.name}</h3>
                       <span className="text-[10px] text-[#aebac1] opacity-70 uppercase tracking-tighter">{new Date(chat.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <p className="text-[13px] text-[#aebac1] truncate opacity-60 font-medium">
                         {chat.snippet || 'Operational Pipe established'}
                       </p>
                       {!chat.read_status && <div className="size-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />}
                    </div>
                 </div>
               </button>
             ))
           )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`flex-1 flex flex-col h-full relative ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {!activeChat ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#222e35] border-b-[6px] border-[var(--accent)]">
             <div className="size-24 rounded-full bg-[#111b21] mb-6 flex items-center justify-center opacity-40 shadow-xl border border-white/5">
                <MessageCircle className="size-12 text-[var(--accent)]" />
             </div>
             <h2 className="text-3xl font-light text-[#e9edef] opacity-80 mb-3 tracking-tighter">AURA OPS CENTER</h2>
             <p className="max-w-md text-[#aebac1] text-sm leading-relaxed opacity-60">
                Select a communication node to begin operational synchronization.<br/>
                All data is encrypted via Liquid protocols.
             </p>
          </div>
        ) : (
          <>
            {/* Conversations Header */}
            <div className="h-[64px] bg-[#202c33] px-4 flex items-center justify-between shrink-0 shadow-md z-30">
               <div className="flex items-center gap-4 min-w-0 cursor-pointer">
                  <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2"><ArrowLeft className="size-5" /></button>
                  <div className="size-10 rounded-full overflow-hidden bg-[#111b21] border border-white/5 shrink-0">
                     {partnerAvatar ? <img src={partnerAvatar} className="size-full object-cover" alt="" /> : <div className="size-full flex items-center justify-center bg-[var(--accent)] text-xs font-black">{partnerName[0]}</div>}
                  </div>
                  <div className="min-w-0">
                     <h3 className="font-bold text-[#e9edef] truncate text-[15px] capitalize tracking-tighter leading-tight whitespace-nowrap">{partnerName}</h3>
                     <div className="flex items-center gap-1.5 ">
                        <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Active Now</p>
                     </div>
                  </div>
               </div>
               <div className="flex items-center gap-7 text-[#aebac1]">
                  <Search onClick={() => alert('Diagnostic Search: Feature Encrypting...')} className="size-5 opacity-60 hover:opacity-100 cursor-pointer" />
                  <Phone onClick={() => alert('Encrypted Voice Pipeline: Operational Check Pending')} className="size-5 opacity-60 hover:opacity-100 cursor-pointer" />
                  <Video onClick={() => alert('Secure Video Transmission: Protocol Required')} className="size-5 opacity-60 hover:opacity-100 cursor-pointer" />
                  <MoreVertical onClick={() => alert('Node Configuration Menu')} className="size-5 opacity-60 hover:opacity-100 cursor-pointer" />
               </div>
            </div>

            {/* Persistent Product Context Highlight */}
            {contextProduct && (
              <div className="bg-[#111b21]/95 backdrop-blur-xl px-4 md:px-8 py-3 md:py-4 border-b border-[#202c33] flex items-center gap-4 md:gap-5 z-20 shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-64 h-full bg-[var(--accent)]/10 blur-3xl pointer-events-none group-hover:bg-[var(--accent)]/20 transition-all duration-700" />
                 
                 <div className="relative z-10 size-14 md:size-16 rounded-xl md:rounded-2xl overflow-hidden bg-[#202c33] border border-white/10 shrink-0 shadow-lg transition-transform group-hover:scale-[1.02] active:scale-95 duration-500">
                    <img src={contextProduct.images?.[0]?.url || contextProduct.images?.[0]} className="size-full object-cover" alt="" />
                 </div>

                 <div className="flex-1 min-w-0 relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-[9px] font-black text-[var(--accent)] uppercase tracking-[0.2em] opacity-90">Subject Payload</span>
                       <div className="size-1 rounded-full bg-[var(--accent)] opacity-40 animate-pulse" />
                    </div>
                    <h4 className="text-sm md:text-base font-black text-white truncate uppercase tracking-tight leading-tight mb-1">{contextProduct.name}</h4>
                    <div className="flex items-center gap-3">
                       <p className="text-xs md:text-sm font-black text-[#aebac1] tabular-nums">{contextProduct.price?.toLocaleString()} <span className="text-[10px] text-[var(--accent)] opacity-60">XAF</span></p>
                       <div className="h-3 w-px bg-white/10" />
                       <button 
                         onClick={() => router.push(`/products/${contextProduct._id}`)}
                         className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--accent)] hover:text-white transition-colors group/btn"
                       >
                         <ExternalLink className="size-3 group-hover/btn:rotate-12 transition-transform" />
                         <span>Inspect Node</span>
                       </button>
                    </div>
                 </div>

                 <div className="flex items-center gap-2 relative z-10">
                    <button onClick={() => setContextProduct(null)} className="p-2.5 md:p-3 rounded-full bg-white/5 text-[#aebac1] hover:text-white hover:bg-white/10 transition-all border border-white/5"><X className="size-5" /></button>
                 </div>
              </div>
            )}

            {/* Message Pane */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-12 py-6 space-y-1 relative custom-scrollbar bg-[#0b141a]">
               <div className="absolute inset-0 bg-[#0b141a]/98 pointer-events-none z-0" />
               <div className="max-w-4xl mx-auto space-y-2 relative z-10">
                  {messages.map((msg, i) => {
                    const isOwn = (msg.sender_id?._id || msg.sender_id)?.toString() === user?._id?.toString();
                    const currentRefId = (msg.product_reference?._id || msg.product_reference)?.toString();
                    const showProductContext = currentRefId && currentRefId !== lastProductRef;
                    lastProductRef = currentRefId;

                    return (
                      <div key={msg._id || i} className="space-y-4">
                        {showProductContext && msg.product_reference && (
                          <div className="flex justify-center my-8">
                            <button 
                              onClick={() => window.open(`/products/${msg.product_reference._id || msg.product_reference}`, '_blank')}
                              className="group flex flex-col md:flex-row items-center gap-4 p-4 rounded-3xl bg-[#202c33]/50 border border-white/5 shadow-2xl hover:bg-[#202c33]/80 hover:border-[var(--accent)]/30 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
                            >
                               <div className="size-20 md:size-24 rounded-2xl overflow-hidden border border-white/10 bg-[#111b21] shrink-0 group-hover:scale-[1.03] transition-transform duration-500">
                                  <img 
                                    src={msg.product_reference.images?.[0]?.url || msg.product_reference.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80'} 
                                    className="size-full object-cover" 
                                    alt="" 
                                  />
                               </div>
                               <div className="text-center md:text-left min-w-0 pr-4">
                                  <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5 ">
                                     <div className="size-1 rounded-full bg-[var(--accent)]" />
                                     <p className="text-[9px] font-black text-[var(--accent)] uppercase tracking-widest leading-none">Product Synchronization</p>
                                  </div>
                                  <h5 className="text-sm font-black text-[#e9edef] truncate max-w-[200px] uppercase tracking-tight mb-2 group-hover:text-[var(--accent)] transition-colors">{msg.product_reference.name}</h5>
                                  <div className="flex items-center justify-center md:justify-start gap-4">
                                     <p className="text-xs font-black text-[#aebac1] tabular-nums">{(msg.product_reference.price || 0).toLocaleString()} <span className="text-[9px] text-[var(--accent)]">XAF</span></p>
                                     <div className="h-3 w-px bg-white/10 hidden md:block" />
                                     <div className="hidden md:flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#aebac1] group-hover:text-white transition-colors">
                                        <ExternalLink className="size-3" />
                                        <span>Navigate</span>
                                     </div>
                                  </div>
                               </div>
                            </button>
                          </div>
                        )}
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] px-4 py-2.5 rounded-xl shadow-sm relative text-[15px] leading-relaxed ${isOwn ? 'bg-[#005c4b] text-[#e9edef]' : 'bg-[#202c33] text-[#e9edef]'}`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <div className="flex items-center justify-end gap-1 mt-1.5 opacity-40 text-[10px]">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isOwn && (msg.status === 'sending' ? <Check className="size-3" /> : <CheckCheck className="size-3 text-[#53bdeb]" />)}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}
               </div>
            </div>

            {/* Input Bar */}
            <div className="bg-[#202c33] px-4 py-3 flex items-center gap-4 shrink-0">
               <div className="flex items-center gap-5 text-[#aebac1]">
                  <Smile className="size-6 cursor-pointer opacity-70 hover:opacity-100" />
                  <Plus className="size-6 cursor-pointer opacity-70 hover:opacity-100" />
               </div>
               <form onSubmit={handleSend} className="flex-1">
                  <input 
                    type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Operational data synchronization..."
                    className="w-full bg-[#2a3942] border-none rounded-2xl py-3 px-5 text-[15px] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30 text-[#e9edef] placeholder:text-[#aebac1]/30"
                  />
               </form>
               <button onClick={handleSend} className="size-[48px] rounded-full flex items-center justify-center bg-[var(--accent)] text-white shadow-xl hover:scale-105 transition-all">
                  {newMessage.trim() ? <Send className="size-5" /> : <Mic className="size-5" />}
               </button>
            </div>
          </>
        )}
      </main>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}

export default function RedChatPage() {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated (after auth check completes)
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0c0c0c] flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--accent)]" size={32} />
      </div>
    );
  }

  // Only render if authenticated
  if (!user) return null;

  return (
    <Suspense fallback={<div className="fixed inset-0 bg-[#0c0c0c] flex items-center justify-center opacity-20"><Loader2 className="animate-spin" /></div>}>
      <ChatContent />
    </Suspense>
  );
}
