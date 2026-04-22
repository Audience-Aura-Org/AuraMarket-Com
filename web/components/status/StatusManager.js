"use client";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Eye, Heart, ShoppingBag, 
  RefreshCw, Activity, Calendar, AlertCircle
} from 'lucide-react';
import api from '@/services/api';
import StatusCreator from './StatusCreator';

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
    <div className="space-y-8">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-5 md:px-7 md:py-6 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-2xl md:rounded-3xl shadow-sm">
        {/* Left: icon + text */}
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/15 shrink-0">
            <Activity className="size-5 md:size-6 text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                My Stories
              </h3>
              {statuses.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold">
                  <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                  {statuses.length} active
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 opacity-60">
              Manage and track your published stories
            </p>
          </div>
        </div>

        {/* Right: CTA */}
        <button
          onClick={() => setShowCreator(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 md:px-6 md:py-3 bg-[var(--accent)] text-white rounded-xl text-xs md:text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20 shrink-0"
        >
          <Plus className="size-3.5" />
          Post Story
        </button>
      </div>

      {/* Grid of Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="size-8 text-[var(--accent)] animate-spin" />
        </div>
      ) : statuses.length === 0 ? (
        <div className="p-20 text-center bg-[var(--bg-secondary)]/20 border border-dashed border-[var(--glass-border)] rounded-[3rem]">
           <AlertCircle className="size-12 text-[var(--text-secondary)]/20 mx-auto mb-4" />
           <p className="text-xs font-black uppercase tracking-widest opacity-30">No Active Stories Found</p>
           <button onClick={() => setShowCreator(true)} className="mt-4 text-[10px] font-black text-[var(--accent)] hover:underline">Launch your first story →</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statuses.map(status => (
            <div key={status._id} className="group glass-panel rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden hover:shadow-2xl transition-all duration-500">
              <div className="relative aspect-video">
                {status.type === 'image' || status.type === 'video' ? (
                  <img src={status.content_url} className="size-full object-cover group-hover:scale-105 transition-transform duration-1000" alt="" />
                ) : (
                  <div className="size-full bg-gradient-to-br from-[var(--bg-secondary)] to-[#111] flex items-center justify-center p-6 text-center">
                    <p className="text-sm font-black italic uppercase text-white/40 line-clamp-3">{status.text_content}</p>
                  </div>
                )}
                <div className="absolute top-4 left-4">
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border backdrop-blur-md ${new Date(status.expires_at) > new Date() ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                    {new Date(status.expires_at) > new Date() ? 'Active' : 'Expired'}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4 text-[var(--text-secondary)]">
                      <div className="flex items-center gap-1.5" title="Total Views">
                        <Eye className="size-3.5 text-[var(--accent)]" />
                        <span className="text-[11px] font-black">{status.views_count || status.viewer_ids?.length || 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Total Hearts">
                        <Heart className="size-3.5 text-red-500 fill-current" />
                        <span className="text-[11px] font-black">{status.likes_count || status.reactions?.length || 0}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <Calendar className="size-3 text-[var(--text-secondary)] opacity-40" />
                      <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">{new Date(status.createdAt).toLocaleDateString()}</span>
                   </div>
                </div>

                {status.linked_product && (
                  <div className="p-3 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--glass-border)] flex items-center gap-3">
                    <ShoppingBag className="size-4 text-[var(--accent)] shrink-0" />
                    <p className="text-[10px] font-bold truncate opacity-60">Linked to: {status.linked_product.name || 'Product'}</p>
                  </div>
                )}

                {(status.views_count > 5 || status.likes_count > 0) && (
                   <div className="px-4 py-3 rounded-2xl bg-[var(--accent)]/5 border border-[var(--accent)]/10">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--accent)] flex items-center gap-2">
                        <Activity className="size-3" /> Performance Feedback
                      </p>
                      <p className="text-[10px] font-bold text-[var(--text-primary)] mt-1">
                        {status.likes_count > (status.views_count * 0.1) 
                          ? "🔥 High conversion! This story is resonating well." 
                          : "⚡ Gaining traction. Post more similar content."}
                      </p>
                   </div>
                )}

                <button 
                  onClick={() => handleDelete(status._id)}
                  disabled={deletingId === status._id}
                  className="w-full h-11 rounded-xl bg-red-500/5 hover:bg-red-500 hover:text-white border border-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  {deletingId === status._id ? <RefreshCw className="size-4 animate-spin" /> : <><Trash2 className="size-4" /> Terminate Story</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
