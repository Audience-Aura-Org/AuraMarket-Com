"use client";
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Activity, Loader2, RefreshCw } from 'lucide-react';
import api from '@/services/api';

/**
 * StatusTabGrid
 * Full-page grid for the 'Status' tab in DiscoveryHub.
 * Shows all active statuses sorted by likes/engagement.
 */
export default function StatusTabGrid({ onSelectStatus }) {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('trending');

  const fetchStatuses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/statuses', { params: { mode: 'global', sort: sortBy } });
      if (res.data.success) {
        setStatuses(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch global statuses:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, [sortBy]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] overflow-y-auto pb-40">
      {/* Header & Internal Filters */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)] px-6 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="size-5 text-[var(--accent)]" />
          <h2 className="text-sm font-black italic uppercase tracking-tighter text-[var(--text-primary)]">Node Stories</h2>
        </div>
        
        <div className="flex bg-[var(--bg-secondary)] rounded-xl p-1 border border-[var(--glass-border)]">
           <button 
             onClick={() => setSortBy('trending')}
             className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sortBy === 'trending' ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
           >
             Trending 🔥
           </button>
           <button 
             onClick={() => setSortBy('new')}
             className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sortBy === 'new' ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
           >
             New ⚡
           </button>
           <button 
             onClick={() => setSortBy('popular')}
             className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sortBy === 'popular' ? 'bg-[var(--accent)] text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
           >
             All
           </button>
        </div>
      </div>

      {/* Grid */}
      <div className="p-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-3xl bg-[var(--accent)]/5 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : statuses.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {statuses.map((status, idx) => (
              <StatusCard 
                key={status._id} 
                status={status} 
                index={idx}
                onClick={() => onSelectStatus([status])} 
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center opacity-40">
            <RefreshCw className="size-12 mb-4 animate-spin-slow" />
            <p className="text-xs font-black uppercase tracking-widest">No Active Nodes Uploaded</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ status, index, onClick }) {
  const vendor = status.vendor_id;
  const isVideo = status.type === 'video';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="group relative aspect-[3/4] rounded-3xl overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 cursor-pointer"
    >
      {/* Media Preview */}
      <div className="absolute inset-0 z-0">
        {status.type === 'image' || status.type === 'video' ? (
          <img src={status.content_url} className="size-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt="" />
        ) : (
          <div className="size-full bg-gradient-to-br from-[var(--accent)] to-[#111] p-4 flex items-center justify-center text-center">
            <p className="text-[10px] font-black italic uppercase text-white/80 line-clamp-4">{status.text_content}</p>
          </div>
        )}
        {/* Play Icon for Video */}
        {isVideo && (
          <div className="absolute top-3 right-3 size-6 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Activity className="size-3 text-white fill-current" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
      </div>

      {/* Info Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="size-6 rounded-full border border-white/20 overflow-hidden shrink-0">
            <img src={vendor?.user_id?.avatar || vendor?.user_id?.branding?.logo} className="size-full object-cover" alt="" />
          </div>
          <p className="text-[9px] font-black text-white uppercase tracking-tighter truncate">{vendor?.store_name}</p>
        </div>

        <div className="flex items-center justify-between">
           <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/5">
              <Heart className="size-2.5 text-red-500 fill-current" />
              <span className="text-[9px] font-bold text-white">{status.likes_count || 0}</span>
           </div>
           <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">{new Date(status.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
        </div>
      </div>
    </motion.div>
  );
}
