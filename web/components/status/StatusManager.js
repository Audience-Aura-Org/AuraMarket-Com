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

const formatStoryDate = (value) => {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Archived';
  }
};

const getTimeLeft = (expiresAt) => {
  const diffMs = new Date(expiresAt) - new Date();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) return 'Now';
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.ceil(diffHours / 24)}d`;
};

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

  const openCreator = (status = null) => {
    setReshareTarget(status);
    setShowCreator(true);
  };

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

  const statCards = [
    { label: 'Live', value: activeStatuses.length, icon: Activity, tone: 'text-[var(--accent)] bg-[var(--accent)]/10' },
    { label: 'Views', value: totalViews, icon: Eye, tone: 'text-emerald-500 bg-emerald-500/10' },
    { label: 'Likes', value: totalLikes, icon: Heart, tone: 'text-rose-500 bg-rose-500/10' },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-28 font-[Poppins] sm:space-y-6 sm:pb-10">
      <section className="overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="relative min-h-[360px] overflow-hidden bg-[color-mix(in_srgb,var(--bg-primary)_82%,var(--accent)_18%)] p-5 sm:p-7 lg:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/60 to-transparent" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/20 bg-[var(--bg-primary)]/75 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)] shadow-sm">
                  <Sparkles className="size-3.5" />
                  Story Studio
                </div>
                <div className="max-w-2xl space-y-3">
                  <h2 className="text-3xl font-black leading-tight tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-5xl">
                    Turn quick moments into store traffic.
                  </h2>
                  <p className="max-w-xl text-sm font-medium leading-6 text-[var(--text-secondary)] sm:text-[15px]">
                    Share drops, restocks, behind-the-scenes clips, and product links shoppers can act on before the story expires.
                  </p>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3">
                {statCards.map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/78 p-3 shadow-sm backdrop-blur">
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${tone}`}>
                      <Icon className={`size-4 ${label === 'Likes' ? 'fill-current' : ''}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-black leading-none tracking-tight text-[var(--text-primary)]">{value}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
            <button
              type="button"
              onClick={() => openCreator()}
              className="group flex w-full flex-col gap-8 rounded-3xl border border-[var(--accent)]/25 bg-[var(--accent)] p-5 text-left text-white shadow-xl shadow-[var(--accent)]/20 transition-all hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                  <ImagePlus className="size-7" />
                </div>
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ring-1 ring-white/20">New</span>
              </div>
              <div className="space-y-3">
                <p className="text-2xl font-black leading-tight tracking-tight">Create story</p>
                <p className="text-sm font-medium leading-6 text-white/78">
                  Add media or text, attach a product, and publish a shopper-ready update in seconds.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-[var(--accent)] shadow-lg transition-transform group-hover:translate-x-1">
                <Plus className="size-4" />
                Start posting
              </span>
            </button>

            <div className="mt-4 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/55 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <TimerReset className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-[var(--text-primary)]">Post flow</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-secondary)]">
                    Clear media, short caption, product link when it helps checkout.
                  </p>
                </div>
              </div>
              <Link
                href="/vendor/products/add"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3 text-xs font-black text-[var(--text-primary)] transition-all hover:border-[var(--accent)]/40 active:scale-95"
              >
                <ShoppingBag className="size-4 text-[var(--accent)]" />
                Add Product
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">Live board</p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">Active stories</h3>
          </div>
          <button
            onClick={fetchMyStatuses}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)]/70 px-4 py-2.5 text-xs font-black text-[var(--text-secondary)] transition-all hover:text-[var(--accent)] active:scale-95"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map(item => (
              <div key={item} className="aspect-[4/5] animate-pulse rounded-3xl bg-[var(--bg-secondary)]" />
            ))}
          </div>
        ) : activeStatuses.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/35 px-5 py-12 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <ImagePlus className="size-6" />
            </div>
            <p className="text-lg font-black text-[var(--text-primary)]">No live stories yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[var(--text-secondary)]">
              Start with a best seller, a restock, or a short store update.
            </p>
            <button
              onClick={() => openCreator()}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-xs font-black text-white shadow-lg shadow-[var(--accent)]/20 active:scale-95"
            >
              <Plus className="size-4" />
              Create Story
            </button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeStatuses.map(status => (
              <article key={status._id} className="group overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl">
                <div className="relative aspect-[4/5] overflow-hidden bg-zinc-950">
                  {status.type === 'image' || status.type === 'video' ? (
                    <MediaThumbnail
                      src={status.content_url}
                      className="size-full"
                      imgClassName="transition-transform duration-[1800ms] ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center p-7 text-center">
                      <p className="line-clamp-5 text-base font-black leading-6 text-white">{status.text_content}</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/25 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur">
                    <Clock className="size-3 text-[var(--accent)]" />
                    {getTimeLeft(status.expires_at)}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(status._id); }}
                    disabled={deletingId === status._id}
                    className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white backdrop-blur transition-all hover:bg-rose-500 active:scale-90"
                    aria-label="Delete story"
                  >
                    {deletingId === status._id ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </button>
                  <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-white backdrop-blur">
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-5">
                      {status.text_content || 'Media story'}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black">
                        <Eye className="size-4 text-emerald-400" />
                        {status.views_count || 0}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-black">
                        <Heart className="size-4 fill-rose-400 text-rose-400" />
                        {status.likes_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--accent)]">Archive</p>
            <h3 className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">Past stories</h3>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)]/65 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            <BarChart3 className="size-3.5 text-[var(--accent)]" />
            {archivedStatuses.length} saved
          </div>
        </div>

        {archivedStatuses.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 py-12 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60">No archived stories yet</p>
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--glass-border)]">
            {archivedStatuses.map((status, index) => (
              <div key={status._id} className={`grid gap-4 bg-[var(--bg-primary)] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${index ? 'border-t border-[var(--glass-border)]' : ''}`}>
                <div className="flex min-w-0 items-center gap-4">
                  <div className="size-16 shrink-0 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                    {status.content_url ? (
                      <MediaThumbnail src={status.content_url} className="size-full" imgClassName="opacity-55 grayscale transition-all duration-500 group-hover:opacity-100" alt="" />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-zinc-900 text-white/40">
                        <Activity className="size-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--text-primary)]">
                      {status.text_content || `Story ${status._id.slice(-6)}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-bold text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        {formatStoryDate(status.expires_at)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="size-3.5 text-emerald-500" />
                        {status.views_count || 0} views
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Heart className="size-3.5 fill-rose-500 text-rose-500" />
                        {status.likes_count || 0} likes
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => openCreator(status)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)]/10 px-4 py-2.5 text-xs font-black text-[var(--accent)] transition-all hover:bg-[var(--accent)] hover:text-white active:scale-95"
                  >
                    <RotateCcw className="size-4" />
                    Repost
                  </button>
                  <button
                    onClick={() => handleDelete(status._id)}
                    className="flex size-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 transition-all hover:bg-rose-500 hover:text-white active:scale-95"
                    aria-label="Delete archived story"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
