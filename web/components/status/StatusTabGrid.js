"use client";
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Heart, Flame, Globe, Play, Search, X } from 'lucide-react';
import api from '@/services/api';
import BlurUpImage from '@/components/common/BlurUpImage';

const SORT_TABS = [
  { id: 'trending', label: 'Trending' },
  { id: 'new',      label: 'Recent'   },
  { id: 'popular',  label: 'All'      },
];

/**
 * StatusTabGrid — WhatsApp-speed stories grid.
 * - Cards tap instantly (never block on image load)
 * - Shimmer skeleton while images load (like WhatsApp)
 * - fetchPriority="high" on first visible row
 * - Memo'd cards prevent re-renders on sort/search change
 * - Background preload of all images after data arrives
 */
export default function StatusTabGrid({ onSelectStatus }) {
  const [statuses, setStatuses]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [sortBy,   setSortBy]     = useState('trending');
  const [search,   setSearch]     = useState('');
  const searchRef = useRef(null);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/statuses', { params: { mode: 'global', sort: sortBy } });
      if (res.data.success) {
        const data = res.data.data || [];
        setStatuses(data);

        // Fire-and-forget preload — all images enter browser cache immediately
        data.forEach(s => {
          if (s.type === 'image' && s.content_url) {
            const img = new Image();
            img.src = s.content_url;
          }
        });
      }
    } catch (e) {
      console.error('Failed to fetch global statuses:', e);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  const baseFiltered = search.trim()
    ? statuses.filter(s =>
        s.vendor_id?.store_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.caption?.toLowerCase().includes(search.toLowerCase()) ||
        s.text_content?.toLowerCase().includes(search.toLowerCase())
      )
    : statuses;

  // Max 2 tiles per vendor so no single store dominates
  const vendorCounts = {};
  const gridStatuses = baseFiltered.filter(s => {
    const vId = s.vendor_id?._id || 'unknown';
    vendorCounts[vId] = (vendorCounts[vId] || 0) + 1;
    return vendorCounts[vId] <= 2;
  });

  return (
    <div className="flex flex-col bg-[var(--bg-secondary)]">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-xl border-b border-[var(--glass-border)]/60">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-50">
              Live Feed
            </h2>
            <div className="size-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)] animate-pulse" />
          </div>

          <div className="flex bg-[var(--bg-secondary)]/50 rounded-full h-9 p-1 gap-1 border border-black/[0.05] dark:border-white/[0.05]">
            {SORT_TABS.map(tab => {
              const isActive = sortBy === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSortBy(tab.id)}
                  className={`flex items-center px-4 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-150 ${
                    isActive
                      ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg'
                      : 'text-[var(--text-secondary)]/40 hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

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
      <div className="px-3 md:px-5 pt-4 pb-6">
        {loading ? (
          /* WhatsApp-style shimmer skeleton — matches the real card shape */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className={`${i === 0 ? 'aspect-[3/5]' : 'aspect-[3/4]'} rounded-2xl overflow-hidden relative`}
              >
                {/* Shimmer base */}
                <div className="absolute inset-0 animate-shimmer" />
                {/* Faint bottom overlay to hint at card structure */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent rounded-b-2xl" />
                {/* Avatar ghost */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <div className="size-5 rounded-full bg-white/10" />
                  <div className="h-2 w-14 rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : gridStatuses.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {gridStatuses.map((status, i) => (
              <StatusCard
                key={status._id}
                status={status}
                featured={i === 0}
                // fetchPriority high for first 6 visible cards, low for rest
                priority={i < 6 ? 'high' : 'low'}
                onClick={() => {
                  const vId = status.vendor_id?._id;
                  const vendorItems = statuses.filter(s => s.vendor_id?._id === vId);
                  const otherItems  = statuses.filter(s => s.vendor_id?._id !== vId);
                  onSelectStatus([...vendorItems, ...otherItems]);
                }}
              />
            ))}
          </div>
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

/**
 * StatusCard — WhatsApp blur-up card.
 * BlurUpImage: blurred placeholder appears instantly (no stops, no white flash),
 * sharp image fades in once loaded. Tap is always instant.
 */
const StatusCard = memo(function StatusCard({ status, featured, priority, onClick }) {
  const vendor      = status.vendor_id;
  const isVideo     = status.type === 'video';
  const isText      = status.type === 'text';
  const aspectClass = featured ? 'aspect-[3/5]' : 'aspect-[3/4]';
  const vendorAvatar = vendor?.user_id?.branding?.logo || vendor?.user_id?.avatar;

  return (
    <div
      onClick={onClick}
      className={`group relative ${aspectClass} rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-150`}
    >
      {/* ── Background layer ── */}
      <div className="absolute inset-0 z-0">
        {!isText ? (
          // BlurUpImage: blurred placeholder → sharp fade-in. No stops.
          <BlurUpImage
            src={status.content_url}
            alt=""
            priority={priority}
            className="w-full h-full group-hover:scale-105 transition-transform duration-300"
            objectFit="cover"
          />
        ) : (
          /* Text story — always instant */
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

        {/* Gradient overlay — always on top */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/25 group-hover:from-black/90 transition-all duration-150" />
      </div>

      {/* Video badge */}
      {isVideo && (
        <div className="absolute top-2.5 right-2.5 z-10 size-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center">
          <Play className="size-3 text-white fill-current ml-0.5" />
        </div>
      )}

      {/* Featured badge */}
      {featured && (
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/20">
          <Flame className="size-2.5 text-orange-400" />
          <span className="text-[8px] font-black uppercase tracking-widest text-white">Top</span>
        </div>
      )}

      {/* ── Info overlay ── */}
      <div className="absolute inset-x-0 bottom-0 p-3 z-10">
        <div className="flex items-center gap-2 mb-2">
          <VendorAvatar src={vendorAvatar} name={vendor?.store_name} />
          <p className="text-[9px] font-black text-white/90 uppercase tracking-tight truncate">
            {vendor?.store_name}
          </p>
        </div>

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
    </div>
  );
});

/** Vendor avatar — blur-up progressive load, no state boilerplate */
function VendorAvatar({ src, name }) {
  if (src) {
    return (
      <BlurUpImage
        src={src}
        alt={name || ''}
        priority="low"
        className="size-5 md:size-6 rounded-full border border-white/30 shrink-0 overflow-hidden"
        objectFit="cover"
      />
    );
  }
  return (
    <div className="size-5 md:size-6 rounded-full border border-white/30 overflow-hidden shrink-0 flex items-center justify-center text-[8px] font-black text-white bg-gradient-to-br from-[var(--accent)] to-purple-700">
      {name?.[0]}
    </div>
  );
}
