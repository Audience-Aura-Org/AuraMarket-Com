"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MessageCircle, LayoutGrid, Search, 
  Loader2, Heart, Bell, 
  List, Check, ChevronRight, Home, Folder, Users, ArrowLeft
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('-createdAt');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const [activePrice, setActivePrice] = useState(null);
  
  // Category filters - exactly like Shop page
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeCategoryName, setActiveCategoryName] = useState('All');
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const resultsAnchor = useRef(null);

  // Real-time incoming message updates
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

  // Fetch categories — only when feed tab is active (lazy)
  useEffect(() => {
    if (activeTab !== 'feed') return;
    if (categories.length > 0) return; // already loaded
    setIsCategoriesLoading(true);
    api.get('/categories/with-products')
      .then(res => { if (res.data.success) setCategories(res.data.data); })
      .catch(err => console.error(err))
      .finally(() => setIsCategoriesLoading(false));
  }, [activeTab]);

  // Fetch inbox + followed vendors — immediate, single priority
  useEffect(() => {
    const fetchInbox = async () => {
      try {
        const [chatRes, followRes] = await Promise.all([
          api.get('/chat').catch(() => ({ data: {} })),
          api.get('/users/followed-vendors').catch(() => ({ data: {} }))
        ]);
        
        let activeChats = [];
        if (chatRes.data?.success) {
          activeChats = chatRes.data.data?.activeChats || chatRes.data.data || [];
        }
        
        let followedVendors = [];
        if (followRes.data?.success && followRes.data?.data) {
          followedVendors = Array.isArray(followRes.data.data) 
            ? followRes.data.data 
            : followRes.data.data.follows || followRes.data.data.vendors || [];
        }
        followedVendors = Array.isArray(followedVendors) ? followedVendors : [];
        
        const allChats = [...activeChats];
        followedVendors.forEach(vendor => {
          const vendorData = vendor?.vendor_id || vendor;
          const vendorId = vendorData?._id || vendorData;
          if (vendorId && !allChats.some(c => (c.partner?._id || c.partner)?.toString() === vendorId.toString())) {
            allChats.push({ partner: vendorData, snippet: 'Tap to start a conversation', date: null, read_status: true, isFollowed: true });
          }
        });
        
        setInbox(allChats);
      } catch (err) {
        console.error('Inbox fetch failed:', err.message);
        setInbox([]);
      } finally {
        setLoadingInbox(false);
      }
    };
    fetchInbox();
  }, []);

  // Fetch feed — only triggered when feed tab is active
  const fetchFeed = async (p = 1) => {
    try {
      setLoadingFeed(true);
      const categoryParam = activeCategoryName !== 'All' ? `&category=${encodeURIComponent(activeCategoryName)}` : '';
      const sortParam = `&sort=${sortBy}`;
      const res = await api.get(`/products/hub?page=${p}&limit=20${categoryParam}${sortParam}`);
      
      if (res.data.success) {
        const followed = res.data.data.followedProducts || [];
        const recommended = res.data.data.products || [];
        const allFeed = [...followed, ...recommended];
        const uniqueFeed = allFeed.filter((item, index, self) => index === self.findIndex((t) => t._id === item._id));
        
        if (p === 1) {
          setFeed(uniqueFeed);
        } else {
          setFeed(prev => {
            const combined = [...prev, ...uniqueFeed];
            return combined.filter((item, index, self) => index === self.findIndex((t) => t._id === item._id));
          });
        }
        
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.pages);
        } else {
          setTotalPages(uniqueFeed.length < 20 ? p : p + 1);
        }
      }
    } catch (err) {
      console.error('Feed failure:', err);
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'feed') {
      setPage(1);
      fetchFeed(1);
    }
  }, [activeCategoryId, activeTab, sortBy]);

  useEffect(() => {
    if (activeTab === 'feed' && page > 1) {
      fetchFeed(page);
    }
  }, [page]);

  // Current level of categories shown in navigation
  const currentLevel = breadcrumb.length === 0
    ? categories
    : breadcrumb[breadcrumb.length - 1].children || [];

  const handleCategoryClick = (cat) => {
    setBreadcrumb(prev => [...prev, cat]);
    setActiveCategoryId(cat._id);
    setActiveCategoryName(cat.name);
  };

  const handleBreadcrumbClick = (idx) => {
    if (idx === -1) {
      setBreadcrumb([]);
      setActiveCategoryId(null);
      setActiveCategoryName('All');
    } else {
      const newBreadcrumb = breadcrumb.slice(0, idx + 1);
      setBreadcrumb(newBreadcrumb);
      const last = newBreadcrumb[newBreadcrumb.length - 1];
      setActiveCategoryId(last._id);
      setActiveCategoryName(last.name);
    }
  };

  const filteredInbox = useMemo(() => {
    return inbox.filter(c => 
      c.partner?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.partner?.store_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inbox, searchTerm]);

  const SORT_OPTIONS = [
    { value: '-createdAt', label: 'Newest Arrivals' },
    { value: 'price', label: 'Price: Low to High' },
    { value: '-price', label: 'Price: High to Low' },
    { value: '-rating', label: 'Highest Rated' }
  ];

  return (
    <div className="flex flex-1 min-h-[calc(100vh-57px)] bg-[var(--bg-secondary)] relative border-t border-[var(--glass-border)] pb-20 md:pb-0">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] size-96 bg-[var(--accent)] blur-[100px] rounded-full" />
         <div className="absolute bottom-[-10%] right-[-10%] size-96 bg-[var(--accent-light)] blur-[100px] rounded-full" />
      </div>

      {/* ── MOBILE VIEW ────────────────────────────────────── */}
      <div className="md:hidden flex flex-col w-full relative z-10">
         {/* Sticky Tab Bar */}
         <div className="sticky top-[56px] z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)] px-4 py-2.5 shadow-sm">
            <div className="flex bg-[var(--bg-secondary)] p-1 gap-1 rounded-full border border-[var(--glass-border)]/50">
            <button 
               onClick={() => setActiveTab('chats')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'chats' ? 'bg-[var(--accent)] text-white shadow-xl shadow-[var(--accent)]/20' : 'text-[var(--text-secondary)] opacity-60'}`}
            >
               <MessageCircle className="size-4" />
               Chats
            </button>
            <button 
               onClick={() => setActiveTab('feed')}
               className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'feed' ? 'bg-[var(--accent)] text-white shadow-xl shadow-[var(--accent)]/20' : 'text-[var(--text-secondary)] opacity-60'}`}
            >
               <LayoutGrid className="size-4" />
               Discover
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
                     {/* Search */}
                     <div className="relative mt-4 mb-2">
                       <input
                         type="text"
                         value={searchTerm}
                         onChange={e => setSearchTerm(e.target.value)}
                         placeholder="Search chats..."
                         className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-full py-2 pl-4 pr-12 text-xs focus:ring-1 focus:ring-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-medium"
                       />
                       <button className="absolute right-1 top-1 h-[calc(100%-8px)] px-4 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full shadow-md hover:opacity-90 transition-all flex items-center justify-center font-bold">
                         <Search className="size-3" />
                       </button>
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2 ml-2">Messages & Followed</p>
                     {loadingInbox ? (
                        <div className="flex flex-col items-center py-20 opacity-20"><Loader2 className="animate-spin" /></div>
                     ) : filteredInbox.length === 0 ? (
                        <EmptyPlaceholder icon={MessageCircle} text="No messages yet. Follow vendors to chat!" />
                     ) : (
                        filteredInbox.map(chat => <ChatLink key={chat.partner?._id || chat.id} chat={chat} />)
                     )}
                  </motion.div>
               ) : (
                   <motion.div 
                     key="feed"
                     initial={{ opacity: 0, x: 10 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -10 }}
                     className="space-y-3 pt-4"
                   >
                      {/* Category Chips - Ported from Shop */}
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                        {breadcrumb.length > 0 ? (
                          <button onClick={() => handleBreadcrumbClick(-1)} className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                            <Home className="size-3" />
                          </button>
                        ) : (
                          <button onClick={() => { setActiveCategoryId(null); setActiveCategoryName('All'); }} className={`shrink-0 px-4 py-1.5 rounded-full border transition-all text-[10px] font-medium ${activeCategoryName === 'All' ? 'bg-[var(--accent)] text-white' : 'border-[var(--glass-border)] text-[var(--text-secondary)]'}`}>
                            All
                          </button>
                        )}
                        
                        {breadcrumb.map((crumb, idx) => (
                           <button key={crumb._id} onClick={() => handleBreadcrumbClick(idx)} className={`shrink-0 px-4 py-1.5 rounded-full border transition-all text-[10px] font-medium ${idx === breadcrumb.length - 1 && currentLevel.length === 0 ? 'bg-[var(--accent)] text-white' : 'border-[var(--glass-border)] text-[var(--text-secondary)]'}`}>
                             {crumb.name}
                           </button>
                        ))}

                        {currentLevel.map(cat => (
                          <button
                            key={cat._id}
                            onClick={() => handleCategoryClick(cat)}
                            className={`shrink-0 px-4 py-1.5 rounded-full border transition-all text-[10px] font-medium border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)]`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                      
                      {/* Sort & View Toggle */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="relative">
                          <button 
                            onClick={() => setIsSortOpen(!isSortOpen)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)] transition-all text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] shadow-sm"
                          >
                            <span className="text-[var(--text-secondary)] font-normal opacity-50 uppercase">Sort:</span> 
                            {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
                            <ChevronRight className={`size-3 text-[var(--accent)] transition-transform ${isSortOpen ? 'rotate-90' : 'rotate-90'}`} />
                          </button>
                          
                          {isSortOpen && (
                            <div className="absolute left-0 top-full mt-2 w-48 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[1.5rem] shadow-2xl overflow-hidden py-2 z-50">
                               {SORT_OPTIONS.map(opt => (
                                 <button key={opt.value} onClick={() => {setSortBy(opt.value); setIsSortOpen(false);}} className={`w-full text-left px-4 py-2.5 text-[11px] font-medium transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${sortBy === opt.value ? 'text-[var(--text-primary)] bg-[var(--bg-secondary)]/50' : 'text-[var(--text-secondary)]'}`}>
                                   {opt.label}
                                   {sortBy === opt.value && <Check className="size-3" />}
                                 </button>
                               ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 bg-[var(--bg-primary)] rounded-full p-0.5 border border-[var(--glass-border)]">
                          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-full transition-all flex items-center justify-center ${viewMode === 'grid' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                            <LayoutGrid className="size-3.5" />
                          </button>
                          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-full transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                            <List className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">
                        {activeCategoryName === 'All' ? 'Calibrated Discovery' : activeCategoryName}
                      </p>
                      {loadingFeed ? (
                         <div className="grid grid-cols-2 gap-3">
                           {[1,2,3,4,5,6].map(i => (
                             <div key={i} className="aspect-[4/5] rounded-3xl bg-[var(--accent)]/5 animate-pulse border border-[var(--glass-border)]" />
                           ))}
                         </div>
                      ) : (
                        <>
                          {feed.length === 0 ? (
                            <EmptyPlaceholder icon={Search} text="No products in this category" />
                          ) : (
                            <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3 mb-6" : "flex flex-col gap-4 mb-6"}>
                              {feed.map(product => <ProductCard key={product._id} product={product} layout={viewMode} />)}
                            </div>
                          )}
                          
                          {totalPages > 1 && page < totalPages && (
                            <button
                              onClick={() => setPage(p => p + 1)}
                              disabled={loadingFeed}
                              className="w-full py-4 rounded-full bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-all shadow-sm"
                            >
                              Synchronize More
                            </button>
                          )}
                        </>
                      )}
                   </motion.div>
                )}
             </AnimatePresence>
          </div>
       </div>

       {/* ── DESKTOP VIEW ────────────────────────────────────── */}
       <div className="hidden md:flex flex-col flex-1 w-full relative z-10">
        
        {/* STICKY HEADER STACK: Matches Shop experience */}
        <div className="sticky top-0 z-40 bg-[var(--bg-primary)] shadow-sm">
          {/* Search Bar */}
          <div className="px-6 lg:px-12 py-2 flex justify-center border-b border-[var(--glass-border)]/50">
            <div className="relative w-full max-w-6xl">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search hub..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-full py-2.5 pl-5 pr-14 text-xs focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-medium"
              />
              <button className="absolute right-1 top-1 h-[calc(100%-8px)] px-5 bg-[var(--accent)] text-white rounded-full shadow-lg hover:opacity-90 transition-all flex items-center justify-center font-bold">
                <Search className="size-4" />
              </button>
            </div>
          </div>

          {/* Tab Selector & Category Chips */}
          <div className="border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/95 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-6 lg:px-12 py-3 flex items-center gap-6">
               {/* Mode Switcher */}
               <div className="flex bg-[var(--bg-secondary)] p-1 rounded-full gap-1 shrink-0 border border-[var(--glass-border)] shadow-inner">
                  <button 
                    onClick={() => setActiveTab('chats')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'chats' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                    <MessageCircle className="size-3.5" />
                    Chats
                  </button>
                  <button 
                    onClick={() => setActiveTab('feed')}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'feed' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                    <LayoutGrid className="size-3.5" />
                    Discover
                  </button>
               </div>

               {/* Divider */}
               <div className="h-8 w-px bg-[var(--glass-border)] shrink-0" />

               {/* Category Chips - Ported from Shop */}
               <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
                 {isCategoriesLoading ? (
                   [...Array(6)].map((_, i) => (
                     <div key={i} className="shrink-0 w-24 h-9 rounded-full bg-[var(--bg-secondary)] animate-pulse border border-[var(--glass-border)]/30"></div>
                   ))
                 ) : (
                  <>
                   {breadcrumb.length > 0 ? (
                     <button onClick={() => handleBreadcrumbClick(-1)} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all">
                       <Home className="size-3.5" /> Hub
                     </button>
                   ) : (
                      <button 
                        onClick={() => { setActiveCategoryId(null); setActiveCategoryName('All'); }}
                        className={`shrink-0 px-5 py-2 rounded-full border transition-all text-[11px] font-medium shadow-sm ${activeCategoryName === 'All' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'}`}
                      >
                        All Signals
                      </button>
                   )}

                   {breadcrumb.length > 0 && breadcrumb.map((crumb, idx) => (
                     <div key={crumb._id} className="flex items-center gap-2 shrink-0">
                        <ChevronRight className="size-3 text-[var(--glass-border)]" />
                        <button 
                          onClick={() => handleBreadcrumbClick(idx)} 
                          className={`px-5 py-2 rounded-full border transition-all text-[11px] font-medium shadow-sm ${idx === breadcrumb.length - 1 && currentLevel.length === 0 ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--glass-border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-primary)]'}`}
                        >
                          {crumb.name}
                        </button>
                     </div>
                   ))}

                   {breadcrumb.length > 0 && currentLevel.length > 0 && <div className="h-4 w-px bg-[var(--glass-border)] mx-1 shrink-0" />}

                   {currentLevel.map(cat => (
                     <button
                        key={cat._id}
                        onClick={() => {
                          if (cat.children && cat.children.length > 0) handleCategoryClick(cat);
                          else { setActiveCategoryId(cat._id); setActiveCategoryName(cat.name); }
                        }}
                        className={`shrink-0 px-5 py-2 rounded-full border transition-all text-[11px] font-medium shadow-sm ${activeCategoryId === cat._id ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)]'}`}
                     >
                       {cat.name}
                     </button>
                   ))}
                  </>
                 )}
               </div>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-[var(--bg-secondary)] pb-20" ref={resultsAnchor}>
          
          {/* TAB: CHATS */}
          {activeTab === 'chats' && (
            <div className="max-w-6xl mx-auto p-6 lg:px-12">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Messages Section */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Operational Dialogues</p>
                        <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                     </div>
                     <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-2 min-h-[400px] shadow-sm backdrop-blur-xl">
                        {loadingInbox ? (
                          <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-[var(--accent)]" /></div>
                        ) : filteredInbox.filter(c => !c.isFollowed).length === 0 ? (
                          <EmptyPlaceholder icon={MessageCircle} text="No active frequency found." />
                        ) : (
                          <div className="space-y-1">
                             {filteredInbox.filter(c => !c.isFollowed).map(chat => <ChatLink key={chat.partner?._id || chat.id} chat={chat} />)}
                          </div>
                        )}
                     </div>
                  </div>

                  {/* Followed Section */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Followed Nodes</p>
                        <Heart className="size-3.5 text-[var(--accent)] fill-[var(--accent)]" />
                     </div>
                     <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-3 min-h-[400px] shadow-sm backdrop-blur-xl">
                        {loadingInbox ? (
                          <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-[var(--accent)]" /></div>
                        ) : filteredInbox.filter(c => c.isFollowed).length === 0 ? (
                          <EmptyPlaceholder icon={Users} text="Follow vendors to establish nodes." />
                        ) : (
                          <div className="space-y-1">
                             {filteredInbox.filter(c => c.isFollowed).map(chat => <ChatLink key={chat.partner?._id || chat.id} chat={chat} />)}
                          </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* TAB: DISCOVERY (FEED) */}
          {activeTab === 'feed' && (
            <div className="max-w-[1600px] mx-auto p-6 lg:p-12">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tight">
                    {activeCategoryName === 'All' ? 'Aura Discovery' : activeCategoryName}
                  </h3>
                  <div className="h-4 w-px bg-[var(--glass-border)]" />
                  <p className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                    {feed.length} Results
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Sort Dropdown */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      className="flex items-center gap-2 px-6 py-3 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)] transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
                    >
                      <span className="text-[var(--text-secondary)] font-normal opacity-60">Sort:</span> 
                      {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
                      <ChevronRight className={`size-3 text-[var(--text-secondary)] transition-transform ${isSortOpen ? '-rotate-90' : 'rotate-90'}`} />
                    </button>
                    {isSortOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl shadow-2xl overflow-hidden py-2 z-50 animate-in fade-in slide-in-from-top-2">
                         {SORT_OPTIONS.map(opt => (
                           <button key={opt.value} onClick={() => {setSortBy(opt.value); setIsSortOpen(false);}} className={`w-full text-left px-5 py-3 text-[11px] font-black uppercase tracking-widest transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${sortBy === opt.value ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                             {opt.label}
                             {sortBy === opt.value && <Check className="size-3.5" />}
                           </button>
                         ))}
                      </div>
                    )}
                  </div>

                  {/* View Mode */}
                  <div className="flex bg-[var(--bg-primary)] rounded-full p-1 border border-[var(--glass-border)] shadow-inner">
                    <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-full transition-all ${viewMode === 'grid' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)]'}`}>
                      <LayoutGrid className="size-4" />
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)]'}`}>
                      <List className="size-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Product Grid - 6 PER ROW REQUEST */}
              {loadingFeed ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-6">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="aspect-[3/4] rounded-[32px] bg-[var(--accent)]/5 animate-pulse border border-[var(--glass-border)]" />
                  ))}
                </div>
              ) : feed.length === 0 ? (
                <div className="py-20 text-center bg-[var(--bg-primary)]/40 rounded-[48px] border border-[var(--glass-border)] border-dashed">
                  <div className="size-20 bg-[var(--accent)]/5 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <Search className="size-8 text-[var(--accent)] opacity-20" />
                  </div>
                  <h3 className="text-2xl font-black text-[var(--text-primary)] mb-2 uppercase tracking-tighter">No Frequency Detected</h3>
                  <p className="text-sm font-medium text-[var(--text-secondary)] opacity-60">Adjust your category filters or try a different search signal.</p>
                </div>
              ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-6 mb-12" : "flex flex-col gap-5 mb-12 max-w-5xl mx-auto"}>
                  {feed.map(product => <ProductCard key={product._id} product={product} layout={viewMode} />)}
                </div>
              )}

              {/* Load More */}
              {totalPages > 1 && page < totalPages && (
                <div className="flex justify-center mt-12 pb-12">
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={loadingFeed}
                    className="px-12 py-5 rounded-full bg-[var(--bg-primary)] border-2 border-[var(--glass-border)] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-all shadow-xl shadow-[var(--accent)]/5 disabled:opacity-50 active:scale-95"
                  >
                    {loadingFeed ? <Loader2 className="size-5 animate-spin" /> : 'Synchronize More Results'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyPlaceholder({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
      <div className="size-14 rounded-2xl bg-[var(--accent)]/5 flex items-center justify-center mb-4">
        <Icon className="size-6 text-[var(--accent)]/40" />
      </div>
      <p className="text-xs font-medium text-[var(--text-secondary)]/60">{text}</p>
    </div>
  );
}

function ChatLink({ chat }) {
  const router = useRouter();
  const partner = chat.partner;
  const partnerId = partner?._id || partner;
  const partnerName = partner?.name || partner?.store_name || 'Unknown';
  const avatar = partner?.avatar || partner?.branding?.logo || partner?.user_id?.branding?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${partnerName}&backgroundColor=var(--accent)`;
  
  const handleClick = () => {
    if (partnerId) router.push(`/messages?vendorId=${partnerId}`);
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 p-3 rounded-[1.5rem] hover:bg-[var(--bg-secondary)] transition-all group text-left ${chat.isFollowed ? 'border border-dashed border-[var(--glass-border)]' : ''}`}
    >
      <div className="relative shrink-0">
        <div className="size-11 rounded-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
          <img src={avatar} className="size-full object-cover" alt={partnerName} />
        </div>
        {!chat.read_status && (
          <div className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)]" />
        )}
        {chat.isFollowed && (
          <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-[var(--accent)] border-2 border-[var(--bg-primary)] flex items-center justify-center">
            <Heart className="size-2.5 text-white fill-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={`text-xs truncate ${!chat.read_status ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-primary)]'}`}>
            {partnerName}
          </p>
          <span className="text-[10px] text-[var(--text-secondary)]/60 shrink-0">
            {chat.isFollowed ? 'Followed' : formatTime(chat.date)}
          </span>
        </div>
        <p className={`text-[11px] truncate ${chat.isFollowed ? 'text-[var(--accent)] font-medium' : (!chat.read_status ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]')}`}>
          {chat.snippet}
        </p>
      </div>
    </button>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
