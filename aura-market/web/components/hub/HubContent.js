"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  MessageCircle, LayoutGrid, Search, 
  Loader2, Store, MapPin, Star, 
  ArrowUpRight, ShoppingBag, Send,
  User, Bell, Command, MoreVertical,
  Heart, Users, ShoppingCart, Zap,
  Plus, ShieldCheck, MessageSquare, Clock,
  Truck, Package, CheckCircle, AlertCircle, Globe, Trash2
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import ProductCard from '@/components/ProductCard';
import socketService from '@/services/socket';

export default function HubContent() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('chats');
  const [inbox, setInbox] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, totalProducts: 0 });

  // Real-time incoming message updates — mirrors Comm Center behavior
  useEffect(() => {
    if (!user?._id) return;

    const handleMessage = (msg) => {
      try {
        const currentUserId = user._id.toString();
        const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();
        const receiverId = (msg.receiver_id?._id || msg.receiver_id)?.toString();
        const snippet = msg.text || (msg.product_reference?.name ? `📦 ${msg.product_reference.name}` : 'New message');
        const isUnread = receiverId === currentUserId;
        const partnerData = senderId === currentUserId ? msg.receiver_id : msg.sender_id;
        const partnerId = (partnerData?._id || (senderId === currentUserId ? receiverId : senderId))?.toString();
        if (!partnerId) return;

        setInbox(prev => {
          const existingIdx = prev.findIndex(c => (c.partner?._id || c.partner)?.toString() === partnerId);
          let basePartner = partnerData || { _id: partnerId };
          
          // If we have an existing partner object with names/store_names, prefer it
          if (existingIdx > -1) {
             const existing = prev[existingIdx];
             if (typeof existing.partner === 'object') {
                basePartner = { ...existing.partner, ...partnerData };
             }
          }

          const newEntry = {
            id: partnerId,
            partner: basePartner,
            snippet,
            date: new Date().toISOString(),
            read_status: !isUnread,
          };

          if (existingIdx > -1) {
            const updated = [...prev];
            updated[existingIdx] = { ...updated[existingIdx], ...newEntry };
            const item = updated.splice(existingIdx, 1)[0];
            return [item, ...updated];
          }
          return [newEntry, ...prev];
        });
      } catch (err) {
        console.error('[Hub] Socket message handler error:', err);
      }
    };

    socketService.on('receive_message', handleMessage);
    socketService.on('sent_message_echo', handleMessage);
    return () => {
      socketService.off('receive_message', handleMessage);
      socketService.off('sent_message_echo', handleMessage);
    };
  }, [user?._id]);

  useEffect(() => {
    try {
      const cachedInbox = sessionStorage.getItem('aura_hub_inbox');
      const cachedFeed = sessionStorage.getItem('aura_hub_feed');
      if (cachedInbox) {
        setInbox(JSON.parse(cachedInbox));
        setLoadingInbox(false);
      }
      if (cachedFeed) {
        setFeed(JSON.parse(cachedFeed));
        setLoadingFeed(false);
      }
    } catch (_) {}

    const fetchInbox = async () => {
      try {
        const [inboxRes, followRes] = await Promise.all([
           api.get('/chat'),
           api.get('/vendors/following').catch(() => ({ data: { success: true, data: { following: [] } } }))
        ]);

        if (inboxRes.data.success && followRes.data.success) {
           const activeChats = inboxRes.data.data.activeChats || [];
           const following = followRes.data.data.following || [];
           const combined = new Map();

           // 1. Initial follow synchronization (Potential Chats)
           following.forEach(f => {
              const partner = f.vendor_id?.user_id;
              if (!partner) return;
              combined.set(partner._id.toString(), {
                id: partner._id,
                partner: { ...partner, store_name: f.vendor_id?.store_name },
                date: f.createdAt,
                snippet: 'Node established. Ready for transmission.',
                read_status: true,
                isFollow: true
              });
           });

           // 2. Active conversation overlay (Higher priority/Snippets)
           activeChats.forEach(c => {
              const pid = (c.partner?._id || c.partner)?.toString();
              if (!pid) return;
              combined.set(pid, {
                id: pid,
                partner: c.partner,
                date: c.date,
                snippet: c.snippet,
                read_status: c.read_status,
                isFollow: combined.has(pid)
              });
           });

           const mappedNodes = Array.from(combined.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
           setInbox(mappedNodes);
           try { sessionStorage.setItem('aura_hub_inbox', JSON.stringify(mappedNodes)); } catch (_) {}
        }
      } catch (err) {
         console.error('Inbox failure:', err);
      } finally {
        setLoadingInbox(false);
      }
    };

    fetchInbox();
  }, []);

  useEffect(() => {
    fetchFeed(page);
  }, [page]);

  const fetchFeed = async (p = 1) => {
    try {
      setLoadingFeed(true);
      const res = await api.get(`/products/hub?page=${p}&limit=20`);
      if (res.data.success) {
        const nextFeed = res.data.data.products || [];
        setFeed(nextFeed);
        setPagination(res.data.data.pagination || { totalPages: 1, totalProducts: 0 });
        if (p === 1) {
          try { sessionStorage.setItem('aura_hub_feed', JSON.stringify(nextFeed)); } catch (_) {}
        }
      }
    } catch (err) {
      console.error('Feed failure:', err);
    } finally {
      setLoadingFeed(false);
    }
  };

  const filteredInbox = useMemo(() => {
    return inbox.filter(c => c.partner.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [inbox, searchTerm]);

  return (
    <div className="flex flex-1 min-h-screen bg-[var(--bg-secondary)] relative border-t border-[var(--glass-border)]">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] size-96 bg-[var(--accent)] blur-[100px] rounded-full" />
         <div className="absolute bottom-[-10%] right-[-10%] size-96 bg-[var(--accent-light)] blur-[100px] rounded-full" />
      </div>

      {/* ── MOBILE VIEW: TABBED INTERFACE ────────────────────────────────────── */}
      <div className="md:hidden flex flex-col w-full relative z-10">
         {/* Sticky Tab Bar */}
         <div className="sticky top-[56px] z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)] px-4 py-2.5 shadow-sm">
            <div className="flex bg-[var(--bg-secondary)] p-1 gap-1 rounded-2xl">
            <button 
               onClick={() => setActiveTab('chats')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'chats' ? 'bg-[var(--accent)] text-white shadow-xl shadow-[var(--accent)]/20' : 'text-[var(--text-secondary)] opacity-60'}`}
            >
               <MessageCircle className="size-4" />
               Chats
            </button>
            <button 
               onClick={() => setActiveTab('feed')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'feed' ? 'bg-[var(--accent)] text-white shadow-xl shadow-[var(--accent)]/20' : 'text-[var(--text-secondary)] opacity-60'}`}
            >
               <LayoutGrid className="size-4" />
               Feed
            </button>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto px-4 pb-40 no-scrollbar min-h-screen">
            <AnimatePresence mode="wait">
               {activeTab === 'chats' ? (
                  <motion.div 
                    key="chats"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-3"
                  >
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2 ml-2 mt-4">Followed Nodes</p>
                     {loadingInbox ? (
                        <div className="flex flex-col items-center py-20 opacity-20"><Loader2 className="animate-spin" /></div>
                     ) : filteredInbox.length === 0 ? (
                        <EmptyPlaceholder icon={MessageCircle} text="No active signals detected." />
                     ) : (
                        filteredInbox.map(chat => <ChatLink key={chat.partner._id} chat={chat} />)
                     )}
                  </motion.div>
               ) : (
                   <motion.div 
                     key="feed"
                     initial={{ opacity: 0, x: 10 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -10 }}
                     className="grid grid-cols-2 gap-3 pt-4"
                   >
                      <p className="col-span-2 text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1 ml-2">Calibrated Discovery</p>
                      {loadingFeed ? (
                         <div className="col-span-2 flex flex-col items-center py-20 opacity-20"><Loader2 className="animate-spin" /></div>
                      ) : (
                         feed.map(product => <ProductCard key={product._id} product={product} />)
                      )}
                   </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>

      {/* ── DESKTOP VIEW: 3-COLUMN LAYOUT ───────────────────────────────────── */}
      <div className="hidden md:flex w-full h-[calc(100vh-72px)] relative z-10 container mx-auto gap-8 px-6 py-8">
         {/* Sidebar: Chat List */}
         <div className="w-[350px] flex flex-col gap-6">
            <div className="flex flex-col gap-2">
               <h2 className="text-3xl font-black uppercase tracking-tighter">THE HUB</h2>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent)] opacity-80">Operational Pulse</p>
            </div>

            <div className="relative group">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40 group-focus-within:text-[var(--accent)] transition-all" />
               <input 
                  type="text" 
                  placeholder="Scan nodes..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl py-4 pl-14 pr-6 text-xs font-bold focus:ring-4 focus:ring-[var(--accent)]/10 transition-all outline-none"
               />
            </div>

            <div className="flex-1 bg-[var(--bg-primary)]/40 rounded-[32px] border border-[var(--glass-border)] flex flex-col overflow-hidden backdrop-blur-xl">
               <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Synchronized Conversations</span>
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
                  {loadingInbox ? (
                     <div className="py-20 flex justify-center opacity-20"><Loader2 className="animate-spin" /></div>
                  ) : filteredInbox.length === 0 ? (
                     <p className="text-[10px] text-center opacity-40 py-10 font-bold uppercase tracking-widest leading-loose">No active connections.<br/>Visit store to sync.</p>
                  ) : (
                     filteredInbox.map(chat => <ChatLink key={chat.partner._id} chat={chat} />)
                  )}
               </div>
            </div>
         </div>

         {/* Center: Product Feed (Expanded) */}
         <div className="flex-1 flex flex-col gap-6 max-h-full">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="size-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20 shadow-lg">
                     <LayoutGrid className="size-5" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Discovery Feed</h3>
               </div>
               <div className="flex gap-2">
                  <button className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-all">Latest</button>
                  <button className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-all">Trending</button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-4 space-y-4 no-scrollbar">
                {loadingFeed ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                     {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-[var(--bg-primary)]/40 animate-pulse rounded-[32px] border border-[var(--glass-border)]" />)}
                  </div>
               ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                       {feed.map(product => <ProductCard key={product._id} product={product} />)}
                    </div>

                    {/* Desktop Pagination */}
                    {pagination.totalPages > 1 && (
                      <div className="flex items-center justify-center gap-4 py-8 border-t border-[var(--glass-border)] mt-8">
                        <button 
                          disabled={page === 1}
                          onClick={() => { setPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white disabled:opacity-30 transition-all"
                        >First</button>
                        <button 
                          disabled={page === 1}
                          onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white disabled:opacity-30 transition-all"
                        >Prev</button>
                        
                        <div className="flex items-center gap-2">
                          {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                            let pageNum;
                            if (pagination.totalPages <= 5) pageNum = i + 1;
                            else if (page <= 3) pageNum = i + 1;
                            else if (page >= pagination.totalPages - 2) pageNum = pagination.totalPages - 4 + i;
                            else pageNum = page - 2 + i;

                            return (
                              <button
                                key={pageNum}
                                onClick={() => setPage(pageNum)}
                                className={`size-8 rounded-lg text-[10px] font-black transition-all ${page === pageNum ? 'bg-[var(--accent)] text-white shadow-lg' : 'bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] opacity-60 hover:opacity-100'}`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>

                        <button 
                          disabled={page === pagination.totalPages}
                          onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white disabled:opacity-30 transition-all"
                        >Next</button>
                        <button 
                          disabled={page === pagination.totalPages}
                          onClick={() => { setPage(pagination.totalPages); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white disabled:opacity-30 transition-all"
                        >Last</button>
                      </div>
                    )}
                  </>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

function ChatLink({ chat }) {
   return (
      <Link 
         href={`/chat?vendorId=${chat.partner._id}`}
         className="w-full p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center gap-4 hover:border-[var(--accent)]/40 transition-all group relative overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5"
      >
         <div className="size-12 rounded-xl overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] relative shrink-0 flex items-center justify-center">
            {chat.partner.branding?.logo || chat.partner.avatar ? (
              <img src={chat.partner.branding?.logo || chat.partner.avatar} className="size-full object-cover" alt="" />
            ) : (
              <span className="text-[var(--text-primary)] font-black text-xs">{(chat.partner.store_name || chat.partner.name)?.[0]?.toUpperCase()}</span>
            )}
            <div className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-[var(--bg-primary)]" />
         </div>
         <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-0.5">
               <div className="flex items-center gap-1.5 group/vendor">
                  <div className="size-4 rounded-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shrink-0 flex items-center justify-center">
                     {chat.partner.branding?.logo || chat.partner.avatar ? (
                        <img src={chat.partner.branding?.logo || chat.partner.avatar} className="size-full object-cover" alt="" />
                     ) : (
                        <span className="text-[var(--text-primary)] font-black text-[6px]">{(chat.partner.store_name || chat.partner.name)?.[0]?.toUpperCase()}</span>
                     )}
                  </div>
                  <span className="text-[9px] font-bold text-[var(--text-secondary)] group-hover/vendor:text-[var(--accent)] transition-colors truncate max-w-[120px]">
                     {chat.partner.store_name || chat.partner.name}
                  </span>
               </div>
               <span className="text-[8px] font-black opacity-40 uppercase">{new Date(chat.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
            </div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 truncate mt-1 uppercase tracking-widest">
               {chat.snippet || 'Ready to communicate.'}
            </p>
         </div>
         {/* Unread Badge (Simulated or from API) */}
         {!chat.read_status && (
            <div className="size-2 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
         )}
      </Link>
   );
}

function LogItem({ icon: Icon, title, time }) {
   return (
      <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--bg-secondary)] transition-all cursor-pointer group">
         <div className="size-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
            <Icon className="size-4" />
         </div>
         <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold text-[var(--text-primary)] truncate">{title}</p>
            <p className="text-[8px] font-black uppercase opacity-30 mt-0.5">{time}</p>
         </div>
      </div>
   );
}

function EmptyPlaceholder({ icon: Icon, text }) {
   return (
      <div className="flex flex-col items-center justify-center p-12 text-center opacity-30">
         <div className="size-20 rounded-full border-2 border-dashed border-current mb-4 flex items-center justify-center">
            <Icon className="size-8" />
         </div>
         <p className="text-[10px] font-black uppercase tracking-[0.2em]">{text}</p>
      </div>
   );
}
