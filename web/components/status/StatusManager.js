"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  Clock,
  Eye,
  Film,
  Heart,
  ImagePlus,
  Megaphone,
  Plus,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Trash2,
  Type,
  Wand2,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import socketService from '@/services/socket';
import StatusCreator from './StatusCreator';
import MediaThumbnail from '@/components/common/MediaThumbnail';
import { toast } from 'react-hot-toast';

const formatDate = (value) => {
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
  const minutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.ceil(hours / 24)}d`;
};

const storyLabel = (status) => {
  if (status.text_content) return status.text_content;
  if (status.type === 'video') return 'Motion preview';
  if (status.type === 'image') return 'Product spotlight';
  return `Story ${status._id?.slice(-6) || ''}`;
};

export default function StatusManager() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [reshareTarget, setReshareTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const activeStatuses = useMemo(() => {
    const now = new Date();
    return statuses.filter((status) => new Date(status.expires_at) > now);
  }, [statuses]);

  const archivedStatuses = useMemo(() => {
    const now = new Date();
    return statuses.filter((status) => new Date(status.expires_at) <= now);
  }, [statuses]);

  const totalViews = statuses.reduce((sum, status) => sum + Number(status.views_count || 0), 0);
  const totalLikes = statuses.reduce((sum, status) => sum + Number(status.likes_count || 0), 0);
  const fetchMyStatuses = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/statuses/my-statuses');
      if (res.data.success) setStatuses(res.data.data || []);
    } catch (e) {
      console.error('Failed to fetch my statuses:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyStatuses({ silent: true });

    const handleStatusUpdate = (update) => {
      setStatuses((prev) => prev.map((status) => {
        if (status._id?.toString() === update.status_id?.toString()) {
          if (update.type === 'view') return { ...status, views_count: update.count };
          if (update.type === 'like') return { ...status, likes_count: update.count };
        }
        return status;
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
      setStatuses((prev) => prev.filter((status) => status._id !== id));
      toast.success('Story deleted');
    } catch (e) {
      console.error(e);
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const launchOptions = [
    { label: 'Drop', icon: ImagePlus },
    { label: 'Clip', icon: Film },
    { label: 'Note', icon: Type },
  ];

  return (
    <main className="w-full space-y-4 pb-24 font-[Poppins] text-[var(--text-primary)] sm:space-y-5 sm:pb-10">
      <section className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm">
        <div className="bg-[var(--bg-secondary)]/30 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                <Megaphone className="size-3.5 text-[var(--accent)]" />
                Story Center
              </p>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Manage vendor stories</h1>
              <p className="text-xs font-medium text-[var(--text-secondary)]">Post updates, track performance, and quickly reuse top content.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchMyStatuses}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-[11px] font-medium text-[var(--text-secondary)] transition hover:text-[var(--accent)]"
              >
                <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => openCreator()}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-[11px] font-semibold text-white shadow-md shadow-[var(--accent)]/20 active:scale-95"
              >
                <Plus className="size-3.5" />
                New story
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--glass-border)] p-3 sm:p-4">
          <div className="flex w-full items-center divide-x divide-[var(--glass-border)] overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/35">
            {[
              { label: 'Live', value: activeStatuses.length, icon: Activity },
              { label: 'Views', value: totalViews, icon: Eye },
              { label: 'Likes', value: totalLikes, icon: Heart },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex min-w-0 flex-1 items-center justify-center gap-2 px-2 py-3">
                <Icon className={`size-3.5 shrink-0 ${label === 'Likes' ? 'fill-rose-400 text-rose-400' : 'text-[var(--accent)]'}`} />
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
                <span className="text-sm font-semibold leading-none">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--accent)]">Live stories</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">Active now</h2>
              </div>
              <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                {activeStatuses.length} active
              </span>
            </div>

            {activeStatuses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/25 p-7 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <ImagePlus className="size-5" />
                </div>
                <p className="text-sm font-semibold">No active story</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Create one to appear here for the next 24 hours.</p>
                <button
                  onClick={() => openCreator()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[11px] font-semibold text-white shadow-md shadow-[var(--accent)]/20 active:scale-95"
                >
                  <Plus className="size-4" />
                  Create story
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {activeStatuses.map((status) => (
                  <article key={status._id} className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/25">
                    <div className="relative h-60 overflow-hidden bg-zinc-950">
                      {status.type === 'image' || status.type === 'video' ? (
                        <MediaThumbnail src={status.content_url} poster={status.thumbnail_url} className="size-full" imgClassName="transition-transform duration-700 hover:scale-105" />
                      ) : (
                        <div className="flex size-full items-center justify-center p-6 text-center">
                          <p className="line-clamp-5 text-base font-semibold leading-6 text-white">{status.text_content}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                      <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
                        {getTimeLeft(status.expires_at)} left
                      </div>
                      <button
                        onClick={() => handleDelete(status._id)}
                        disabled={deletingId === status._id}
                        className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white transition hover:bg-rose-500"
                        aria-label="Delete story"
                      >
                        {deletingId === status._id ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </button>
                      <div className="absolute inset-x-3 bottom-3">
                        <p className="line-clamp-2 text-sm font-semibold text-white">{storyLabel(status)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-[var(--glass-border)]">
                      <div className="flex items-center justify-center gap-1.5 p-3">
                        <Eye className="size-3.5 text-emerald-500" />
                        <span className="text-xs font-semibold">{status.views_count || 0}</span>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">views</span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 p-3">
                        <Heart className="size-3.5 fill-rose-500 text-rose-500" />
                        <span className="text-xs font-semibold">{status.likes_count || 0}</span>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">likes</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--accent)]">Archive</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">Past stories</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                <Calendar className="size-3" />
                {archivedStatuses.length}
              </span>
            </div>

            {archivedStatuses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/25 py-8 text-center">
                <p className="text-xs font-medium text-[var(--text-secondary)]">No archived stories yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {archivedStatuses.map((status) => (
                  <div key={status._id} className="grid gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-zinc-950">
                        {status.content_url ? (
                          <MediaThumbnail src={status.content_url} poster={status.thumbnail_url} className="size-full" imgClassName="opacity-60 grayscale" alt="" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-white/50">
                            <Activity className="size-4.5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{storyLabel(status)}</p>
                        <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] font-medium text-[var(--text-secondary)]">
                          <span className="inline-flex items-center gap-1"><Clock className="size-3" />{formatDate(status.expires_at)}</span>
                          <span className="inline-flex items-center gap-1"><Eye className="size-3 text-emerald-500" />{status.views_count || 0}</span>
                          <span className="inline-flex items-center gap-1"><Heart className="size-3 fill-rose-500 text-rose-500" />{status.likes_count || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openCreator(status)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)]/10 px-3 py-2 text-[11px] font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
                      >
                        <RotateCcw className="size-3.5" />
                        Repost
                      </button>
                      <button
                        onClick={() => handleDelete(status._id)}
                        className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 transition hover:bg-rose-500 hover:text-white"
                        aria-label="Delete archived story"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <Wand2 className="size-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Quick Create</p>
                <p className="text-[11px] text-[var(--text-secondary)]">Choose your story type.</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {launchOptions.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => openCreator()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]/55 px-3 py-2.5 text-[11px] font-semibold transition hover:border-[var(--accent)]/35 lg:justify-start"
                >
                  <Icon className="size-3.5 text-[var(--accent)]" />
                  {label}
                </button>
              ))}
            </div>
            <Link
              href="/vendor/products/add"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--text-primary)] px-3 py-2.5 text-[11px] font-semibold text-[var(--bg-primary)] transition active:scale-95"
            >
              <ShoppingBag className="size-3.5" />
              Add product link
            </Link>
          </div>

          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Overview</p>
              <BarChart3 className="size-4 text-[var(--accent)]" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-[var(--bg-secondary)]/45 px-3 py-2.5">
                <span className="text-[11px] text-[var(--text-secondary)]">Live</span>
                <span className="text-xs font-semibold">{activeStatuses.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--bg-secondary)]/45 px-3 py-2.5">
                <span className="text-[11px] text-[var(--text-secondary)]">Archive</span>
                <span className="text-xs font-semibold">{archivedStatuses.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--bg-secondary)]/45 px-3 py-2.5">
                <span className="text-[11px] text-[var(--text-secondary)]">Activity</span>
                <span className="text-xs font-semibold">{totalViews + totalLikes}</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {showCreator && (
        <StatusCreator
          onClose={() => { setShowCreator(false); setReshareTarget(null); }}
          onStatusCreated={() => { fetchMyStatuses(); setShowCreator(false); setReshareTarget(null); }}
          initialData={reshareTarget}
        />
      )}
    </main>
  );
}
