"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Eye, Heart,
  RefreshCw, Activity, Calendar, Clock, Zap, Flame, Shield, RotateCcw,
  ShoppingBag
} from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import socketService from '@/services/socket';
import StatusCreator from './StatusCreator';
import BlurUpImage from '@/components/common/BlurUpImage';
import MediaThumbnail from '@/components/common/MediaThumbnail';
import { toast } from 'react-hot-toast';

/**
 * StatusManager
 * Management interface for vendors to monitor and control their stories.
 * Shows insights (views, likes) and allows deletion.
 */
export default function StatusManager() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [reshareTarget, setReshareTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchMyStatuses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/statuses/my-statuses');
      if (res.data.success) setStatuses(res.data.data || []);
    } catch (e) {
      console.error('Failed to fetch my statuses:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyStatuses();

    // ── Real-time Engagement Listener ──
    const handleStatusUpdate = (update) => {
      setStatuses(prev => prev.map(s => {
        if (s._id?.toString() === update.status_id?.toString()) {
          if (update.type === 'view') return { ...s, views_count: update.count };
          if (update.type === 'like') return { ...s, likes_count: update.count };
        }
        return s;
      }));
    };

    socketService.on('status_update', handleStatusUpdate);
    return () => socketService.off('status_update', handleStatusUpdate);
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this story?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/statuses/${id}`);
      setStatuses(prev => prev.filter(s => s._id !== id));
      toast.success('Story deleted');
    } catch (e) {
      console.error(e);
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4 md:px-0">
        <div className="space-y-3">
          <p className="text-[10px] md:text-[11px] font-bold tracking-[0.3em] text-[var(--accent)] uppercase opacity-80">Operational Management</p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-[var(--text-primary)] leading-none">
            Active <span className="opacity-40">Statuses</span>
          </h2>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap md:flex-nowrap">
          <Link 
            href="/vendor/products/add"
            className="flex-1 md:flex-none border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-primary)] px-8 md:px-10 py-4 rounded-2xl font-bold text-[11px] md:text-xs tracking-tight hover:border-[var(--accent)]/40 hover:bg-[var(--bg-secondary)] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-sm"
          >
            <ShoppingBag className="size-4 text-[var(--accent)]" />
            Add Product
          </Link>
          <button 
            onClick={() => { setReshareTarget(null); setShowCreator(true); }}
            className="flex-1 md:flex-none bg-[var(--accent)] text-white px-8 md:px-10 py-4 rounded-2xl font-bold text-[11px] md:text-xs tracking-tight hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-[var(--accent)]/20 active:scale-95"
          >
            <Plus className="size-4" />
            Deploy New Story
          </button>
        </div>
      </section>

      {/* Bento Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 px-4 md:px-0">
        {/* Create Story Card */}
        <div 
          onClick={() => { setReshareTarget(null); setShowCreator(true); }}
          className="group cursor-pointer aspect-[4/5] bg-[var(--bg-secondary)]/50 border-2 border-dashed border-[var(--glass-border)] flex flex-col items-center justify-center gap-6 rounded-[2.5rem] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent)]/30 transition-all duration-500 shadow-sm"
        >
          <div className="size-16 rounded-full border border-[var(--glass-border)] flex items-center justify-center group-hover:scale-110 group-hover:border-[var(--accent)] transition-all duration-500 bg-[var(--bg-primary)]/50">
            <Plus className="size-8 text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors" />
          </div>
          <span className="text-[10px] md:text-[11px] font-bold tracking-[0.25em] text-[var(--text-primary)] opacity-40 group-hover:opacity-100 transition-opacity uppercase">Initialize Story</span>
        </div>

        {/* Active Status Cards */}
        {statuses.filter(s => new Date(s.expires_at) > new Date()).map(status => {
          const timeLeft = Math.max(0, Math.floor((new Date(status.expires_at) - new Date()) / (1000 * 60 * 60)));
          return (
            <div key={status._id} className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden group shadow-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] transition-all hover:shadow-2xl">
              {/* Media Content */}
              {status.type === 'image' || status.type === 'video' ? (
                <MediaThumbnail 
                  src={status.content_url} 
                  className="size-full"
                  imgClassName="group-hover:scale-110 transition-transform duration-[2s] ease-out" 
                />
              ) : (
                <div className="size-full bg-zinc-900 flex items-center justify-center p-8 text-center">
                  <p className="text-sm font-bold text-white/80 line-clamp-4 leading-relaxed tracking-tight">"{status.text_content}"</p>
                </div>
              )}

              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80" />

              {/* Status Info */}
              <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end text-white z-10">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold tracking-tight opacity-40 uppercase">Engagement</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Eye className="size-4 text-[var(--accent)]" />
                      <span className="text-xl md:text-2xl font-bold tabular-nums tracking-tighter">{status.views_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="size-4 text-rose-500 fill-rose-500" />
                      <span className="text-xl md:text-2xl font-bold tabular-nums tracking-tighter">{status.likes_count || 0}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                   <div className="bg-white/10 backdrop-blur-xl border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold tracking-tight flex items-center gap-2 shadow-xl uppercase">
                      <Clock className={`size-3 ${timeLeft < 5 ? 'text-rose-400 animate-pulse' : 'text-[var(--accent)]'}`} />
                      {timeLeft < 24 ? `${timeLeft}h` : `${Math.ceil(timeLeft / 24)}d`}
                   </div>
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleDelete(status._id); }}
                     disabled={deletingId === status._id}
                     className="size-9 rounded-full bg-rose-500/20 border border-red-500/30 flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                   >
                     {deletingId === status._id ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                   </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Archive History */}
      <section className="space-y-8 pt-12 px-4 md:px-0">
        <div className="flex items-center gap-6">
          <h3 className="text-xl md:text-2xl font-bold tracking-tighter text-[var(--text-primary)]">Archive <span className="opacity-30">History</span></h3>
          <div className="h-px flex-grow bg-[var(--glass-border)] opacity-30" />
        </div>

        <div className="space-y-4">
          {statuses.filter(s => new Date(s.expires_at) <= new Date()).length === 0 ? (
            <div className="py-12 text-center bg-[var(--bg-secondary)]/30 rounded-[2rem] border border-dashed border-[var(--glass-border)]">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">No archival data</p>
            </div>
          ) : (
            statuses.filter(s => new Date(s.expires_at) <= new Date()).map(status => (
              <div key={status._id} className="bg-[var(--bg-primary)] p-4 rounded-3xl border border-[var(--glass-border)] flex flex-col md:flex-row md:items-center justify-between shadow-sm hover:shadow-xl transition-all duration-500 group gap-4 md:gap-0">
                <div className="flex items-center gap-4">
                  <div className="size-16 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] shrink-0 shadow-inner border border-[var(--glass-border)]">
                    {status.content_url ? (
                      <MediaThumbnail src={status.content_url} className="size-full" imgClassName="opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" alt="" />
                    ) : (
                      <div className="size-full flex items-center justify-center bg-zinc-900 opacity-20"><Activity className="size-5" /></div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-[var(--text-primary)] tracking-tight truncate max-w-[200px]">
                      {status.text_content ? status.text_content : `Story ${status._id.slice(-6)}`}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-tight">
                      <Calendar className="size-3" />
                      <span>{new Date(status.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 md:gap-10 px-2 md:pr-4">
                  <div className="text-center md:text-right">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-widest mb-1 opacity-20 uppercase">Views</p>
                    <p className="text-base font-bold tabular-nums tracking-tighter">{status.views_count || 0}</p>
                  </div>
                  <div className="text-center md:text-right">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-widest mb-1 opacity-20 uppercase">Likes</p>
                    <p className="text-base font-bold tabular-nums tracking-tighter text-rose-500">{status.likes_count || 0}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setReshareTarget(status); setShowCreator(true); }}
                      className="size-9 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all active:scale-90"
                    >
                      <RotateCcw className="size-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(status._id)}
                      className="size-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Creator Modal */}
      {showCreator && (
        <StatusCreator 
          onClose={() => { setShowCreator(false); setReshareTarget(null); }} 
          onStatusCreated={() => { fetchMyStatuses(); setShowCreator(false); setReshareTarget(null); }}
          initialData={reshareTarget}
        />
      )}
    </div>
  );
}
