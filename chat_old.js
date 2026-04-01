"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search, MessageCircle, MoreVertical, 
  Send, Image as ImageIcon, Smile, 
  CheckCheck, ArrowLeft, Phone, Video,
  ShieldCheck, Loader2, User, Package,
  ExternalLink, X, LayoutGrid
} from 'lucide-react';
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
  
  const scrollRef = useRef(null);
  const activeChatRef = useRef(null);
  const userRef = useRef(null);

  // Socket Connection
  useEffect(() => {
    if (user?._id) {
      socketService.connect(user._id);
    }
    // Shared global socket handled by SocketProvider. don't disconnect on unmount
  }, [user]);

  // keep refs current for socket handlers
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  // Register global socket handlers using stable references to prevent duplicate listeners
  useEffect(() => {
    if (!user?._id) return;

    // Use _socketHandlerRef to maintain stable references across re-renders
    if (!window._socketHandlerRef) {
      window._socketHandlerRef = {};
    }

    // Check if this user already has handlers registered
    if (window._socketHandlerRef[user._id]) {
      return; // Already registered, don't register again
    }

    const handleIncoming = (msg) => {


      try {
        const currentUserId = userRef.current?._id?.toString();
        const active = activeChatRef.current;
        const activeId = active?._id?.toString();

        // Normalize IDs ΓÇö backend populates these as objects
        const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();
        const receiverId = (msg.receiver_id?._id || msg.receiver_id)?.toString();

        // ΓöÇΓöÇ Update sidebar preview ALWAYS ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        setInbox(prev => {
          const snippet = msg.text || (msg.product_reference?.name ? `≡ƒôª ${msg.product_reference.name}` : '');
          const isUnread = receiverId === currentUserId;
          
          // Safely extract partner
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
            // Move to top
            const item = updated.splice(existingIndex, 1)[0];
            return [item, ...updated];
          }
          return [newEntry, ...prev];
        });

        // ΓöÇΓöÇ Append to current viewing area if message is for active chat ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        if (activeId) {
          const partnerId = (senderId === currentUserId ? receiverId : senderId)?.toString();
          // Message belongs to active chat if it's between me and activeChat person
          const belongsToActiveChat = (
            (senderId === currentUserId && receiverId === activeId) ||
            (senderId === activeId && receiverId === currentUserId)
          );
          
          if (belongsToActiveChat) {

            setMessages(prev => {
              // Prevent duplicates
              if (msg._id && prev.some(m => m._id?.toString() === msg._id?.toString())) {

                return prev;
              }
              return [...prev, msg];
            });

            // Mark incoming messages as read
            if (receiverId === currentUserId) {
              api.patch(`/chat/read/${activeId}`).catch(() => {});
            }
          } else {

          }
        } else {

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

    // Store handlers for reference
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

  // Initial load: Fetch Inbox and handle query params
  useEffect(() => {
    // Wait until the auth token or user is available to avoid 401 on initial load
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

           // 1. Followed vendors (Potential Chats)
           following.forEach(f => {
              const partner = f.vendor_id?.user_id;
              if (!partner) return;
              combined.set(partner._id.toString(), {
                partner: { ...partner, store_name: f.vendor_id?.store_name },
                date: f.createdAt,
                snippet: 'Node established. Ready for transmission.',
                read_status: true
              });
           });

           // 2. Active chats (Priority)
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

    // If we already have messages for THIS person, don't re-fetch
    if (messages.length > 0 && currentFirstMsgPartner === activeId) {
       return; 
    }

    const fetchConversation = async () => {
      // Clear current messages to prevent ghosting or stale socket appends
      setMessages([]);
      try {
        const res = await api.get(`/chat/${activeId}`);
        if (res.data.success) {
          setMessages(res.data.data.messages);
          // Mark as read
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

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ΓöÇΓöÇ Visibility Resume Sync ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  // When user returns to the app after being backgrounded, re-fetch the active
  // conversation to pull in any messages that arrived while the socket was dormant.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeChatRef.current?._id) {
        const activeId = activeChatRef.current._id.toString();
        console.log('[Chat] App resumed ΓÇö re-syncing messages for:', activeId);
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
    const currentProductRef = draftProduct
      ? {
          _id: draftProduct._id,
          name: draftProduct.name,
          price: draftProduct.price,
          images: draftProduct.images,
        }
      : null;
    const tempId = `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const optimisticMsg = {
      _id: tempId,
      sender_id: user?._id,
      receiver_id: activeChat._id,
      text,
      createdAt: new Date().toISOString(),
      pending: true,
      product_reference: currentProductRef,
    };

    // Append optimistic message immediately
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');

    try {
      const res = await api.post('/chat', {
        receiver_id: activeChat._id,
        text,
        product_reference: draftProduct ? draftProduct._id : (searchParams.get('productId') || null)
      });

      if (res.data.success) {
        const serverMsg = res.data.data.message;
        // Replace optimistic message with server message and remove any duplicate server id if present
        setMessages(prev => {
          const withoutServer = prev.filter(m => m._id !== serverMsg._id);
          return withoutServer.map(m => (m._id === tempId ? serverMsg : m));
        });

        // Update inbox entry for partner to show latest snippet
        setInbox(prev => {
          const partnerId = activeChat._id.toString();
          const snippet = serverMsg.text || (serverMsg.product_reference && serverMsg.product_reference.name) || '';
          const existing = prev.find(c => (c.partner?._id || c.partner)?.toString() === partnerId);
          const newEntry = { partner: activeChat, snippet, date: new Date().toISOString(), read_status: true };
          if (existing) {
            return [ { ...existing, snippet: newEntry.snippet, date: newEntry.date, read_status: true }, ...prev.filter(c => (c.partner?._id || c.partner)?.toString() !== partnerId) ];
          }
          return [ newEntry, ...prev ];
        });

        if (draftProduct || searchParams.get('productId')) {
          setDraftProduct(null);
          const currentVendorId = (searchParams.get('vendorId') || activeChat?._id || '').toString();
          router.replace(currentVendorId ? `/messages?vendorId=${currentVendorId}` : '/messages');
        }
      } else {
        // mark optimistic as failed
        setMessages(prev => prev.map(m => m._id === tempId ? { ...m, pending: false, failed: true } : m));
      }
    } catch (err) {
      console.error('Failed to send message', err);
      setMessages(prev => prev.map(m => m._id === tempId ? { ...m, pending: false, failed: true } : m));
    } finally {
      setSending(false);
    }
  };

  const filteredInbox = useMemo(() => {
    return inbox.filter(c => 
      c.partner.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [inbox, searchQuery]);

  const dashboardHref = user?.role === 'admin'
    ? '/admin/dashboard'
    : user?.role === 'vendor'
      ? '/vendor/dashboard'
      : user?.role === 'logistics'
        ? '/logistics/dashboard'
        : '/discovery';

  return (
    <div className="fixed inset-0 bg-[var(--bg-secondary)] flex transition-colors duration-500 overflow-hidden min-h-0">
      {/* Sidebar List */}
      <aside className={`w-full md:w-[350px] bg-[var(--bg-primary)] border-r border-[var(--glass-border)] flex flex-col min-h-0 ${activeChat ? 'hidden md:flex' : 'flex'} transition-colors relative z-20`}>
        <div className="p-4 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-primary)]/80 backdrop-blur-md">
            <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tighter uppercase leading-none">COMM <span className="text-[var(--accent)]">CENTER</span></h1>
            <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.25em] mt-1.5 opacity-60 flex items-center gap-1.5 leading-none">
               <span className={`size-2 rounded-full ${socketService.connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 animate-pulse'}`} />
               Operational Pipe
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(dashboardHref)}
              className="h-10 px-3 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] flex items-center justify-center gap-1.5 hover:text-[var(--text-primary)] transition-all shadow-sm"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">Dashboard</span>
            </button>
            <button className="size-10 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:text-[var(--text-primary)] transition-all shadow-sm"><MoreVertical className="w-5 h-5" /></button>
          </div>
        </div>
        
            <div className="p-4">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]/40 group-focus-within:text-[var(--accent)] transition-colors" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all text-sm placeholder:opacity-60" 
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 px-3 pb-3">
          <div className="h-full bg-[var(--bg-primary)]/40 rounded-[32px] border border-[var(--glass-border)] flex flex-col overflow-hidden backdrop-blur-xl">
            <div className="px-4 py-3 border-b border-[var(--glass-border)] flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Synchronized Conversations</span>
              <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 no-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 opacity-40">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">Loading messages...</p>
                </div>
              ) : filteredInbox.length === 0 ? (
                <div className="py-16 text-center px-8 opacity-40">
                  <MessageCircle className="w-10 h-10 text-[var(--text-secondary)]/30 mx-auto mb-3" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] leading-loose">
                    No active connections.
                    <br />
                    Start a conversation.
                  </p>
                </div>
              ) : (
                filteredInbox.map((chat) => (
              <button
                  key={chat.partner._id}
                  onClick={() => setActiveChat(chat.partner)}
                  className={`w-full p-4 rounded-2xl border flex items-center gap-4 transition-all relative group overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 ${activeChat?._id === chat.partner._id ? 'bg-[var(--bg-primary)] border-[var(--accent)]/40' : 'bg-[var(--bg-primary)] border-[var(--glass-border)] hover:border-[var(--accent)]/40'}`}
                >
                <div className="relative shrink-0">
                  <div className="size-12 rounded-xl overflow-hidden bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-primary)] font-bold text-base border border-[var(--glass-border)]">
                     {chat.partner.branding?.logo || chat.partner.avatar ? <img src={chat.partner.branding?.logo || chat.partner.avatar} className="w-full h-full object-cover" alt="Avatar" /> : chat.partner.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-[var(--bg-primary)]" />
                </div>
                  <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <h3 className="font-bold !text-[9px] text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors truncate whitespace-nowrap pr-2 max-w-[140px]">
                      {chat.partner.store_name || chat.partner.name}
                    </h3>
                    <span className="!text-[8px] font-black text-[var(--text-secondary)] opacity-40 whitespace-nowrap uppercase">
                      {new Date(chat.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                    <p className={`!text-[10px] font-bold uppercase tracking-widest truncate whitespace-nowrap mt-1 ${!chat.read_status ? 'text-[var(--text-primary)] opacity-90' : 'text-[var(--text-secondary)] opacity-40'}`}>
                    {chat.snippet || 'No messages yet'}
                  </p>
                </div>
                {!chat.read_status && (
                  <div className="absolute top-1/2 right-6 -translate-y-1/2 size-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" />
                )}
              </button>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)] transition-colors relative h-full ${activeChat ? 'flex' : 'hidden md:flex items-center justify-center'}`}>
        
        {activeChat ? (
          <>
            <div className="px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChat(null)} className="md:hidden size-9 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-primary)]"><ArrowLeft className="w-5 h-5" /></button>
                <div className="size-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-primary)] font-bold text-base border border-[var(--glass-border)] overflow-hidden">
                  {activeChat.branding?.logo || activeChat.avatar ? <img src={activeChat.branding?.logo || activeChat.avatar} className="size-full object-cover rounded-full" alt="" /> : activeChat.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="!text-[10px] font-semibold text-[var(--text-primary)] leading-none mb-1 truncate whitespace-nowrap max-w-[150px] xs:max-w-[190px] sm:max-w-[260px]">{activeChat.store_name || activeChat.name}</h2>
                  <div className="flex items-center gap-1">
                    <div className="size-1.5 rounded-full bg-emerald-500" />
                    <p className="!text-[10px] text-[var(--text-secondary)]">Online</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden lg:flex items-center pr-3 border-r border-[var(--glass-border)] mr-1">
                   <p className="text-xs text-[var(--text-secondary)] opacity-80">Role: <span className="font-semibold text-[var(--text-primary)] capitalize">{activeChat.role || 'Partner'}</span></p>
                </div>
                <button className="size-10 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] transition-all"><Phone className="w-4 h-4" /></button>
                <button className="size-10 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] transition-all"><Video className="w-4 h-4" /></button>
                <button className="size-10 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] transition-all"><MoreVertical className="w-4 h-4" /></button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 md:p-6 space-y-3 flex flex-col no-scrollbar relative z-10">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 gap-3 mt-10">
                  <div className="size-16 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-2">
                    <MessageCircle className="w-8 h-8 text-[var(--text-secondary)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Say hello!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender_id === user?._id || msg.sender_id?._id === user?._id;
                  return (
                    <div key={msg._id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      {msg.product_reference && (
                        <div className={`mb-2 w-64 p-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] shadow-sm overflow-hidden group`}>
                           <div className="aspect-[4/3] rounded-xl overflow-hidden mb-2 relative bg-[var(--bg-primary)]">
                              <img src={msg.product_reference.images?.[0]?.url || msg.product_reference.images?.[0]} alt="" className="size-full object-cover" />
                              <div className="absolute top-2 right-2 flex gap-1">
                                <Link href={`/products/${msg.product_reference._id}`} className="size-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[var(--accent)] transition-colors">
                                  <ExternalLink className="w-4 h-4" />
                                </Link>
                              </div>
                           </div>
                           <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">Product Attached</p>
                           <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1 truncate">{msg.product_reference.name}</h4>
                           <div className="flex justify-between items-center">
                              <span className="text-sm font-bold text-[var(--text-primary)]">{msg.product_reference.price?.toLocaleString()} XAF</span>
                              <Link href={`/products/${msg.product_reference._id}`} className="text-[10px] font-semibold text-[var(--accent)] hover:underline">View</Link>
                           </div>
                        </div>
                      )}
                      
                      <div className={`max-w-[80%] md:max-w-[70%] px-4 py-2.5 rounded-2xl text-[10px] relative group ${
                        isMe 
                        ? 'bg-[var(--accent)] text-white' 
                        : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                      }`}
                      style={isMe ? { borderBottomRightRadius: '4px' } : { borderBottomLeftRadius: '4px' }}>
                        <p className="min-w-[40px] break-words whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        <div className={`flex items-center gap-1.5 opacity-60 mt-1 select-none ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] whitespace-nowrap">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && (
                            msg.pending ? <Loader2 className="w-3 h-3 animate-spin" /> : msg.failed ? <span className="text-red-400 font-bold text-xs">!</span> : <CheckCheck className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-3 py-2 bg-[var(--bg-primary)] border-t border-[var(--glass-border)] z-30 relative pb-[max(8px,env(safe-area-inset-bottom))]">
              {draftProduct && (
                <div className="absolute bottom-[100%] left-1/2 -translate-x-1/2 mb-4 bg-[var(--bg-secondary)]/95 backdrop-blur-xl border border-[var(--glass-border)] rounded-[1.5rem] p-3 flex gap-4 shadow-2xl animate-fade-in-up w-[90%] max-w-sm items-center">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[var(--glass-border)] bg-[var(--bg-primary)]">
                     {draftProduct.images?.[0] ? <img src={draftProduct.images[0].url || draftProduct.images[0]} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 m-auto opacity-20" />}
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-[9px] font-black uppercase text-[var(--accent)] tracking-widest leading-none mb-1">Drafting inquiry on</p>
                     <p className="text-sm font-bold text-[var(--text-primary)] truncate leading-tight">{draftProduct.name}</p>
                  </div>
                  <button 
                     onClick={() => {
                       setDraftProduct(null);
                       const currentVendorId = (searchParams.get('vendorId') || activeChat?._id || '').toString();
                       router.replace(currentVendorId ? `/messages?vendorId=${currentVendorId}` : '/messages');
                     }} 
                     className="size-8 flex items-center justify-center shrink-0 rounded-full bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/10 border border-[var(--glass-border)] transition-colors shadow-sm"
                  >
                     <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="bg-[var(--bg-secondary)] px-2 py-1.5 rounded-full flex items-center gap-1.5 w-full max-w-4xl mx-auto min-w-0">
                <button type="button" className="hidden sm:flex size-10 shrink-0 rounded-full hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] transition-colors items-center justify-center"><ImageIcon className="w-5 h-5" /></button>
                <div className="hidden sm:block h-5 w-px bg-[var(--glass-border)]" />
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..." 
                  className="flex-1 bg-transparent border-none outline-none px-2 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-70 min-w-0"
                />
                <button type="button" className="hidden sm:flex size-10 shrink-0 rounded-full hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] transition-colors items-center justify-center"><Smile className="w-5 h-5" /></button>
                <button 
                  disabled={!newMessage.trim() || sending}
                  className="size-9 sm:size-10 shrink-0 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition-colors flex items-center justify-center disabled:opacity-40"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4 -ml-0.5" />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center p-8 space-y-6">
            <div className="size-24 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
              <MessageCircle className="size-10 text-[var(--text-secondary)]" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Your Messages</h2>
              <p className="text-[var(--text-secondary)] text-sm">
                Select a conversation from the sidebar or start a new message to connect with a vendor or buyer.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatContent />
    </Suspense>
  );
}

const ShoppingBag = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
);
