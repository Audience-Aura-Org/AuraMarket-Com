"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Flame, Zap, Globe, Play, Search, X } from 'lucide-react';
import api from '@/services/api';

const SORT_TABS = [
  { id: 'trending', label: 'Trending', icon: Flame, emoji: '🔥' },
  { id: 'new', label: 'New', icon: Zap, emoji: '⚡' },
  { id: 'popular', label: 'All', icon: Globe, emoji: '🌐' },
];

/**
 * StatusTabGrid
 * Premium full-page masonry-style stories grid.
 * - Async filter switching with skeleton states
 * - Search/filter bar
 * - Staggered entry animations
 * - Click to open StatusViewer
 */
export default function StatusTabGrid({ onSelectStatus }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('trending');
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/statuses', { params: { mode: 'global', sort: sortBy } });
      if (res.data.success) setStatuses(res.data.data || []);
    } catch (e) {
      console.error('Failed to fetch global statuses:', e);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  const filtered = search.trim()
    ? statuses.filter(s =>
        s.vendor_id?.store_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.caption?.toLowerCase().includes(search.toLowerCase()) ||
        s.text_content?.toLowerCase().includes(search.toLowerCase())
      )
    : statuses;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--glass-border)]/60">
        {/* Title + sort row */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 gap-4">
          <div className="flex items-center gap-2.5">
            <div className="size-7 md:size-8 rounded-xl bg-gradient-to-br from-[var(--accent)] to-purple-600 flex items-center justify-center shadow-md shadow-[var(--accent)]/30">
              <Flame className="size-3.5 md:size-4 text-white" />
            </div>
            <h2 className="text-sm md:text-base font-black tracking-tight text-[var(--text-primary)]">
              Aura Stories
            </h2>
          </div>

          {/* Sort Pills */}
          <div className="flex bg-[var(--bg-secondary)] rounded-xl p-1 gap-1 border border-[var(--glass-border)]">
            {SORT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSortBy(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-200 ${
                  sortBy === tab.id
                    ? 'bg-gradient-to-r from-[var(--accent)] to-purple-600 text-white shadow-md shadow-[var(--accent)]/20'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-[var(--text-secondary)]/50" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search stories or vendors..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl py-2.5 pl-9 pr-9 text-[11px] font-medium outline-none focus:ring-1 focus:ring-[var(--accent)]/50 placeholder:text-[var(--text-secondary)]/40 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <X className="size-3.5 text-[var(--text-secondary)]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-y-auto px-3 md:px-5 pt-4 pb-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className={`rounded-2xl bg-gradient-to-b from-[var(--bg-primary)] to-[var(--accent)]/5 animate-pulse border border-[var(--glass-border)]/50 ${
                  i % 5 === 0 ? 'aspect-[3/5]' : i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-[3/4]'
                }`}
              />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={sortBy + search}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4"
            >
              {filtered.map((status, idx) => (
                <StatusCard
                  key={status._id}
                  status={status}
                  index={idx}
                  featured={idx === 0}
                  onClick={() => onSelectStatus([status])}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
            <div className="size-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
              <Globe className="size-8 text-[var(--accent)]/40" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {search ? 'No stories match your search' : 'No Active Stories'}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]/50 mt-1">
                {search ? 'Try a different term' : 'Check back soon for new vendor stories'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ status, index, featured, onClick }) {
  const vendor = status.vendor_id;
  const isVideo = status.type === 'video';
  const isText = status.type === 'text';

  const aspectClass = featured
    ? 'aspect-[3/5]'
    : index % 7 === 0
    ? 'aspect-[3/5]'
    : 'aspect-[3/4]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.04, 0.4),
        type: 'spring',
        stiffness: 300,
        damping: 24,
      }}
      onClick={onClick}
      className={`group relative ${aspectClass} rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
    >
      {/* ── Background media ── */}
      <div className="absolute inset-0 z-0">
        {!isText ? (
          <img
            src={status.content_url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="size-full p-5 flex items-center justify-center text-center"
            style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #1a0a2e 100%)' }}
          >
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-4 left-4 size-20 rounded-full bg-[var(--accent)] blur-[40px]" />
              <div className="absolute bottom-4 right-4 size-16 rounded-full bg-purple-600 blur-[30px]" />
            </div>
            <p className="relative z-10 text-[10px] md:text-[11px] font-black italic uppercase text-white leading-relaxed line-clamp-5">
              {status.text_content}
            </p>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20 group-hover:from-black/90 transition-all duration-300" />
      </div>

      {/* Video badge */}
      {isVideo && (
        <div className="absolute top-2.5 right-2.5 z-10 size-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center">
          <Play className="size-3 text-white fill-current ml-0.5" />
        </div>
      )}

      {/* Trending badge for first item */}
      {featured && (
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/20">
          <Flame className="size-2.5 text-orange-400" />
          <span className="text-[8px] font-black uppercase tracking-widest text-white">Top</span>
        </div>
      )}

      {/* ── Info overlay ── */}
      <div className="absolute inset-x-0 bottom-0 p-3 z-10">
        {/* Vendor row */}
        <div className="flex items-center gap-2 mb-2">
          <div className="size-5 md:size-6 rounded-full border border-white/30 overflow-hidden shrink-0 bg-black/40">
            {vendor?.user_id?.avatar || vendor?.user_id?.branding?.logo ? (
              <img
                src={vendor.user_id.branding?.logo || vendor.user_id.avatar}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full flex items-center justify-center text-[8px] font-black text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">
                {vendor?.store_name?.[0]}
              </div>
            )}
          </div>
          <p className="text-[9px] font-black text-white/90 uppercase tracking-tight truncate">
            {vendor?.store_name}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
            <Heart className="size-2.5 text-red-400 fill-current" />
            <span className="text-[8px] font-bold text-white">{status.likes_count || 0}</span>
          </div>
          <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">
            {new Date(status.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
