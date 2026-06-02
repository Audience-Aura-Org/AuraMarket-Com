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
  Sparkles,
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
  const [loading, setLoading] = useState(true);
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
  const leadingStory = activeStatuses[0] || statuses[0] || null;

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
    <main className="mx-auto w-full max-w-7xl space-y-5 pb-28 font-[Poppins] text-[var(--text-primary)] sm:space-y-6 sm:pb-10">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--glass-border)] bg-zinc-950 text-white shadow-xl shadow-black/10">
        <div className="grid min-h-[500px] lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="relative flex flex-col justify-between gap-10 p-5 sm:p-8 lg:p-10">
            <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_12%_15%,rgba(242,13,242,0.28),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(20,184,166,0.2),transparent_28%)]" />
            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-white/75 backdrop-blur">
                <Megaphone className="size-3.5 text-[var(--accent)]" />
                Story Launchpad
              </div>
              <div className="max-w-3xl space-y-4">
                <h1 className="max-w-2xl text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
                  Make your next drop impossible to miss.
                </h1>
                <p className="max-w-xl text-sm font-medium leading-6 text-white/68 sm:text-base">
                  Publish a sharp update, connect it to a product, and watch the response without digging through the dashboard.
                </p>
              </div>
            </div>

            <div className="relative z-10 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Live', value: activeStatuses.length, icon: Activity },
                { label: 'Views', value: totalViews, icon: Eye },
                { label: 'Likes', value: totalLikes, icon: Heart },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <Icon className={`mb-5 size-5 ${label === 'Likes' ? 'fill-rose-400 text-rose-400' : 'text-[var(--accent)]'}`} />
                  <p className="text-3xl font-black leading-none tracking-tight">{value}</p>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/48">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative border-t border-white/10 bg-white/[0.04] p-5 sm:p-8 lg:border-l lg:border-t-0">
            <div className="mx-auto flex max-w-[310px] flex-col gap-4">
              <div className="rounded-[2.25rem] border border-white/12 bg-black p-3 shadow-2xl shadow-black/30">
                <div className="relative aspect-[9/16] overflow-hidden rounded-[1.75rem] bg-zinc-900">
                  {leadingStory?.content_url ? (
                    <MediaThumbnail src={leadingStory.content_url} className="size-full" imgClassName="opacity-85" alt="" />
                  ) : (
                    <div className="flex size-full items-center justify-center p-8 text-center">
                      <Sparkles className="absolute top-5 size-5 text-[var(--accent)]" />
                      <p className="text-lg font-black leading-7 text-white/85">Your next store moment appears here.</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute left-4 right-4 top-4 flex gap-1.5">
                    {[0, 1, 2, 3].map((item) => (
                      <span key={item} className={`h-1 flex-1 rounded-full ${item === 0 ? 'bg-white' : 'bg-white/25'}`} />
                    ))}
                  </div>
                  <div className="absolute inset-x-4 bottom-4 space-y-3">
                    <p className="line-clamp-3 text-xl font-black leading-6 text-white">
                      {leadingStory ? storyLabel(leadingStory) : 'Launch a product drop, restock, or promo.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => openCreator()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-zinc-950 transition-transform active:scale-95"
                    >
                      <Plus className="size-4" />
                      Create Story
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {launchOptions.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => openCreator()}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-2 py-3 text-[11px] font-black text-white/82 transition-all hover:bg-white/14 active:scale-95"
                  >
                    <Icon className="size-4 text-[var(--accent)]" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <Wand2 className="size-5" />
              </div>
              <div>
                <p className="text-base font-black">Creator dock</p>
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Pick a format and publish.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              {launchOptions.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => openCreator()}
                  className="flex items-center justify-between rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 px-4 py-3 text-sm font-black transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--accent)]/5 active:scale-[0.98]"
                >
                  <span className="inline-flex items-center gap-3">
                    <Icon className="size-4 text-[var(--accent)]" />
                    {label} update
                  </span>
                  <Plus className="size-4 text-[var(--text-secondary)]" />
                </button>
              ))}
            </div>
            <Link
              href="/vendor/products/add"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--text-primary)] px-4 py-3 text-xs font-black text-[var(--bg-primary)] transition-transform active:scale-95"
            >
              <ShoppingBag className="size-4" />
              Add product link
            </Link>
          </div>

          <div className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-black">Pulse</p>
              <BarChart3 className="size-4 text-[var(--accent)]" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-secondary)]/55 px-4 py-3">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Live shelf</span>
                <span className="text-sm font-black">{activeStatuses.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-secondary)]/55 px-4 py-3">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Archive</span>
                <span className="text-sm font-black">{archivedStatuses.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-secondary)]/55 px-4 py-3">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Engagement</span>
                <span className="text-sm font-black">{totalViews + totalLikes}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <section className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Live shelf</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">Stories shoppers can open now</h2>
              </div>
              <button
                onClick={fetchMyStatuses}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)]/65 px-4 py-2.5 text-xs font-black text-[var(--text-secondary)] transition-all hover:text-[var(--accent)] active:scale-95"
              >
                <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-72 animate-pulse rounded-[1.75rem] bg-[var(--bg-secondary)]" />
                ))}
              </div>
            ) : activeStatuses.length === 0 ? (
              <div className="mt-5 rounded-[1.75rem] border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/35 p-8 text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <ImagePlus className="size-6" />
                </div>
                <p className="text-lg font-black">Nothing live yet</p>
                <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-[var(--text-secondary)]">
                  Launch a quick product moment and it will appear in this shelf.
                </p>
                <button
                  onClick={() => openCreator()}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-xs font-black text-white shadow-lg shadow-[var(--accent)]/20 active:scale-95"
                >
                  <Plus className="size-4" />
                  Launch Story
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {activeStatuses.map((status) => (
                  <article key={status._id} className="overflow-hidden rounded-[1.75rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/35">
                    <div className="relative h-72 overflow-hidden bg-zinc-950">
                      {status.type === 'image' || status.type === 'video' ? (
                        <MediaThumbnail
                          src={status.content_url}
                          className="size-full"
                          imgClassName="transition-transform duration-[1600ms] hover:scale-105"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center p-7 text-center">
                          <p className="line-clamp-5 text-xl font-black leading-7 text-white">{status.text_content}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                      <div className="absolute left-3 top-3 rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur">
                        {getTimeLeft(status.expires_at)} left
                      </div>
                      <button
                        onClick={() => handleDelete(status._id)}
                        disabled={deletingId === status._id}
                        className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/12 bg-black/35 text-white backdrop-blur transition-all hover:bg-rose-500 active:scale-95"
                        aria-label="Delete story"
                      >
                        {deletingId === status._id ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </button>
                      <div className="absolute inset-x-4 bottom-4">
                        <p className="line-clamp-2 text-lg font-black leading-6 text-white">{storyLabel(status)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-[var(--glass-border)]">
                      <div className="flex items-center justify-center gap-2 p-4">
                        <Eye className="size-4 text-emerald-500" />
                        <span className="text-sm font-black">{status.views_count || 0}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">views</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 p-4">
                        <Heart className="size-4 fill-rose-500 text-rose-500" />
                        <span className="text-sm font-black">{status.likes_count || 0}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">likes</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">Replay archive</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">Expired and reusable stories</h2>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--bg-secondary)]/65 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                <Calendar className="size-3.5 text-[var(--accent)]" />
                {archivedStatuses.length} saved
              </span>
            </div>

            {archivedStatuses.length === 0 ? (
              <div className="mt-5 rounded-[1.75rem] border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 py-10 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-70">Archive will build after stories expire</p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {archivedStatuses.map((status) => (
                  <div key={status._id} className="grid gap-4 rounded-[1.5rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/28 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="size-16 shrink-0 overflow-hidden rounded-2xl bg-zinc-950">
                        {status.content_url ? (
                          <MediaThumbnail src={status.content_url} className="size-full" imgClassName="opacity-60 grayscale" alt="" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-white/50">
                            <Activity className="size-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{storyLabel(status)}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-[var(--text-secondary)]">
                          <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" />{formatDate(status.expires_at)}</span>
                          <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5 text-emerald-500" />{status.views_count || 0}</span>
                          <span className="inline-flex items-center gap-1.5"><Heart className="size-3.5 fill-rose-500 text-rose-500" />{status.likes_count || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
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
        </div>
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
