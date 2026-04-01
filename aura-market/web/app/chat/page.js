"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Send, Search, MoreVertical, Paperclip, Smile, Image as ImageIcon, 
  ChevronLeft, Check, CheckCheck, User, Package, Clock, ShieldCheck, 
  Activity, X, Loader2, ArrowLeft, Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/services/api";
import socketService from "@/services/socket";
import { useAuthStore } from "@/hooks/useAuth";

export default function ChatPage() {
  const { user } = useAuthStore();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChats();
    if (user?._id) {
       socketService.connect(user._id);
    }
    
    // Listen for incoming messages
    socketService.on('receive_message', (msg) => {
      // Only append if it belongs to the current active chat
      const partnerId = msg.sender_id?._id || msg.sender_id;
      if (activeChat && (partnerId === activeChat.partner?._id)) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      }
      fetchChats();
    });

    // Listen for sender echoes
    socketService.on('sent_message_echo', (msg) => {
      const receiverId = msg.receiver_id?._id || msg.receiver_id;
      if (activeChat && (receiverId === activeChat.partner?._id)) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      }
      fetchChats();
    });

    // Real-time Presence Synchronizer
    socketService.on('user_presence', (data) => {
       const { userId, isOnline, lastSeen } = data;
       
       // Update global chat list status
       setChats(prev => prev.map(c => {
          if (c.partner?._id === userId) {
             return { ...c, partner: { ...c.partner, is_online: isOnline, last_seen: lastSeen } };
          }
          return c;
       }));

       // Update active chat header if applicable
       setActiveChat(prev => {
          if (prev?.partner?._id === userId) {
             return { ...prev, partner: { ...prev.partner, is_online: isOnline, last_seen: lastSeen } };
          }
          return prev;
       });
    });

    return () => socketService.disconnect();
  }, [activeChat?._id, user?._id]);

  const fetchChats = async () => {
    try {
      const chatRes = await api.get('/chat');
      const activeChats = chatRes.data.success ? chatRes.data.data.activeChats : [];
      const followRes = await api.get('/users/followed-vendors');
      const follows = followRes.data.success ? followRes.data.data.follows : [];

      const contactsMap = new Map();
      activeChats.forEach(chat => {
        if (chat.partner?._id) {
          contactsMap.set(chat.partner._id, {
            ...chat,
            isFollow: false,
            name: chat.partner.store_name || chat.partner.name
          });
        }
      });

      follows.forEach(f => {
        const vendorUser = f.vendor_id?.user_id;
        if (vendorUser?._id && !contactsMap.has(vendorUser._id)) {
          contactsMap.set(vendorUser._id, {
            partner: {
              _id: vendorUser._id,
              name: f.vendor_id.store_name,
              avatar: vendorUser.avatar || vendorUser.branding?.logo,
              role: 'vendor',
              is_online: vendorUser.is_online,
              last_seen: vendorUser.last_seen
            },
            snippet: "Followed — Secure Connection Ready",
            date: f.createdAt,
            name: f.vendor_id.store_name
          });
        }
      });

      const merged = Array.from(contactsMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
      setChats(merged);
    } catch (err) {
      console.error("[Chat] Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (partnerId) => {
    try {
      const res = await api.get(`/chat/${partnerId}`);
      if (res.data.success) {
         setMessages(res.data.data.messages);
         scrollToBottom();
      }
    } catch (err) { console.error(err); }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;
    setSending(true);
    try {
      await api.post('/chat', { receiver_id: activeChat.partner?._id, text: newMessage });
      setNewMessage("");
    } catch (err) { console.error(err); } finally { setSending(false); }
  };

  const scrollToBottom = () => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
  };

  const formatPresence = (partner) => {
     if (partner?.is_online) return <span className="text-emerald-500 font-black uppercase">Online</span>;
     if (!partner?.last_seen) return "Offline";
     const lastSeen = new Date(partner.last_seen);
     return `Last seen ${lastSeen.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="h-screen bg-[var(--bg-secondary)] flex overflow-hidden font-sans selection:bg-[var(--accent)]/30">
      
      {/* Sidebar - WhatsApp Style */}
      <div className={`${activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] bg-[var(--bg-primary)] border-r border-[var(--nav-border)] flex-col shrink-0 z-40 transition-all`}>
        
        <div className="px-5 py-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <div className="size-7 rounded-sm bg-gradient-to-tr from-[var(--accent)] to-[var(--accent)]/50 flex items-center justify-center rotate-3 shadow-lg shadow-[var(--accent)]/20 shrink-0">
                  <ShieldCheck className="size-4.5 text-white" />
               </div>
               <h1 className="text-[14px] font-[Quicksand,sans-serif] font-bold text-[var(--text-primary)] uppercase tracking-[0.1em]">
                  Aura<span className="opacity-50">.</span>Comms
               </h1>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-40 hover:opacity-100 transition-all"><Search className="size-4" /></button>
              <button className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-40 hover:opacity-100 transition-all"><MoreVertical className="size-4" /></button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-secondary)]/30" />
            <input type="text" placeholder="Search data nodes..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-9 pl-10 pr-4 bg-[var(--bg-secondary)] rounded-xl text-[11px] font-bold text-[var(--text-primary)] outline-none border border-[var(--glass-border)] focus:border-[var(--accent)]/20 transition-all" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none">
          {chats.filter(c => (c.name || "").toLowerCase().includes(search.toLowerCase())).map(chat => {
              const p = chat.partner;
              return (
                <div key={p?._id} onClick={() => { setActiveChat(chat); fetchMessages(p?._id); }} className={`flex items-center gap-3 p-4 cursor-pointer border-b border-[var(--nav-border)]/20 ${activeChat?.partner?._id === p?._id ? 'bg-[var(--accent)]/[0.03] border-l-2 border-l-[var(--accent)]' : 'hover:bg-[var(--bg-secondary)]/40'}`}>
                  <div className="relative">
                     <div className="size-11 rounded-2xl overflow-hidden border border-[var(--nav-border)] bg-white/5 flex items-center justify-center p-1.5 shrink-0 shadow-xl shadow-black/5">
                        <img 
                          src={p?.avatar || p?.branding?.logo} className="size-full object-contain" alt="" 
                          onError={(e) => { e.target.src = 'https://api.dicebear.com/7.x/initials/svg?seed=' + (p?.name || 'A'); }}
                        />
                     </div>
                     {p?.is_online && <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-primary)] shadow-lg shadow-emerald-500/20" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 font-[Poppins,sans-serif]">
                      <h3 className="text-[12px] font-black text-[var(--text-primary)] truncate uppercase tracking-tight">{p?.name}</h3>
                      <span className="text-[8px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-widest">{new Date(chat.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[11px] font-medium text-[var(--text-secondary)] truncate opacity-50 tracking-tight font-[Poppins,sans-serif]">{chat.snippet}</p>
                  </div>
                </div>
              );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-[var(--bg-secondary)] relative ${!activeChat && 'hidden md:flex'}`}>
        {activeChat ? (
          <>
            <div className="h-14 bg-[var(--bg-primary)] border-b border-[var(--nav-border)] flex items-center justify-between px-4 sticky top-0 z-40 backdrop-blur-xl">
               <div className="flex items-center gap-3">
                  <button onClick={() => setActiveChat(null)} className="md:hidden p-2 rounded-full text-[var(--text-secondary)]"><ArrowLeft className="size-4" /></button>
                  <div className="size-9 rounded-xl overflow-hidden border border-[var(--nav-border)] bg-white/5 flex items-center justify-center p-1 shrink-0 shadow-2xl">
                     <img src={activeChat.partner?.avatar || activeChat.partner?.branding?.logo} className="size-full object-contain" alt="" onError={(e) => { e.target.src = 'https://api.dicebear.com/7.x/initials/svg?seed=' + activeChat.partner?.name; }} />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-[12px] font-black uppercase text-[var(--text-primary)] tracking-tighter leading-none mb-1 font-[Poppins,sans-serif]">{activeChat.partner?.name}</h2>
                    <div className="flex items-center gap-1.5 opacity-40 font-[Poppins,sans-serif]">
                       <span className="text-[7px] font-black uppercase tracking-[0.2em]">{activeChat.partner?.role || 'Guest Node'}</span>
                       <span className="text-[7px] opacity-20">/</span>
                       <span className="text-[7px] font-black uppercase tracking-[0.15em]">{formatPresence(activeChat.partner)}</span>
                    </div>
                  </div>
               </div>
               <div className="flex items-center gap-1">
                  <button className="p-2 rounded-lg text-[var(--text-secondary)] opacity-40 hover:opacity-100 transition-all"><Search className="size-4" /></button>
                  <button className="p-2 rounded-lg text-[var(--text-secondary)] opacity-40 hover:opacity-100 transition-all"><MoreVertical className="size-4" /></button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[url('/bg-grid.png')] bg-fixed flex flex-col scrollbar-thin scrollbar-thumb-[var(--accent)]/10">
               {messages.map((msg, idx) => {
                   const isSelf = msg.sender_id?._id === user?._id || msg.sender_id === user?._id;
                   return (
                     <motion.div key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-[85%] md:max-w-[70%] px-4 py-2 rounded-2xl text-[12px] font-black tracking-tight shadow-sm border ${isSelf ? 'bg-[var(--accent)] text-white border-white/10 rounded-tr-none translate-x-2' : 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--glass-border)] rounded-tl-none -translate-x-2'}`}>
                          <p className="leading-relaxed break-words">{msg.text}</p>
                          <div className={`flex items-center justify-end gap-1 mt-1 opacity-40`}><span className="text-[7px] font-black uppercase">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{isSelf && <CheckCheck className="size-2.5" />}</div>
                       </div>
                     </motion.div>
                   );
               })}
               <div ref={messagesEndRef} />
            </div>

            <div className="px-5 py-5 bg-[var(--bg-secondary)] border-t border-[var(--nav-border)]/5">
               <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-3">
                  <button type="button" className="p-2.5 rounded-full bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all shrink-0"><Plus className="size-4.5" /></button>
                  <div className="flex-1 relative">
                    <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Transmission text..." className="w-full h-10 pl-5 pr-12 rounded-full bg-[var(--bg-primary)] border border-[var(--nav-border)] text-[12px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/30 transition-all font-mono" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[var(--text-secondary)] opacity-30"><Smile className="size-5" /></button>
                  </div>
                  <button type="submit" disabled={!newMessage.trim() || sending} className="size-10 rounded-full bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30 flex items-center justify-center active:scale-[0.8] disabled:opacity-30 shrink-0"><Send className="size-4 transform -rotate-12" /></button>
               </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[var(--bg-primary)] relative">
             <div className="absolute inset-0 bg-[url('/bg-grid.png')] opacity-[0.02]" />
             <div className="size-20 rounded-[2rem] bg-gradient-to-tr from-[var(--accent)]/20 to-transparent border border-[var(--accent)]/10 flex items-center justify-center mb-8"><ShieldCheck className="size-8 text-[var(--accent)]" /></div>
             <h2 className="text-xl font-black uppercase tracking-tighter text-[var(--text-primary)] mb-2">Aura Global Protocol</h2>
             <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-30 max-w-xs uppercase tracking-widest leading-relaxed">Nodes active. Zero-Bloat standard verified.</p>
          </div>
        )}
      </div>
    </div>
  );
}
