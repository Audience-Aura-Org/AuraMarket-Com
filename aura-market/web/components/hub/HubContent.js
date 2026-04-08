"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MessageCircle, LayoutGrid, Search, 
  Loader2, Star, Heart, Bell, 
  List, Check, ChevronRight, Home, Folder, Users
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
  
  // Category filters
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [breadcrumb, setBreadcrumb] = useState([]);
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

  // Fetch categories
  useEffect(() => {
    setIsCategoriesLoading(true);
    api.get('/categories/with-products')
      .then(res => { if (res.data.success) setCategories(res.data.data); })
      .catch(err => console.error(err))
      .finally(() => setIsCategoriesLoading(false));
  }, []);

  // Fetch inbox + followed vendors
  useEffect(() => {
    const fetchInbox = async () => {
      try {
        // Fetch active chats
        const chatRes = await api.get('/chat');
        const activeChats = chatRes.data.activeChats || [];
        
        // Fetch followed vendors
        let followedVendors = [];
        try {
          const followRes = await api.get('/follows');
          followedVendors = followRes.data?.data?.follows || [];
        } catch (e) {
          // Endpoint might not exist
          console.log('Follows endpoint not available');
        }
        
        // Combine and deduplicate
        const allChats = [...activeChats];
        
        // Add followed vendors that aren't already in chats
        followedVendors.forEach(vendor => {
          const vendorId = vendor.vendor_id?._id || vendor.vendor_id;
          if (!allChats.some(c => (c.partner?._id || c.partner)?.toString() === vendorId?.toString())) {
            allChats.push({
              partner: vendor.vendor_id,
              snippet: 'Tap to start a conversation',
              date: null,
              read_status: true,
              isFollowed: true
            });
          }
        });
        
        setInbox(allChats);
        try { sessionStorage.setItem('aura_hub_inbox', JSON.stringify(allChats)); } catch (_) {}
      } catch (err) {
        console.error('Inbox fetch failed:', err);
        setInbox([]);
      } finally {
        setLoadingInbox(false);
      }
    };
    fetchInbox();
  }, []);

  // Fetch feed
  const fetchFeed = async (p = 1) => {
    try {
      setLoadingFeed(true);
      const params = { page: p, limit: 24 };
      if (activeCategory && activeCategory !== 'All') params.category = activeCategory;
      if (sortBy) params.sort = sortBy;
      if (searchTerm) params.search = searchTerm;
      
      const res = await api.get('/products/hub', { params });
      if (res.data.success) {
        const nextFeed = res.data.data.products || [];
        if (p === 1) setFeed(nextFeed);
        else setFeed(prev => [...prev, ...nextFeed]);
        setTotalPages(res.data.data.pagination?.pages || 1);
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
  }, [activeCategory, sortBy, searchTerm]);

  useEffect(() => {
    if (activeTab === 'feed' && page > 1) {
      fetchFeed(page);
    }
  }, [page]);

  const handleCategoryClick = (cat) => {
    if (cat.children && cat.children.length > 0) {
      setBreadcrumb(prev => [...prev, cat]);
      setActiveCategory(cat.name);
    } else {
      setActiveCategory(cat.name);
    }
  };

  const handleBreadcrumbClick = (idx) => {
    if (idx === -1) {
      setBreadcrumb([]);
      setActiveCategory('All');
    } else {
      const newBreadcrumb = breadcrumb.slice(0, idx + 1);
      setBreadcrumb(newBreadcrumb);
      setActiveCategory(newBreadcrumb[newBreadcrumb.length - 1].name);
    }
  };

  const currentLevel = breadcrumb.length === 0 ? categories : breadcrumb[breadcrumb.length - 1].children || [];

  const filteredInbox = useMemo(() => {
    return inbox.filter(c => c.partner?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           c.partner?.store_name?.toLowerCase().includes(searchTerm.toLowerCase()));
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
                      {/* Search */}
                      <div className="relative mb-2">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          placeholder="Search products..."
                          className="w-full bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-full py-2 pl-4 pr-12 text-xs focus:ring-1 focus:ring-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-medium"
                        />
                        <button className="absolute right-1 top-1 h-[calc(100%-8px)] px-4 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full shadow-md hover:opacity-90 transition-all flex items-center justify-center font-bold">
                          <Search className="size-3" />
                        </button>
                      </div>
                      
                      {/* Category Chips */}
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                        {isCategoriesLoading ? (
                          [...Array(6)].map((_, i) => (
                            <div key={i} className="shrink-0 w-20 h-8 rounded-full bg-[var(--bg-primary)] animate-pulse border border-[var(--glass-border)]/30"></div>
                          ))
                        ) : (
                          <>
                            <button 
                              onClick={() => { setActiveCategory('All'); setBreadcrumb([]); }}
                              className={`shrink-0 px-4 py-1.5 rounded-full border transition-all text-[10px] font-medium shadow-sm ${activeCategory === 'All' ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' : 'border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]'}`}
                            >
                              All
                            </button>
                            {currentLevel.map(cat => (
                              <button
                                key={cat._id}
                                onClick={() => handleCategoryClick(cat)}
                                className={`shrink-0 px-4 py-1.5 rounded-full border transition-all text-[10px] font-medium shadow-sm ${activeCategory === cat.name ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]' : 'border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]'}`}
                              >
                                {cat.name}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                      
                      {/* Sort & View Toggle */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="relative">
                          <button 
                            onClick={() => setIsSortOpen(!isSortOpen)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)] transition-all text-[10px] font-medium text-[var(--text-primary)] shadow-sm"
                          >
                            <span className="text-[var(--text-secondary)] font-normal">Sort:</span> 
                            {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
                            <ChevronRight className={`size-3 text-[var(--text-secondary)] transition-transform ${isSortOpen ? 'rotate-90' : 'rotate-90'}`} />
                          </button>
                          
                          {isSortOpen && (
                            <div className="absolute left-0 top-full mt-2 w-44 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[14px] shadow-2xl overflow-hidden py-1.5 z-50">
                               {SORT_OPTIONS.map(opt => (
                                 <button key={opt.value} onClick={() => {setSortBy(opt.value); setIsSortOpen(false);}} className={`w-full text-left px-4 py-2.5 text-[11px] font-medium transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${sortBy === opt.value ? 'text-[var(--text-primary)] bg-[var(--bg-secondary)]/50' : 'text-[var(--text-secondary)]'}`}>
                                   {opt.label}
                                   {sortBy === opt.value && <Check className="size-3" />}
                                 </button>
                               ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 bg-[var(--bg-primary)] rounded-lg p-0.5 border border-[var(--glass-border)]">
                          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all flex items-center justify-center ${viewMode === 'grid' ? 'bg-[var(--accent)] text-white shadow-sm border border-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                            <LayoutGrid className="size-3.5" />
                          </button>
                          <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-[var(--accent)] text-white shadow-sm border border-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'}`}>
                            <List className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Calibrated Discovery</p>
                      {loadingFeed ? (
                         <div className="grid grid-cols-2 gap-3">
                           {[1,2,3,4,5,6].map(i => (
                             <div key={i} className="aspect-[4/5] rounded-3xl bg-[var(--accent)]/5 animate-pulse border border-[var(--glass-border)]" />
                           ))}
                         </div>
                      ) : (
                        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3 mb-6" : "flex flex-col gap-4 mb-6"}>
                          {feed.map(product => <ProductCard key={product._id} product={product} layout={viewMode} />)}
                        </div>
                      )}
                      
                      {totalPages > 1 && page < totalPages && (
                        <button
                          onClick={() => setPage(p => p + 1)}
                          disabled={loadingFeed}
                          className="w-full py-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-all"
                        >
                          {loadingFeed ? 'Loading...' : 'Load More'}
                        </button>
                      )}
                   </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>

      {/* ── DESKTOP VIEW ────────────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-1 w-full relative z-10">
        
        {/* ── LEFT SIDEBAR: Inbox ─────────────────────────────────────────── */}
        <div className="w-80 border-r border-[var(--glass-border)] flex flex-col bg-[var(--bg-primary)]/50 backdrop-blur-sm">
          {/* Header */}
          <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--glass-border)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black tracking-tight text-[var(--text-primary)]">Hub</h2>
              <button className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-secondary)]">
                <Bell className="size-5" />
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search signals..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl py-2.5 pl-10 pr-4 text-xs focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all placeholder:text-[var(--text-secondary)]/50 font-medium"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]/50" />
            </div>
          </div>

          {/* Tab Selector */}
          <div className="px-4 py-3 border-b border-[var(--glass-border)]">
            <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl gap-1">
              <button 
                onClick={() => setActiveTab('chats')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'chats' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)]'}`}
              >
                <MessageCircle className="size-3.5" />
                Chats
              </button>
              <button 
                onClick={() => setActiveTab('feed')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === 'feed' ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)]'}`}
              >
                <LayoutGrid className="size-3.5" />
                Discover
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {activeTab === 'chats' ? (
              loadingInbox ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="size-6 animate-spin text-[var(--accent)]" />
                </div>
              ) : (
                <div className="p-3 space-y-1">
                  {filteredInbox.length === 0 ? (
                    <EmptyPlaceholder icon={Users} text="No messages yet. Follow vendors to chat!" />
                  ) : (
                    <>
                      {/* Messages Section */}
                      {filteredInbox.filter(c => !c.isFollowed).length > 0 && (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2 ml-2 mt-2">Messages</p>
                          {filteredInbox.filter(c => !c.isFollowed).map(chat => (
                            <ChatLink key={chat.partner?._id || chat.id} chat={chat} />
                          ))}
                        </>
                      )}
                      {/* Followed Section */}
                      {filteredInbox.filter(c => c.isFollowed).length > 0 && (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2 ml-2 mt-4">Followed Vendors</p>
                          {filteredInbox.filter(c => c.isFollowed).map(chat => (
                            <ChatLink key={chat.partner?._id || chat.id} chat={chat} />
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              )
            ) : (
              <div className="p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-3 ml-1">Categories</p>
                {isCategoriesLoading ? (
                  [...Array(8)].map((_, i) => (
                    <div key={i} className="h-10 rounded-xl bg-[var(--bg-secondary)] animate-pulse border border-[var(--glass-border)]/30"></div>
                  ))
                ) : (
                  <>
                    {/* Breadcrumb Navigation */}
                    {breadcrumb.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <button 
                          onClick={() => handleBreadcrumbClick(-1)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                        >
                          <Home className="size-3" /> Home
                        </button>
                        {breadcrumb.map((crumb, idx) => (
                          <div key={crumb._id} className="flex items-center gap-2">
                            <ChevronRight className="size-3 text-[var(--glass-border)]" />
                            <button 
                              onClick={() => handleBreadcrumbClick(idx)} 
                              className={`px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
                                idx === breadcrumb.length - 1 && !currentLevel.length
                                  ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20'
                                  : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {crumb.name}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Category List */}
                    {currentLevel.length > 0 ? (
                      currentLevel.map(cat => (
                        <button 
                          key={cat._id}
                          onClick={() => handleCategoryClick(cat)}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl transition-all text-xs font-medium ${activeCategory === cat.name ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                        >
                          <span className="flex items-center gap-3">
                            <Folder className="size-4" />
                            {cat.name}
                          </span>
                          {cat.children?.length > 0 && (
                            <ChevronRight className="size-3 text-[var(--glass-border)]" />
                          )}
                        </button>
                      ))
                    ) : activeCategory !== 'All' ? (
                      <div className="text-center py-6 text-[11px] text-[var(--text-secondary)]/60">
                        No subcategories
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => { setActiveCategory('All'); setBreadcrumb([]); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-xs font-medium ${activeCategory === 'All' ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                        >
                          <Home className="size-4" />
                          All Products
                        </button>
                        {categories.map(cat => (
                          <button 
                            key={cat._id}
                            onClick={() => handleCategoryClick(cat)}
                            className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl transition-all text-xs font-medium ${activeCategory === cat.name ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                          >
                            <span className="flex items-center gap-3">
                              <Folder className="size-4" />
                              {cat.name}
                            </span>
                            {cat.children?.length > 0 && (
                              <ChevronRight className="size-3 text-[var(--glass-border)]" />
                            )}
                          </button>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── MAIN CONTENT: Discovery Feed ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto no-scrollbar" ref={resultsAnchor}>
          {activeTab === 'feed' && (
            <>
              {/* Sticky Filter Bar */}
              <div className="sticky top-0 z-20 bg-[var(--bg-secondary)]/90 backdrop-blur-xl border-b border-[var(--glass-border)] px-6 py-3">
                <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
                  
                  {/* Results Count */}
                  <p className="text-[11px] font-medium text-[var(--text-secondary)] shrink-0">
                    <span className="text-[var(--text-primary)] font-semibold">{feed.length}</span> products
                    {activeCategory !== 'All' && <span> in <span className="text-[var(--text-primary)] font-semibold">{activeCategory}</span></span>}
                  </p>

                  {/* Sort Dropdown */}
                  <div className="relative">
                    <button 
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] hover:border-[var(--text-secondary)] transition-all text-[11px] font-medium shadow-sm"
                    >
                      <span className="text-[var(--text-secondary)] font-normal">Sort:</span> 
                      {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
                      <ChevronRight className={`size-3 text-[var(--text-secondary)] transition-transform ${isSortOpen ? '-rotate-90' : 'rotate-90'}`} />
                    </button>
                    
                    {isSortOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[14px] shadow-2xl overflow-hidden py-1.5 z-50">
                         {SORT_OPTIONS.map(opt => (
                           <button key={opt.value} onClick={() => {setSortBy(opt.value); setIsSortOpen(false);}} className={`w-full text-left px-4 py-2.5 text-[11px] font-medium transition-colors hover:bg-[var(--bg-secondary)] flex items-center justify-between ${sortBy === opt.value ? 'text-[var(--text-primary)] bg-[var(--bg-secondary)]/50' : 'text-[var(--text-secondary)]'}`}>
                             {opt.label}
                             {sortBy === opt.value && <Check className="size-3" />}
                           </button>
                         ))}
                      </div>
                    )}
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 bg-[var(--bg-primary)] rounded-xl p-1 border border-[var(--glass-border)]">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all flex items-center justify-center ${viewMode === 'grid' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                      <LayoutGrid className="size-4" />
                    </button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                      <List className="size-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Product Grid */}
              <div className="p-6">
                {loadingFeed ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                      <div key={i} className="aspect-[4/5] rounded-3xl bg-[var(--accent)]/5 animate-pulse border border-[var(--glass-border)]" />
                    ))}
                  </div>
                ) : feed.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="size-20 bg-[var(--accent)]/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Search className="size-8 text-[var(--text-secondary)]/50" />
                    </div>
                    <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">No Products Found</h3>
                    <p className="text-sm text-[var(--text-secondary)]">Try adjusting your filters.</p>
                  </div>
                ) : (
                  <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8" : "flex flex-col gap-4 mb-8 max-w-5xl"}>
                    {feed.map(product => (
                      <ProductCard key={product._id} product={product} layout={viewMode} />
                    ))}
                  </div>
                )}

                {/* Load More */}
                {totalPages > 1 && page < totalPages && (
                  <div className="flex justify-center mt-8 pb-12">
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={loadingFeed}
                      className="px-10 py-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[11px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)] transition-all shadow-sm disabled:opacity-50"
                    >
                      {loadingFeed ? (
                        <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading...</span>
                      ) : 'Load More'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'chats' && (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
              <div className="text-center">
                <MessageCircle className="size-16 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium opacity-60">Select a chat to start messaging</p>
              </div>
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
      className={`w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--bg-secondary)] transition-all group text-left ${chat.isFollowed ? 'border border-dashed border-[var(--glass-border)]' : ''}`}
    >
      <div className="relative shrink-0">
        <div className="size-11 rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
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
