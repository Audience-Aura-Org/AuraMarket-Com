"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Eye, Heart, ShoppingBag, 
  RefreshCw, Activity, Calendar, AlertCircle
} from 'lucide-react';
import api from '@/services/api';
import StatusCreator from './StatusCreator';
import BlurUpImage from '@/components/common/BlurUpImage';

/**
 * StatusManager
 * Management interface for vendors to monitor and control their stories.
 * Shows insights (views, likes) and allows deletion.
 */
export default function StatusManager() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
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
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this story?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/statuses/${id}`);
      setStatuses(prev => prev.filter(s => s._id !== id));
    } catch (e) {
      console.error(e);
      alert('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      {/* ── Header Section ────────────────────────────────────────────────── */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="text-[11px] font-black tracking-[0.3em] text-[var(--accent)] uppercase opacity-80">Operational Management</p>
          <h2 className="text-5xl font-black tracking-tighter text-[var(--text-primary)] leading-none">
            Active <span className="opacity-40">Statuses</span>
          </h2>
        </div>
        <button 
          onClick={() => setShowCreator(true)}
          className="bg-[var(--text-primary)] text-[var(--bg-primary)] px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95"
        >
          <Plus className="size-4" />
          Post New Status
        </button>
      </section>

      {/* ── Bento Grid for Statuses ────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {/* Create Status Card */}
        <div 
          onClick={() => setShowCreator(true)}
          className="group cursor-pointer aspect-[4/5] bg-[var(--bg-secondary)]/50 border-2 border-dashed border-[var(--glass-border)] flex flex-col items-center justify-center gap-6 rounded-[2.5rem] hover:bg-[var(--bg-secondary)] hover:border-[var(--accent)]/30 transition-all duration-500"
        >
          <div className="size-16 rounded-full border border-[var(--glass-border)] flex items-center justify-center group-hover:scale-110 group-hover:border-[var(--accent)] transition-all duration-500 bg-[var(--bg-primary)]/50">
            <Plus className="size-8 text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors" />
          </div>
          <span className="text-[10px] font-black tracking-[0.25em] text-[var(--text-primary)] uppercase opacity-60 group-hover:opacity-100 transition-opacity">CREATE STATUS</span>
        </div>

        {/* Active Status Cards */}
        {statuses.filter(s => new Date(s.expires_at) > new Date()).map(status => {
          const timeLeft = Math.max(0, Math.floor((new Date(status.expires_at) - new Date()) / (1000 * 60 * 60)));
          return (
            <div key={status._id} className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden group shadow-[0_20px_50px_-20px_rgba(0,0,0,0.1)] bg-[var(--bg-primary)] border border-[var(--glass-border)]">
              {/* Media Content */}
              {status.type === 'image' || status.type === 'video' ? (
                <BlurUpImage 
                  src={status.content_url} 
                  className="size-full"
                  imgClassName="group-hover:scale-110 transition-transform duration-[2s] ease-out" 
                />
              ) : (
                <div className="size-full bg-gradient-to-br from-[#1c1b1b] to-[#000] flex items-center justify-center p-8 text-center">
                  <p className="text-base font-medium italic text-white/80 line-clamp-4 leading-relaxed">{status.text_content}</p>
                </div>
              )}

              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />

              {/* Status Info */}
              <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end text-white z-10">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Engagement</p>
                  <div className="flex items-center gap-2.5">
                    <Eye className="size-4 text-[var(--accent)]" />
                    <span className="text-2xl font-black tabular-nums tracking-tight">{status.views_count || 0}</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                   <div className="bg-white/10 backdrop-blur-xl border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-black tracking-tight uppercase flex items-center gap-2 shadow-xl">
                      <span className={`size-1.5 rounded-full ${timeLeft < 5 ? 'bg-red-500 animate-pulse' : 'bg-[var(--accent)]'}`} />
                      {timeLeft}h left
                   </div>
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleDelete(status._id); }}
                     disabled={deletingId === status._id}
                     className="size-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                   >
                     {deletingId === status._id ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                   </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Status History Section ────────────────────────────────────────── */}
      <section className="space-y-10 pt-16">
        <div className="flex items-center gap-6">
          <h3 className="text-2xl font-black tracking-tighter text-[var(--text-primary)]">Archive <span className="opacity-30">History</span></h3>
          <div className="h-px flex-grow bg-[var(--glass-border)] opacity-30" />
        </div>

        <div className="space-y-5">
          {statuses.filter(s => new Date(s.expires_at) <= new Date()).length === 0 ? (
            <div className="py-12 text-center bg-[var(--bg-secondary)]/30 rounded-[2rem] border border-dashed border-[var(--glass-border)]">
              <p className="text-xs font-bold text-[var(--text-secondary)] opacity-50 uppercase tracking-widest">No archival data available</p>
            </div>
          ) : (
            statuses.filter(s => new Date(s.expires_at) <= new Date()).map(status => (
              <div key={status._id} className="bg-[var(--bg-primary)] p-5 rounded-[2rem] border border-[var(--glass-border)] flex items-center justify-between shadow-sm hover:shadow-xl transition-all duration-500 group">
                <div className="flex items-center gap-6">
                  <div className="size-20 rounded-2xl overflow-hidden bg-[var(--bg-secondary)] shrink-0 shadow-inner">
                    {status.content_url ? (
                      <img src={status.content_url} className="size-full object-cover opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" alt="" />
                    ) : (
                      <div className="size-full flex items-center justify-center bg-zinc-900 opacity-20"><Activity className="size-6" /></div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-black text-base text-[var(--text-primary)] tracking-tight uppercase leading-tight">
                      {status.text_content ? (status.text_content.slice(0, 30) + '...') : `Story ${status._id.slice(-6)}`}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)] opacity-60">
                      <Calendar className="size-3" />
                      <span>Expired {new Date(status.expires_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-12 items-center pr-4">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1 opacity-40">Total Reach</p>
                    <p className="text-lg font-black tabular-nums tracking-tighter">{status.views_count || 0}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1 opacity-40">Lifespan</p>
                    <p className="text-lg font-black tabular-nums tracking-tighter">24h</p>
                  </div>
                  <button 
                    onClick={() => handleDelete(status._id)}
                    className="size-10 rounded-full bg-red-500/5 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Creator Modal */}
      {showCreator && (
        <StatusCreator 
          onClose={() => setShowCreator(false)} 
          onStatusCreated={() => { fetchMyStatuses(); setShowCreator(false); }} 
        />
      )}
    </div>
  );
}
