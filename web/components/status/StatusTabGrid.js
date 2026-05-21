"use client";
import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { 
  Heart, Flame, Play, Search, X, Eye, 
  Clock, ShoppingBag, 
  Plus, Users, Globe, Sparkles, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import BlurUpImage from '@/components/common/BlurUpImage';
import MediaThumbnail from '@/components/common/MediaThumbnail';
import { useAuthStore } from '@/hooks/useAuth';

const warmStoryMedia = (story, eager = false) => {
  if (!story?.content_url) return;
  if (story.type === 'image') {
    const img = new Image();
    img.fetchPriority = eager ? 'high' : 'auto';
    img.src = story.content_url;
    return;
  }
  if (story.type === 'video') {
    const video = document.createElement('video');
    video.preload = eager ? 'auto' : 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = story.content_url;
    video.load();
  }
};

// â”€â”€â”€ Utils â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ago = d => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
};
const hoursLeft = exp => Math.max(0, (new Date(exp) - Date.now()) / 3600000);

// â”€â”€â”€ Story Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PremiumCard = memo(function PremiumCard({ status, rank, isNew, priority = 'auto', onClick, className = '' }) {
  const v       = status.vendor_id;
  const logo    = v?.user_id?.branding?.logo || v?.user_id?.avatar;
  const name    = v?.store_name || 'Store';
  const isText  = status.type === 'text';
  const expH    = hoursLeft(status.expires_at);
  const urgent  = expH > 0 && expH < 12;
  const isVideo = status.type === 'video';

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[1.5rem] shadow-xl cursor-pointer transition-all duration-300 ${
        isNew 
          ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-secondary)]' 
          : 'opacity-75 hover:opacity-100'
      } ${className}`}
    >
      {/* Media */}
      <div className="absolute inset-0">
        {!isText ? (
          <>
            <MediaThumbnail src={status.content_url} alt={name} priority={priority}
              className="w-full h-full"
              objectFit="cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="size-full flex items-center justify-center p-4 text-center overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #090909 0%, #1a1a1a 100%)' }}>
            <div className="absolute -top-10 -left-10 size-24 bg-[var(--accent)] blur-[50px] opacity-20 rounded-full animate-pulse" />
            <p className="relative z-10 text-[11px] lg:text-[12px]  font-semibold text-white/90 leading-relaxed line-clamp-5">
              {status.text_content}
            </p>
          </div>
        )}
      </div>

      {/* Video play icon */}
      {isVideo && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 size-8 rounded-full bg-black/40 backdrop-blur border border-white/20 flex items-center justify-center pointer-events-none">
          <Play className="size-3.5 text-white ml-0.5" />
        </div>
      )}

      {/* Info overlay â€” always visible (not hover-only) */}
      <div className="absolute inset-x-0 bottom-0 p-2.5 z-20">
        <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-xl p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="size-5 rounded-full border border-white/20 overflow-hidden bg-black/40 shrink-0">
              {logo ? (
                <BlurUpImage src={logo} alt={name} priority="low" className="size-full" objectFit="cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-[10px] lg:text-[12px]  font-semibold text-white bg-gradient-to-br from-[var(--accent)] to-purple-600">
                  {name[0]}
                </div>
              )}
            </div>
            <p className="text-[11px] lg:text-[12px]  font-semibold text-white truncate flex-1">{name}</p>
            {isNew && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-[10px] lg:text-[12px]  font-semibold shrink-0">
                <Sparkles className="size-2" /> New
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[11px] lg:text-[12px]  font-semibold text-white/60">
                <Heart className="size-2 text-red-400 fill-red-400/20" />
                <span>{status.likes_count || 0}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] lg:text-[12px]  font-semibold text-white/60">
                <Eye className="size-2 text-blue-400" />
                <span>{status.views_count || 0}</span>
              </div>
            </div>
            <span className="text-[10px] lg:text-[12px]  font-semibold text-white/30">{ago(status.createdAt)}</span>
          </div>

          {status.linked_product && (
            <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/20 text-[10px] lg:text-[12px]  font-semibold text-[var(--accent)]">
              <ShoppingBag className="size-2.5 shrink-0" />
              <span className="truncate">{status.linked_product.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Badges */}
      {rank && (
        <div className="absolute top-2.5 left-2.5 z-30">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur border border-white/10">
            <Flame className={`size-2.5 ${rank === 1 ? 'text-orange-400' : 'text-white/50'}`} />
            <span className="text-[11px] lg:text-[12px]  font-semibold text-white">#{rank}</span>
          </div>
        </div>
      )}
      {urgent && (
        <div className="absolute top-2.5 right-2.5 z-30">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/80 text-[11px] lg:text-[12px]  font-semibold text-white animate-pulse">
            <Clock className="size-2.5" /> {Math.floor(expH)}h
          </div>
        </div>
      )}
    </motion.button>
  );
});

const CATEGORIES = ['All', 'Fashion', 'Electronics', 'Lifestyle', 'Tech', 'Art', 'Beauty', 'General'];

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function StatusTabGrid({ onSelectStatus }) {
  const { user }                   = useAuthStore();
  const [followedStatuses, setFollowedStatuses] = useState([]);
  const [globalStatuses,   setGlobalStatuses]   = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [search,           setSearch]           = useState('');
  const [showSearch,       setShowSearch]        = useState(false);
  const [activeTab,        setActiveTab]         = useState('inner');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const searchRef = useRef(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = { sort: 'trending', limit: 50, category: selectedCategory === 'All' ? undefined : selectedCategory };
      const [globalRes, followedRes] = await Promise.all([
        api.get('/statuses', { params: { ...params, mode: 'global' } }),
        user ? api.get('/statuses', { params: { ...params, mode: 'followed' } }) : Promise.resolve({ data: { data: [] } })
      ]);
      if (globalRes.data.success)   setGlobalStatuses(globalRes.data.data  || []);
      if (followedRes.data.success) setFollowedStatuses(followedRes.data.data || []);
    } catch (e) {
      console.error('[StatusHub] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user, selectedCategory]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchRef.current?.focus(), 100);
  }, [showSearch]);

  const clientFilteredFollowed = useMemo(() => {
    const pool = followedStatuses.filter(s =>
      !search.trim() ||
      [s.vendor_id?.store_name, s.caption, s.text_content].some(t => t?.toLowerCase().includes(search.toLowerCase()))
    );
    return selectedCategory === 'All' ? pool : pool.filter(s => s.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [followedStatuses, search, selectedCategory]);

  const clientFilteredGlobal = useMemo(() => {
    const followedIds = new Set(followedStatuses.map(s => s.vendor_id?._id));
    const pool = globalStatuses.filter(s =>
      (!user || !followedIds.has(s.vendor_id?._id)) &&
      (!search.trim() || [s.vendor_id?.store_name, s.caption, s.text_content].some(t => t?.toLowerCase().includes(search.toLowerCase())))
    );
    return selectedCategory === 'All' ? pool : pool.filter(s => s.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [globalStatuses, followedStatuses, search, user, selectedCategory]);

  const activePool = activeTab === 'inner' ? clientFilteredFollowed : clientFilteredGlobal;

  const handleOpen = (status, pool) => {
    pool.slice(0, 6).forEach(s => warmStoryMedia(s, s._id === status._id));
    onSelectStatus(pool, status._id);
  };

  if (loading && !globalStatuses.length && !followedStatuses.length) return <Skeleton />;

  return (
    <div className="bg-[var(--bg-secondary)] min-h-screen pb-32 w-full">
      {/* â”€â”€ Compact Sticky Header â”€â”€ */}
      <div className="sticky top-0 z-40 bg-[var(--bg-primary)]/90 backdrop-blur-3xl border-b border-[var(--glass-border)] w-full">
        <div className="w-full px-4 pt-4 pb-3 space-y-3">

          {/* Row 1: Title + Active Now + Search toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl  font-bold tracking-tighter text-[var(--text-primary)] leading-none">
                Aura Story
              </h2>
              {/* Active Now badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-400" />
                </span>
                <span className="text-[11px] lg:text-[12px]  font-semibold text-emerald-400 tracking-normal">Active Now</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search toggle */}
              <button
                onClick={() => { setShowSearch(s => !s); if (showSearch) setSearch(''); }}
                className={`size-9 rounded-full border flex items-center justify-center transition-all ${showSearch ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]'}`}
              >
                {showSearch ? <X className="size-3.5" /> : <Search className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Search bar (collapsible) */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search stories, vendors..."
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl py-2.5 px-4 text-[12px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 transition-all placeholder:text-[var(--text-secondary)]/30"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Row 2: Tab toggle */}
          <div className="flex p-1 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--glass-border)]">
            <button
              onClick={() => setActiveTab('inner')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] lg:text-[12px]  font-semibold transition-all ${activeTab === 'inner' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-md border border-[var(--glass-border)]' : 'text-[var(--text-secondary)] opacity-50'}`}
            >
              <Users className="size-3" /> Inner Circle
            </button>
            <button
              onClick={() => setActiveTab('pulse')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] lg:text-[12px]  font-semibold transition-all ${activeTab === 'pulse' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-md border border-[var(--glass-border)]' : 'text-[var(--text-secondary)] opacity-50'}`}
            >
              <Globe className="size-3" /> Global Pulse
            </button>
          </div>

          {/* Row 3: Category pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full border transition-all text-[11px] lg:text-[12px]  font-semibold ${selectedCategory === c ? 'bg-[var(--accent)] text-white border-transparent shadow-md' : 'bg-[var(--bg-primary)] border-[var(--glass-border)] text-[var(--text-secondary)]'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* â”€â”€ Grid â”€â”€ */}
      <div className="w-full px-3 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activePool.length > 0 ? (
              activeTab === 'inner' ? (
                /* Inner circle â€” regular 2-col grid */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 md:gap-3">
                  {activePool.map((s, i) => (
                    <PremiumCard
                      key={s._id}
                      status={s}
                      isNew={!s.isViewed}
                      priority={i < 4 ? 'high' : 'auto'}
                      className="aspect-[3/4]"
                      onClick={() => handleOpen(s, activePool)}
                    />
                  ))}
                </div>
              ) : (
                /* Global pulse â€” masonry columns */
                <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-2.5 md:gap-3 space-y-2.5 md:space-y-3">
                  {activePool.map((s, i) => (
                    <PremiumCard
                      key={s._id}
                      status={s}
                      rank={i < 10 ? i + 1 : null}
                      isNew={!s.isViewed}
                      priority={i < 6 ? 'high' : 'auto'}
                      className={`w-full break-inside-avoid ${i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-square'}`}
                      onClick={() => handleOpen(s, activePool)}
                    />
                  ))}
                </div>
              )
            ) : (
              <Empty
                icon={activeTab === 'inner' ? <Users className="size-10 opacity-20" /> : <Globe className="size-10 opacity-20" />}
                title={activeTab === 'inner' ? 'Quiet in the Circle' : 'No New Vibes'}
                desc={
                  activeTab === 'inner'
                    ? user ? "The vendors you follow haven't posted recently." : 'Sign in to follow vendors.'
                    : "No stories at the moment. Check back soon!"
                }
                action={activeTab === 'inner' && !user ? 'Sign In' : activeTab === 'inner' ? 'Explore Global' : 'Refresh'}
                onAction={() => activeTab === 'inner' ? setActiveTab('pulse') : fetch()}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-[var(--bg-secondary)] min-h-screen p-3 pt-6 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="w-36 h-7 bg-white/5 animate-pulse rounded-xl" />
        <div className="w-24 h-7 bg-white/5 animate-pulse rounded-xl" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-[1.5rem] bg-white/5 animate-pulse border border-white/5" />
        ))}
      </div>
    </div>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────
function Empty({ icon, title, desc, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-5 bg-[var(--bg-primary)]/30 rounded-[2rem] border border-dashed border-[var(--glass-border)] mt-4">
      <div className="size-20 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--glass-border)]">
        {icon}
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h4 className="text-base  font-bold tracking-tight text-[var(--text-primary)]">{title}</h4>
        <p className="text-[11px] lg:text-[12px] font-medium text-[var(--text-secondary)] leading-relaxed opacity-60">{desc}</p>
      </div>
      {action && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[var(--accent)] text-white text-[11px] lg:text-[12px]  font-semibold shadow-lg hover:scale-105 transition-all active:scale-95"
        >
          {action}
        </button>
      )}
    </div>
  );
}
