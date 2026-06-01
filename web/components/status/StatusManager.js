"use client";
import { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Eye, Heart,
  RefreshCw, Activity, Calendar, Clock, RotateCcw,
  ShoppingBag, ImagePlus, BarChart3, TimerReset, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import socketService from '@/services/socket';
import StatusCreator from './StatusCreator';
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
  const now = new Date();
  const activeStatuses = statuses.filter(s => new Date(s.expires_at) > now);
  const archivedStatuses = statuses.filter(s => new Date(s.expires_at) <= now);
  const totalViews = statuses.reduce((sum, status) => sum + Number(status.views_count || 0), 0);
  const totalLikes = statuses.reduce((sum, status) => sum + Number(status.likes_count || 0), 0);

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
    <div className="space-y-6 animate-in fade-in duration-700 pb-28 sm:space-y-8 sm:pb-10">
      <section className="overflow-hidden rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/90 p-4 shadow-sm md:rounded-[2rem] md:p-8">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="flex flex-col justify-between gap-5 sm:gap-8">
            <div className="space-y-4 sm:space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)]/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                <Sparkles className="size-3.5" />
                Aura Stories
              </div>
              <div className="space-y-3">
                <h2 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:text-4xl md:text-5xl">
                  Share quick updates shoppers can tap through.
                </h2>
                <p className="max-w-2xl text-sm font-medium leading-6 text-[var(--text-secondary)] md:text-base">
                  Post product drops, behind-the-scenes moments, restocks, and short promos. Stories stay live for 24 hours, then move into your archive.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-[1.25rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/45 p-3 sm:p-4">
                <div className="mb-2 flex size-8 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] sm:mb-3 sm:size-9">
                  <Activity className="size-4" />
                </div>
                <p className="text-xl font-bold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-2xl">{activeStatuses.length}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Live</p>
              </div>
              <div className="rounded-[1.25rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/45 p-3 sm:p-4">
                <div className="mb-2 flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 sm:mb-3 sm:size-9">
                  <Eye className="size-4" />
                </div>
                <p className="text-xl font-bold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-2xl">{totalViews}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Views</p>
              </div>
              <div className="rounded-[1.25rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/45 p-3 sm:p-4">
                <div className="mb-2 flex size-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 sm:mb-3 sm:size-9">
                  <Heart className="size-4 fill-current" />
                </div>
                <p className="text-xl font-bold tabular-nums tracking-tight text-[var(--text-primary)] sm:text-2xl">{totalLikes}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Likes</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { setReshareTarget(null); setShowCreator(true); }}
            className="group flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-[var(--accent)]/25 bg-[var(--accent)] text-left text-white shadow-xl shadow-[var(--accent)]/20 transition-all hover:-translate-y-1 hover:shadow-2xl active:scale-[0.99] sm:min-h-[280px] md:rounded-[2rem]"
          >
            <div className="flex items-start justify-between gap-4 p-6">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/20">
                <ImagePlus className="size-7" />
              </div>
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ring-1 ring-white/20">New</span>
            </div>
            <div className="space-y-4 p-6 pt-0">
              <div>
                <p className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">Create a story</p>
                <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-white/75">
                  Add a photo, video, or text update and link it to a product when it helps shoppers act faster.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[var(--accent)] shadow-lg transition-transform group-hover:translate-x-1">
                <Plus className="size-4" />
                Start posting
              </div>
            </div>
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-[1.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <TimerReset className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-[var(--text-primary)]">Story checklist</p>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Use clear media, short captions, and link products for faster checkout.</p>
          </div>
        </div>
        <Link 
          href="/vendor/products/add"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/70 px-5 py-3 text-xs font-bold text-[var(--text-primary)] transition-all hover:border-[var(--accent)]/40 active:scale-95"
        >
          <ShoppingBag className="size-4 text-[var(--accent)]" />
          Add Product
        </Link>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Live now</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">Active stories</h3>
          </div>
          <button 
            onClick={fetchMyStatuses}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-2 text-xs font-bold text-[var(--text-secondary)] transition-all hover:text-[var(--accent)] active:scale-95"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map(item => (
              <div key={item} className="aspect-[3/4] animate-pulse rounded-[1.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] sm:aspect-[4/5] sm:rounded-[2rem]" />
            ))}
          </div>
        ) : activeStatuses.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-[var(--glass-border)] bg-[var(--bg-primary)]/60 p-10 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <ImagePlus className="size-6" />
            </div>
            <p className="text-lg font-bold text-[var(--text-primary)]">No live stories yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[var(--text-secondary)]">
              Start with a product highlight, a customer favorite, or a quick update from your store.
            </p>
            <button
              onClick={() => { setReshareTarget(null); setShowCreator(true); }}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-xs font-bold text-white shadow-lg shadow-[var(--accent)]/20 active:scale-95"
            >
              <Plus className="size-4" />
              Create Story
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">

        {/* Active Status Cards */}
        {activeStatuses.map(status => {
          const timeLeft = Math.max(0, Math.floor((new Date(status.expires_at) - new Date()) / (1000 * 60 * 60)));
          return (
            <div key={status._id} className="group relative aspect-[3/4] overflow-hidden rounded-[1.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl sm:aspect-[4/5] sm:rounded-[2rem]">
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
              <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between gap-2 text-white sm:bottom-6 sm:left-6 sm:right-6">
                <div className="space-y-1">
                  <p className="hidden text-[10px] font-bold uppercase tracking-tight opacity-40 sm:block">Engagement</p>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Eye className="size-3.5 text-[var(--accent)] sm:size-4" />
                      <span className="text-base font-bold tabular-nums tracking-tighter sm:text-xl md:text-2xl">{status.views_count || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Heart className="size-3.5 fill-rose-500 text-rose-500 sm:size-4" />
                      <span className="text-base font-bold tabular-nums tracking-tighter sm:text-xl md:text-2xl">{status.likes_count || 0}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                   <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight shadow-xl backdrop-blur-xl sm:gap-2 sm:px-3">
                      <Clock className={`size-3 ${timeLeft < 5 ? 'text-rose-400 animate-pulse' : 'text-[var(--accent)]'}`} />
                      {timeLeft < 24 ? `${timeLeft}h` : `${Math.ceil(timeLeft / 24)}d`}
                   </div>
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleDelete(status._id); }}
                     disabled={deletingId === status._id}
                     className="flex size-8 items-center justify-center rounded-full border border-red-500/30 bg-rose-500/20 text-rose-500 transition-all hover:bg-rose-500 hover:text-white active:scale-90 sm:size-9"
                   >
                     {deletingId === status._id ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                   </button>
                </div>
              </div>
            </div>
          );
        })}
          </div>
        )}
      </section>

      {/* Archive History */}
      <section className="space-y-5 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/45 p-4 md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--accent)]">Past posts</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">Archive history</h3>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            <BarChart3 className="size-3.5 text-[var(--accent)]" />
            {archivedStatuses.length} saved
          </div>
        </div>

        <div className="space-y-4">
          {archivedStatuses.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 py-12 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">No archived stories yet</p>
            </div>
          ) : (
            archivedStatuses.map(status => (
              <div key={status._id} className="group flex flex-col justify-between gap-4 rounded-[1.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm transition-all duration-300 hover:shadow-lg md:flex-row md:items-center md:gap-0">
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
