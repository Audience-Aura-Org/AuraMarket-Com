"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search, MessageCircle, MoreVertical, 
  Send, Image as ImageIcon, Smile, 
  CheckCheck, ArrowLeft, Phone, Video,
  ShieldCheck, Loader2, User, Package,
  ExternalLink, X, LayoutGrid, Sparkles,
  Command, Activity, Zap, Cpu, MonitorSmartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';
import Link from 'next/link';

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
  const [draftProduct, setDraftProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef(null);
  
  const scrollRef = useRef(null);
  const activeChatRef = useRef(null);
  const userRef = useRef(null);

  // Socket Connection
  useEffect(() => {
    if (user?._id) {
      socketService.connect(user._id);
    }
  }, [user]);

  // keep refs current for socket handlers
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  // Register global socket handlers
  useEffect(() => {
    if (!user?._id) return;

    if (!window._socketHandlerRef) {
      window._socketHandlerRef = {};
    }

    if (window._socketHandlerRef[user._id]) {
      return; 
    }

    const handleIncoming = (msg) => {
      try {
        const currentUserId = userRef.current?._id?.toString();
        const active = activeChatRef.current;
        const activeId = active?._id?.toString();

        const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();
        const receiverId = (msg.receiver_id?._id || msg.receiver_id)?.toString();

        setInbox(prev => {
          const snippet = msg.text || (msg.product_reference?.name ? `📦 ${msg.product_reference.name}` : '');
          const isUnread = receiverId === currentUserId;
          
          const partnerData = senderId === currentUserId ? msg.receiver_id : msg.sender_id;
          const partnerId = (partnerData?._id || (senderId === currentUserId ? receiverId : senderId))?.toString();
          
          if (!partnerId) return prev;
          
          const newEntry = { 
            partner: partnerData || { _id: partnerId }, 
            snippet, 
            date: new Date().toISOString(), 
            read_status: !isUnread 
          };
          
          const existingIndex = prev.findIndex(c => (c.partner?._id || c.partner)?.toString() === partnerId);
          if (existingIndex > -1) {
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], snippet: newEntry.snippet, date: newEntry.date, read_status: newEntry.read_status };
            const item = updated.splice(existingIndex, 1)[0];
            return [item, ...updated];
          }
          return [newEntry, ...prev];
        });

        if (activeId) {
          const belongsToActiveChat = (
            (senderId === currentUserId && receiverId === activeId) ||
            (senderId === activeId && receiverId === currentUserId)
          );
          
          if (belongsToActiveChat) {
            setMessages(prev => {
              if (msg._id && prev.some(m => m._id?.toString() === msg._id?.toString())) {
                return prev;
              }
              return [...prev, msg];
            });

            if (receiverId === currentUserId) {
              api.patch(`/chat/read/${activeId}`).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('[Chat] Socket handler error:', err);
      }
    };

    const handleReadSync = ({ sender_id }) => {
      if (!sender_id) return;
      const sid = sender_id.toString();
      setInbox(prev => prev.map(c => (c.partner._id || c.partner)?.toString() === sid ? { ...c, read_status: true } : c));
    };

    window._socketHandlerRef[user._id] = { handleIncoming, handleReadSync };

    socketService.on('receive_message', handleIncoming);
    socketService.on('sent_message_echo', handleIncoming);
    socketService.on('messages_read', handleReadSync);

    return () => {
      socketService.off('receive_message', handleIncoming);
      socketService.off('sent_message_echo', handleIncoming);
      socketService.off('messages_read', handleReadSync);
      
      if (window._socketHandlerRef?.[user._id]) {
        delete window._socketHandlerRef[user._id];
      }
    };
  }, [user?._id]);

  // Initial load
  useEffect(() => {
    if (!token && !user?._id) {
      setLoading(false);
      return;
    }

    const initChat = async () => {
      setLoading(true);
      try {
        const [inboxRes, followRes] = await Promise.all([
           api.get('/chat'),
           api.get('/vendors/following').catch(() => ({ data: { success: true, data: { following: [] } } }))
        ]);

        if (inboxRes.data.success && followRes.data.success) {
           const activeChats = inboxRes.data.data.activeChats || [];
           const following = followRes.data.data.following || [];
           const combined = new Map();

           following.forEach(f => {
              const partner = f.vendor_id?.user_id;
              if (!partner) return;
              combined.set(partner._id.toString(), {
                partner: { ...partner, store_name: f.vendor_id?.store_name },
                date: f.createdAt,
                snippet: 'Connection established. Secure node ready.',
                read_status: true
              });
           });

           activeChats.forEach(c => {
              const pid = (c.partner?._id || c.partner)?.toString();
              if (!pid) return;
              combined.set(pid, {
                partner: c.partner,
                date: c.date,
                snippet: c.snippet,
                read_status: c.read_status
              });
           });

           const chats = Array.from(combined.values()).sort((a,b) => new Date(b.date) - new Date(a.date));
           setInbox(chats);

           const vendorId = searchParams.get('vendorId');
           const productId = searchParams.get('productId');
           
           const promises = [];
           if (vendorId) {
             const existing = chats.find(c => (c.partner?._id || c.partner)?.toString() === vendorId.toString());
             if (existing) {
                setActiveChat(existing.partner);
             } else {
                promises.push(api.get(`/auth/users/${vendorId}`).then(res => {
                  if (res.data.success) setActiveChat(res.data.data.user);
                }));
             }
             
             promises.push(api.get(`/chat/${vendorId}`).then(res => {
                if (res.data.success && res.data.data.messages.length > 0) {
                   setMessages(res.data.data.messages);
                   if (res.data.data.messages.some(m => !m.read_status && m.receiver_id === user?._id)) {
                      api.patch(`/chat/read/${vendorId}`).catch(() => {});
                      socketService.emit('messages_read', { sender_id: vendorId });
                   }
                }
             }));
           }
           
           if (productId) {
             promises.push(api.get(`/products/${productId}`).then(res => {
               if (res.data.success) setDraftProduct(res.data.data.product);
             }).catch(console.warn));
           }

           if (promises.length > 0) await Promise.allSettled(promises);
        }
      } catch (err) {
        console.error('Failed to load chat inbox', err);
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [searchParams, user?._id, token]);

  // Fetch conversation when activeChat changes
  useEffect(() => {
    if (!activeChat) return;

    const activeId = activeChat._id.toString();
    const currentFirstMsgPartner = messages[0] 
      ? (
          (messages[0].sender_id?._id || messages[0].sender_id)?.toString() === user?._id?.toString() 
          ? (messages[0].receiver_id?._id || messages[0].receiver_id)?.toString() 
          : (messages[0].sender_id?._id || messages[0].sender_id)?.toString()
        ) 
      : null;

    if (messages.length > 0 && currentFirstMsgPartner === activeId) {
       return; 
    }

    const fetchConversation = async () => {
      setMessages([]);
      try {
        const res = await api.get(`/chat/${activeId}`);
        if (res.data.success) {
          setMessages(res.data.data.messages);
          if (res.data.data.messages.some(m => !m.read_status && (m.receiver_id?._id || m.receiver_id) === user?._id)) {
            api.patch(`/chat/read/${activeId}`).catch(err => console.error("Read sync failed", err));
            socketService.emit('messages_read', { sender_id: activeId });
          }
        }
      } catch (err) {
        console.error('Failed to fetch conversation', err);
      }
    };

    fetchConversation();
  }, [activeChat?._id, user?._id]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Visibility Resume Sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeChatRef.current?._id) {
        const activeId = activeChatRef.current._id.toString();
        api.get(`/chat/${activeId}`).then(res => {
          if (res.data.success) {
            setMessages(res.data.data.messages);
          }
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const hasPending = messages.some(m => m.pending);
    if (!newMessage.trim() || !activeChat || sending || hasPending) return;

    setSending(true);
    const text = newMessage.trim();
    const currentProductRef = draftProduct ? {
      _id: draftProduct._id,
      name: draftProduct.name,
      price: draftProduct.price,
      images: draftProduct.images,
    } : null;
    
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      _id: tempId,
      sender_id: user?._id,
      receiver_id: activeChat._id,
      text,
      createdAt: new Date().toISOString(),
      pending: true,
      product_reference: currentProductRef,
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');

    try {
      const formData = new FormData();
      formData.append('receiver_id', activeChat._id);
      formData.append('text', text);
      if (selectedImage) formData.append('image', selectedImage);
      if (draftProduct) formData.append('product_reference', draftProduct._id);
      else if (searchParams.get('productId')) formData.append('product_reference', searchParams.get('productId'));

      const res = await api.post('/chat', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        const serverMsg = res.data.data.message;
        setMessages(prev => {
          const withoutServer = prev.filter(m => m._id !== serverMsg._id);
          return withoutServer.map(m => (m._id === tempId ? serverMsg : m));
        });

        setInbox(prev => {
          const partnerId = activeChat._id.toString();
          const existing = prev.find(c => (c.partner?._id || c.partner)?.toString() === partnerId);
          const newEntry = { partner: activeChat, snippet: text, date: new Date().toISOString(), read_status: true };
          if (existing) {
            return [ { ...existing, snippet: text, date: new Date().toISOString(), read_status: true }, ...prev.filter(c => (c.partner?._id || c.partner)?.toString() !== partnerId) ];
          }
          return [ newEntry, ...prev ];
        });

        if (draftProduct || searchParams.get('productId')) {
          setDraftProduct(null);
          router.replace(`/messages?vendorId=${activeChat._id}`);
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m._id === tempId ? { ...m, pending: false, failed: true } : m));
    } finally {
      setSending(false);
    }
  };

  const filteredInbox = useMemo(() => {
    return inbox.filter(c => 
      (c.partner.store_name || c.partner.name)?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [inbox, searchQuery]);

  const dashboardHref = user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'vendor' ? '/vendor/dashboard' : '/discovery';

  return (
    <div className="fixed inset-0 z-[9999] bg-[var(--bg-secondary)] flex transition-colors duration-500 overflow-hidden min-h-0 font-[Poppins,sans-serif]">
      
      {/* Sidebar List - Ultra Premium Refined */}
      <aside className={`w-full md:w-[380px] bg-[var(--bg-primary)] border-r border-[var(--glass-border)] flex flex-col min-h-0 ${activeChat ? 'hidden md:flex' : 'flex'} transition-all duration-500 relative z-20`}>
        
        {/* Sidebar Header */}
        <div className="px-6 py-8 flex flex-col gap-6 bg-gradient-to-b from-[var(--bg-primary)] to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tighter uppercase leading-none">
                Aura<span className="text-[var(--accent)]">Comms</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                 <div className={`size-1.5 rounded-full ${socketService.connected ? 'bg-emerald-500 shadow-[0_0_8px_var(--emerald-500)]' : 'bg-red-500'}`} />
                 <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40">System Active</span>
              </div>
            </div>
            <button 
              onClick={() => router.push(dashboardHref)}
              className="size-12 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all shadow-sm"
            >
              <LayoutGrid className="size-5" />
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]/30 group-focus-within:text-[var(--accent)] transition-all" />
            <input 
              type="text" 
              placeholder="Filter transmissions..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-12 pr-6 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] outline-none text-xs font-bold tracking-tight text-[var(--text-primary)] placeholder:opacity-40 focus:border-[var(--accent)]/50 transition-all backdrop-blur-xl" 
            />
          </div>
        </div>

        {/* Inbox Scroll Area */}
        <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
           <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30">
                  <Activity className="size-8 animate-pulse text-[var(--accent)]" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Hydrating Nodes...</p>
                </div>
              ) : filteredInbox.length === 0 ? (
                <div className="py-20 text-center px-10">
                  <div className="size-16 rounded-[2rem] bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center mx-auto mb-6 opacity-20">
                     <MessageCircle className="size-8" />
                  </div>
                  <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight opacity-40">No Signal Detected</h3>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-30 tracking-wide mt-2">Search for a vendor to initiate a secure connection.</p>
                </div>
              ) : (
                filteredInbox.map((chat) => (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={chat.partner._id}
                    onClick={() => setActiveChat(chat.partner)}
                    className={`w-full p-4 rounded-[1.5rem] flex items-center gap-4 transition-all relative group mb-1.5 ${
                      activeChat?._id === chat.partner._id 
                      ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30 shadow-lg shadow-[var(--accent)]/5' 
                      : 'bg-transparent border border-transparent hover:bg-[var(--bg-secondary)]/50 hover:border-[var(--glass-border)]'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="size-11 rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-sm">
                         {chat.partner.branding?.logo || chat.partner.avatar ? (
                           <img src={chat.partner.branding?.logo || chat.partner.avatar} className="size-full object-cover" alt="" />
                         ) : (
                           <div className="size-full flex items-center justify-center text-lg font-black text-[var(--accent)]">
                             {chat.partner.name?.[0]?.toUpperCase()}
                           </div>
                         )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 size-4 rounded-full bg-emerald-500 border-2 border-[var(--bg-primary)] shadow-[0_0_8px_var(--emerald-500)]" />
                    </div>
                    
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black uppercase text-[var(--text-primary)] truncate max-w-[140px] tracking-tight">
                          {chat.partner.store_name || chat.partner.name}
                        </span>
                        <span className="text-[8px] font-black text-[var(--text-secondary)] opacity-30 shrink-0">
                          {new Date(chat.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className={`text-[10px] font-bold truncate leading-snug tracking-tight ${!chat.read_status ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-50'}`}>
                        {chat.snippet}
                      </p>
                    </div>

                    {!chat.read_status && (
                      <div className="size-2 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
                    )}
                  </motion.button>
                ))
              )}
           </div>
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-6 border-t border-[var(--glass-border)] opacity-30">
           <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.4em]">Node Protocol v4</span>
              <ShieldCheck className="size-3.5" />
           </div>
        </div>
      </aside>

      {/* Main Chat Interface - High Contrast Premium */}
      <main className={`flex-1 flex flex-col min-h-0 bg-[var(--bg-secondary)] transition-all relative ${activeChat ? 'flex' : 'hidden md:flex items-center justify-center'} overflow-hidden`}>
        
        {/* Background glow effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--accent)]/3 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500/3 blur-[100px] rounded-full pointer-events-none" />

        {activeChat ? (
          <>
            {/* Chat Header */}
            <header className="px-8 py-5 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/40 backdrop-blur-3xl flex items-center justify-between relative z-30">
              <div className="flex items-center gap-6">
                 <button onClick={() => setActiveChat(null)} className="md:hidden size-12 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-primary)]">
                    <ArrowLeft className="size-5" />
                 </button>
                 <div className="flex items-center gap-4 group cursor-pointer">
                    <div className="size-12 rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-2xl group-hover:scale-105 transition-all">
                       {activeChat.branding?.logo || activeChat.avatar ? <img src={activeChat.branding?.logo || activeChat.avatar} className="size-full object-cover" alt="" /> : <div className="size-full flex items-center justify-center font-black text-[var(--accent)]">{activeChat.name?.[0]}</div>}
                    </div>
                    <div className="flex flex-col">
                       <h2 className="text-sm font-black uppercase text-[var(--text-primary)] tracking-tight leading-none mb-1">{activeChat.store_name || activeChat.name}</h2>
                       <div className="flex items-center gap-2">
                          <Activity className="size-3 text-emerald-500" />
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60">Verified Node • Online</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-3 relative">
                 <div className="hidden lg:flex items-center gap-8 mr-6 opacity-30 px-6 border-r border-[var(--glass-border)] h-8">
                    <div className="flex flex-col items-center">
                       <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-primary)]">Role</span>
                       <span className="text-[10px] font-bold text-[var(--accent)]">{activeChat.role || 'User'}</span>
                    </div>
                 </div>
                 <button className="size-10 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                    <Phone className="size-4" />
                 </button>
                 <button className="size-10 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                    <Video className="size-4" />
                 </button>
                 <div className="relative">
                   <button 
                     onClick={() => setShowMenu(!showMenu)}
                     className={`size-10 rounded-2xl border flex items-center justify-center transition-all ${showMenu ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg-primary)]/40 border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)]'}`}
                   >
                      <MoreVertical className="size-4" />
                   </button>
                   <AnimatePresence>
                     {showMenu && (
                       <motion.div 
                         initial={{ opacity: 0, y: 10, scale: 0.95 }}
                         animate={{ opacity: 1, y: 0, scale: 1 }}
                         exit={{ opacity: 0, y: 10, scale: 0.95 }}
                         className="absolute right-0 mt-2 w-48 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl shadow-2xl p-2 z-[100] backdrop-blur-3xl overflow-hidden"
                       >
                         <div className="flex flex-col gap-1">
                            <button className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] rounded-xl transition-all flex items-center gap-2">
                               <ShieldCheck className="size-3.5" /> Report Node
                            </button>
                            <button className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] rounded-xl transition-all flex items-center gap-2 text-red-400">
                               <X className="size-3.5" /> Clear Pipe
                            </button>
                         </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>
              </div>
            </header>

            {/* Conversation Experience */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-8 no-scrollbar relative z-10 scroll-smooth">
              <AnimatePresence initial={false}>
                {messages.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center text-center py-20 gap-6 grayscale opacity-20"
                  >
                    <div className="size-24 rounded-[3rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-2xl flex items-center justify-center mb-4">
                       <Command className="size-10" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] max-w-xs">Establish secure protocol for {activeChat.store_name || activeChat.name}</p>
                  </motion.div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.sender_id === user?._id || msg.sender_id?._id === user?._id;
                    return (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        key={msg._id || i} 
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        {msg.product_reference && (
                          <div className="mb-4 w-72 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl overflow-hidden shadow-2xl ring-1 ring-[var(--accent)]/10">
                             <div className="aspect-[16/10] relative group">
                                <img src={msg.product_reference.images?.[0]?.url || msg.product_reference.images?.[0]} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                                   <div className="flex-1">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] mb-1 block">Ref Node #{msg.product_reference._id.slice(-6).toUpperCase()}</span>
                                      <h4 className="text-white font-black uppercase text-sm leading-none">{msg.product_reference.name}</h4>
                                   </div>
                                </div>
                             </div>
                             <div className="p-5 flex items-center justify-between">
                                <div className="flex flex-col">
                                   <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase">Market Price</span>
                                   <span className="text-md font-black text-[var(--text-primary)]">{msg.product_reference.price?.toLocaleString()} XAF</span>
                                </div>
                                <Link href={`/products/${msg.product_reference._id}`} className="size-10 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center hover:scale-[0.96] active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20">
                                   <ExternalLink className="size-4" />
                                </Link>
                             </div>
                          </div>
                        )}
                        
                        <div className={`group relative max-w-[85%] md:max-w-[70%] px-3 py-1.5 rounded-2xl text-[13px] shadow-sm transition-all duration-300 ${
                          isMe 
                          ? 'bg-[var(--accent)] text-white border border-[var(--accent)]/10' 
                          : 'bg-[var(--bg-primary)]/90 backdrop-blur-xl text-[var(--text-primary)] border border-[var(--glass-border)]'
                        }`}
                        style={isMe ? { borderTopRightRadius: '2px' } : { borderTopLeftRadius: '2px' }}>
                          <p className="font-medium tracking-tight leading-snug whitespace-pre-wrap">{msg.text}</p>
                          <div className={`flex items-center gap-2 mt-1 opacity-50 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[9px] font-bold uppercase tracking-tight">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && (
                              <div className="flex items-center">
                                {msg.pending ? <Activity className="size-2.5 animate-pulse" /> : msg.failed ? <X className="size-2.5 text-red-400" /> : <CheckCheck className="size-2.5" />}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {/* Input Hub - Signature Floating Experience */}
            <div className="px-6 py-8 bg-gradient-to-t from-[var(--bg-secondary)] via-[var(--bg-secondary)]/90 to-transparent relative z-30">
              <form onSubmit={handleSendMessage} className="max-w-[1000px] mx-auto relative group">
                
                {/* Image Preview Overlay */}
                <AnimatePresence>
                  {imagePreview && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                      className="absolute bottom-full left-0 mb-6 bg-[var(--bg-primary)]/90 border border-[var(--glass-border)] rounded-2xl p-2 shadow-2xl flex items-center gap-3 overflow-hidden"
                    >
                       <div className="size-20 rounded-xl overflow-hidden border border-[var(--glass-border)]">
                          <img src={imagePreview} className="size-full object-cover" />
                       </div>
                       <button 
                         type="button"
                         onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                         className="size-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all mr-2"
                       >
                          <X className="size-4" />
                       </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Draft Product Indicator */}
                <AnimatePresence>
                  {draftProduct && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                      className="absolute bottom-full left-0 right-0 mb-6 bg-[var(--bg-primary)]/90 backdrop-blur-3xl border border-[var(--accent)]/30 rounded-2xl p-3 flex items-center gap-4 shadow-2xl"
                    >
                      <div className="size-12 rounded-xl overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] shrink-0">
                         {draftProduct.images?.[0] ? <img src={draftProduct.images[0].url || draftProduct.images[0]} className="size-full object-cover" /> : <Package className="size-5 opacity-20 m-auto h-full" />}
                      </div>
                      <div className="flex-1">
                         <span className="text-[9px] font-black uppercase tracking-widest text-[var(--accent)] mb-0.5 block">Inquiry Protocol Active</span>
                         <h4 className="text-xs font-black text-[var(--text-primary)] uppercase leading-none">{draftProduct.name}</h4>
                      </div>
                      <button 
                         type="button"
                         onClick={() => setDraftProduct(null)} 
                         className="size-10 rounded-xl bg-[var(--bg-secondary)] text-red-400 hover:bg-red-400/10 border border-[var(--glass-border)] transition-all flex items-center justify-center shrink-0"
                      >
                         <X className="size-4" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="glass-panel p-1.5 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 backdrop-blur-3xl flex items-center gap-2 group-focus-within:border-[var(--accent)]/40 transition-all duration-500 shadow-2xl">
                   <div className="flex items-center px-2 gap-2">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                             setSelectedImage(file);
                             setImagePreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className={`size-11 rounded-full flex items-center justify-center transition-all ${selectedImage ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
                      >
                         <ImageIcon className="size-5" />
                      </button>
                      <button type="button" className="size-11 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition-all flex items-center justify-center"><Smile className="size-5" /></button>
                   </div>
                   
                   <div className="w-px h-6 bg-[var(--glass-border)] opacity-30 mx-1" />

                   <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Node transmission..." 
                      className="flex-1 h-12 bg-transparent border-none outline-none px-4 text-xs font-bold text-[var(--text-primary)] placeholder:opacity-30 tracking-tight"
                   />

                   <button 
                      type="submit"
                      disabled={(!newMessage.trim() && !selectedImage) || sending}
                      className="size-12 rounded-full bg-[var(--accent)] text-white hover:scale-[0.96] active:scale-95 transition-all flex items-center justify-center disabled:opacity-40 shadow-xl shadow-[var(--accent)]/30 shrink-0"
                   >
                      {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5 transform -rotate-12" />}
                   </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center max-w-lg mx-auto">
             <div className="w-[300px] h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent opacity-40 mb-12" />
             <div className="size-32 rounded-[4rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-2xl flex items-center justify-center mb-8 group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-[var(--accent)]/10 to-transparent animate-pulse" />
                <Zap className="size-10 text-[var(--accent)] relative z-10 transition-transform group-hover:scale-125 duration-700" />
             </div>
             <h2 className="text-4xl font-black uppercase tracking-tighter text-[var(--text-primary)] mb-4">Aura Communication</h2>
             <p className="text-sm font-bold text-[var(--text-secondary)] opacity-50 tracking-tight leading-relaxed mb-10">
                End-to-end encrypted hub for premium commerce interactions. Select a node from the sidebar to initialize secure data stream.
             </p>
             <div className="flex items-center gap-10 opacity-30">
                <div className="flex flex-col items-center gap-2">
                   <ShieldCheck className="size-6" />
                   <span className="text-[9px] font-black uppercase tracking-widest">E2E Ready</span>
                </div>
                <div className="h-8 w-px bg-[var(--glass-border)]" />
                <div className="flex flex-col items-center gap-2">
                   <Activity className="size-6" />
                   <span className="text-[9px] font-black uppercase tracking-widest">Hydrated</span>
                </div>
                <div className="h-8 w-px bg-[var(--glass-border)]" />
                <div className="flex flex-col items-center gap-2">
                   <MonitorSmartphone className="size-6" />
                   <span className="text-[9px] font-black uppercase tracking-widest">Responsive</span>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
       <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
          <Loader2 className="size-10 animate-spin text-[var(--accent)]" />
       </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
