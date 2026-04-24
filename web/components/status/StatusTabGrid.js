"use client";
import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { 
  Heart, Flame, Play, Search, X, Eye, 
  TrendingUp, Zap, Clock, Tag, ShoppingBag, 
  Plus, Users, Globe, Sparkles, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';
import BlurUpImage from '@/components/common/BlurUpImage';
import { useAuthStore } from '@/hooks/useAuth';

// ─── Utils ─────────────────────────────────────────────────────────────────────

const ago = d => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
};

const hoursLeft = exp => Math.max(0, (new Date(exp) - Date.now()) / 3600000);

const score = s => (s.likes_count || 0) * 3 + (s.views_count || 0) - ((Date.now() - new Date(s.createdAt)) / 3600000) * 0.4;

// ─── Premium Shared Card ────────────────────────────────────────────────────────
const PremiumCard = memo(function PremiumCard({ status, rank, isNew, priority = 'auto', onClick, className = '' }) {
  const v = status.vendor_id;
  const logo = v?.user_id?.branding?.logo || v?.user_id?.avatar;
  const name = v?.store_name || 'Store';
  const isText = status.type === 'text';
  const expH = hoursLeft(status.expires_at);
  const urgent = expH > 0 && expH < 12;

  return (
    <motion.button
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      onMouseEnter={() => {
        if (status.content_url && status.type !== 'text') {
          if (status.type === 'video') {
            const vid = document.createElement('video');
            vid.src = status.content_url;
            vid.preload = 'auto';
          } else {
            const img = new Image();
            img.src = status.content_url;
          }
        }
      }}
      className={`group relative overflow-hidden rounded-[2rem] shadow-2xl transition-all duration-500 cursor-pointer ${className}`}
    >
      {/* Dynamic Background with Glow */}
      <div className="absolute inset-0">
        {!isText ? (
          <>
            <BlurUpImage src={status.content_url} alt={name} priority={priority}
              className="w-full h-full group-hover:scale-110 transition-transform duration-[2s] ease-out"
              objectFit="cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
          </>
        ) : (
          <div className="size-full flex items-center justify-center p-6 text-center overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #090909 0%, #1a1a1a 100%)' }}>
            {/* Animated background blobs */}
            <div className="absolute -top-10 -left-10 size-32 bg-[var(--accent)] blur-[60px] opacity-20 rounded-full animate-pulse" />
            <div className="absolute -bottom-10 -right-10 size-32 bg-purple-600 blur-[60px] opacity-20 rounded-full animate-pulse delay-700" />
            
            <p className="relative z-10 text-xs font-semibold italic text-white/90 leading-relaxed line-clamp-6">
              {status.text_content}
            </p>
          </div>
        )}
      </div>

      {/* Glass Overlay for info */}
      <div className="absolute inset-x-0 bottom-0 p-4 z-20 translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 space-y-2 shadow-2xl">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full border border-white/20 overflow-hidden bg-black/40 shrink-0">
              {logo ? (
                <BlurUpImage src={logo} alt={name} priority="low" className="size-full" objectFit="cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-[8px] font-black text-white bg-gradient-to-br from-[var(--accent)] to-purple-600">
                  {name[0]}
                </div>
              )}
            </div>
            <p className="text-[10px] font-bold text-white truncate">{name}</p>
            {isNew && (
              <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)] text-white text-[8px] font-bold">
                <Sparkles className="size-2" /> New
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[8px] font-bold text-white/70">
                <Heart className="size-2.5 text-red-400 fill-red-400/20" />
                <span>{status.likes_count || 0}</span>
              </div>
              <div className="flex items-center gap-1 text-[8px] font-bold text-white/70">
                <Eye className="size-2.5 text-blue-400" />
                <span>{status.views_count || 0}</span>
              </div>
            </div>
            <span className="text-[8px] font-bold text-white/40">{ago(status.createdAt)}</span>
          </div>

          {status.linked_product && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[8px] font-bold text-white/80">
              <ShoppingBag className="size-2.5 text-[var(--accent)]" />
              <span className="truncate">{status.linked_product.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Badges */}
      <div className="absolute top-4 left-4 z-30 flex gap-2">
        {rank && (
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-lg">
             <Flame className={`size-3 ${rank === 1 ? 'text-orange-400' : 'text-white/60'}`} />
             <span className="text-[9px] font-black text-white">#{rank}</span>
          </div>
        )}
      </div>

      {urgent && (
        <div className="absolute top-4 right-4 z-30">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/80 backdrop-blur-xl border border-white/20 text-[9px] font-black text-white shadow-lg animate-pulse">
            <Clock className="size-3" /> {Math.floor(expH)}h
          </div>
        </div>
      )}
    </motion.button>
  );
});

const CATEGORIES = ['All', 'Fashion', 'Electronics', 'Lifestyle', 'Tech', 'Art', 'Beauty', 'General'];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function StatusTabGrid({ onSelectStatus }) {
  const { user } = useAuthStore();
  const [followedStatuses, setFollowedStatuses] = useState([]);
  const [globalStatuses, setGlobalStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('inner'); // Inner Circle (followed) is default
  const [selectedCategory, setSelectedCategory] = useState('All');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = { 
        sort: 'trending', 
        limit: 50,
        category: selectedCategory === 'All' ? undefined : selectedCategory
      };

      const [globalRes, followedRes] = await Promise.all([
        api.get('/statuses', { params: { ...params, mode: 'global' } }),
        user ? api.get('/statuses', { params: { ...params, mode: 'followed' } }) : Promise.resolve({ data: { data: [] } })
      ]);

      if (globalRes.data.success) {
        setGlobalStatuses(globalRes.data.data || []);
      }
      if (followedRes.data.success) {
        setFollowedStatuses(followedRes.data.data || []);
      }
    } catch (e) {
      console.error('[StatusHub] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user, selectedCategory]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Preload Top Stories for WhatsApp-speed viewing
  useEffect(() => {
    const pool = activeTab === 'inner' ? followedStatuses : globalStatuses;
    pool.slice(0, 15).forEach(s => {
      if (s.content_url && s.type === 'image') {
        const img = new Image();
        img.src = s.content_url;
      }
    });
  }, [followedStatuses, globalStatuses, activeTab]);

  // Instant client-side filter (shows result before API refetches)
  const clientFilteredFollowed = useMemo(() => {
    const pool = followedStatuses.filter(s =>
      !search.trim() ||
      [s.vendor_id?.store_name, s.caption, s.text_content].some(t => t?.toLowerCase().includes(search.toLowerCase()))
    );
    if (selectedCategory === 'All') return pool;
    return pool.filter(s => s.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [followedStatuses, search, selectedCategory]);

  const clientFilteredGlobal = useMemo(() => {
    const followedIds = new Set(followedStatuses.map(s => s.vendor_id?._id));
    const pool = globalStatuses.filter(s =>
      (!user || !followedIds.has(s.vendor_id?._id)) &&
      (!search.trim() || [s.vendor_id?.store_name, s.caption, s.text_content].some(t => t?.toLowerCase().includes(search.toLowerCase())))
    );
    if (selectedCategory === 'All') return pool;
    return pool.filter(s => s.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [globalStatuses, followedStatuses, search, user, selectedCategory]);

  // Legacy aliases used by render
  const filteredFollowed = clientFilteredFollowed;
  const filteredGlobal   = clientFilteredGlobal;

  const handleOpen = (status, pool) => {
    // Preload sibling stories when one is opened
    pool.slice(0, 10).forEach(s => { if (s.content_url) new Image().src = s.content_url; });

    // Just pass the pool as-is and the clicked ID
    onSelectStatus(pool, status._id);
  };

  if (loading && !globalStatuses.length && !followedStatuses.length) return <Skeleton />;

  return (
    <div className="bg-[var(--bg-secondary)] min-h-screen pb-32 w-full">
      {/* ── HIGH-END STICKY HEADER ── */}
      <div className="sticky top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-3xl border-b border-[var(--glass-border)] w-full">
        <div className="w-full px-2 md:px-4 pt-6 pb-4 space-y-6">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-[var(--text-primary)] leading-none uppercase">
                Aura Story
              </h2>
            </div>
            
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
              <div className="size-2 rounded-full bg-[var(--accent)] animate-pulse" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                Active Now
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Tabs for Inner vs Pulse */}
            <div className="flex p-1.5 bg-[var(--bg-secondary)] rounded-[1.5rem] border border-[var(--glass-border)] w-full md:w-auto">
              <button 
                onClick={() => setActiveTab('inner')}
                className={`flex-1 md:flex-none flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[11px] font-bold transition-all ${activeTab === 'inner' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-xl border border-[var(--glass-border)]' : 'text-[var(--text-secondary)] opacity-50'}`}
              >
                <Users className="size-3.5" /> Inner Circle
              </button>
              <button 
                onClick={() => setActiveTab('pulse')}
                className={`flex-1 md:flex-none flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[11px] font-bold transition-all ${activeTab === 'pulse' ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-xl border border-[var(--glass-border)]' : 'text-[var(--text-secondary)] opacity-50'}`}
              >
                <Globe className="size-3.5" /> Global Pulse
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative w-full md:w-72 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]/40 group-focus-within:text-[var(--accent)] transition-colors" />
              <input 
                type="text" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search vibes..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl py-3 pl-11 pr-11 text-[11px] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/40 transition-all placeholder:text-[var(--text-secondary)]/30"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--accent)]">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-2 md:px-4 pt-10">
        <AnimatePresence mode="wait">
          {activeTab === 'inner' ? (
            <motion.div 
              key="inner-circle"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-12"
            >
              {/* Personalized Header - Simplified */}
              <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="hidden md:block">
                  {/* Empty space or small indicator if needed, but removing the requested text */}
                </div>

                {/* Category Tags */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {CATEGORIES.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setSelectedCategory(c)}
                      className={`shrink-0 px-5 py-2.5 rounded-full border transition-all text-[11px] font-bold ${selectedCategory === c ? 'bg-[var(--accent)] text-white border-transparent shadow-lg' : 'bg-[var(--bg-primary)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </section>

              {filteredFollowed.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
                  {filteredFollowed.map((s, i) => (
                    <PremiumCard 
                      key={s._id} 
                      status={s} 
                      isNew={i < 3}
                      priority={i < 4 ? 'high' : 'auto'}
                      className="aspect-[4/5]"
                      onClick={() => handleOpen(s, filteredFollowed)}
                    />
                  ))}
                </div>
              ) : (
                <Empty 
                  icon={<Users className="size-12 opacity-20" />}
                  title="Quiet in the Circle"
                  desc={user ? "The vendors you follow haven't posted recently. Explore the Global Pulse for something new!" : "Sign in to follow vendors and build your personal pulse."}
                  action={!user ? "Sign In" : "Explore Global"}
                  onAction={() => setActiveTab('pulse')}
                />
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="global-pulse"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-black tracking-tighter text-[var(--text-primary)]">
                    Global <span className="text-purple-500">Discovery</span>
                  </h3>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50 uppercase tracking-[0.2em] mt-1">
                    What's trending across Aura Market
                  </p>
                </div>
                
                {/* Category Tags */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {CATEGORIES.map(c => (
                    <button 
                      key={c} 
                      onClick={() => setSelectedCategory(c)}
                      className={`shrink-0 px-5 py-2.5 rounded-full border transition-all text-[11px] font-bold ${selectedCategory === c ? 'bg-[var(--accent)] text-white border-transparent shadow-lg' : 'bg-[var(--bg-primary)] border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </section>

              {filteredGlobal.length > 0 ? (
                <div className="columns-2 sm:columns-4 md:columns-5 lg:columns-6 gap-3 md:gap-4 space-y-3 md:space-y-4">
                  {filteredGlobal.map((s, i) => (
                    <PremiumCard 
                      key={s._id} 
                      status={s} 
                      rank={i < 10 ? i + 1 : null}
                      priority={i < 6 ? 'high' : 'auto'}
                      className={`w-full break-inside-avoid ${i % 3 === 0 ? 'h-96' : 'h-72'}`}
                      onClick={() => handleOpen(s, filteredGlobal)}
                    />
                  ))}
                </div>
              ) : (
                <Empty 
                  icon={<Globe className="size-12 opacity-20" />}
                  title="No New Vibes"
                  desc="We couldn't find any new statuses to discover at the moment. Check back in a few!"
                  action="Refresh"
                  onAction={fetch}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Elegant UI Components ───────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-[var(--bg-secondary)] min-h-screen p-8 pt-24 space-y-12">
      <div className="flex justify-between items-end">
        <div className="space-y-4">
          <div className="w-48 h-10 bg-white/5 animate-pulse rounded-2xl" />
          <div className="w-32 h-4 bg-white/5 animate-pulse rounded-full" />
        </div>
        <div className="w-32 h-12 bg-white/5 animate-pulse rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="aspect-[4/5] rounded-[2rem] bg-white/5 animate-pulse border border-white/5" />
        ))}
      </div>
    </div>
  );
}

function Empty({ icon, title, desc, action, onAction }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-32 px-6 text-center space-y-6 bg-[var(--bg-primary)]/40 rounded-[3rem] border border-dashed border-[var(--glass-border)]"
    >
      <div className="size-24 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--glass-border)] shadow-inner">
        {icon}
      </div>
      <div className="space-y-2 max-w-sm">
        <h4 className="text-xl font-black tracking-tight text-[var(--text-primary)] uppercase">{title}</h4>
        <p className="text-[11px] font-medium text-[var(--text-secondary)] leading-relaxed opacity-60">
          {desc}
        </p>
      </div>
      {action && (
        <button 
          onClick={onAction}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-[var(--accent)] text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all active:scale-95"
        >
          {action} <ChevronRight className="size-3.5" />
        </button>
      )}
    </motion.div>
  );
}

