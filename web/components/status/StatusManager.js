"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  BarChart3,
  Clock,
  Eye,
  Film,
  Heart,
  ImagePlus,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trash2,
  TrendingUp,
  Type,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import socketService from '@/services/socket';
import StatusCreator from './StatusCreator';
import MediaThumbnail from '@/components/common/MediaThumbnail';
import { toast } from 'react-hot-toast';

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return 'Archived'; }
};

const getTimeLeft = (expiresAt) => {
  const diffMs = new Date(expiresAt) - new Date();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.ceil(hours / 24)}d`;
};

const timeLeftColorClass = (expiresAt) => {
  const hours = (new Date(expiresAt) - Date.now()) / 3600000;
  if (hours < 2) return 'text-rose-400';
  if (hours < 12) return 'text-amber-400';
  return 'text-emerald-400';
};

const signalLabel = (status) => {
  if (status.text_content) return status.text_content;
  if (status.type === 'video') return 'Video signal';
  if (status.type === 'image') return 'Image signal';
  return `Signal #${status._id?.slice(-5) || ''}`;
};

const TYPE_META = {
  image: { label: 'Image', Icon: ImagePlus, color: 'text-blue-400' },
  video: { label: 'Video', Icon: Film,       color: 'text-violet-400' },
  text:  { label: 'Text',  Icon: Type,       color: 'text-amber-400' },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function StatusManager() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [reshareTarget, setReshareTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const now = new Date();
  const activeStatuses   = useMemo(() => statuses.filter((s) => new Date(s.expires_at) > now), [statuses]);
  const archivedStatuses = useMemo(() => statuses.filter((s) => new Date(s.expires_at) <= now), [statuses]);

  const totalViews = statuses.reduce((sum, s) => sum + Number(s.views_count || 0), 0);
  const totalLikes = statuses.reduce((sum, s) => sum + Number(s.likes_count || 0), 0);
  const engagementRate = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : '—';

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchMyStatuses = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/statuses/my-statuses');
      if (res.data.success) setStatuses(res.data.data || []);
    } catch (e) {
      console.error('[StatusManager] fetch failed:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyStatuses({ silent: true });

    const handleStatusUpdate = (update) => {
      setStatuses((prev) =>
        prev.map((s) => {
          if (s._id?.toString() !== update.status_id?.toString()) return s;
          if (update.type === 'view') return { ...s, views_count: update.count };
          if (update.type === 'like') return { ...s, likes_count: update.count };
          return s;
        })
      );
    };

    socketService.on('status_update', handleStatusUpdate);
    return () => socketService.off('status_update', handleStatusUpdate);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const openCreator = (status = null) => {
    setReshareTarget(status);
    setShowCreator(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this signal?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/statuses/${id}`);
      setStatuses((prev) => prev.filter((s) => s._id !== id));
      toast.success('Signal deleted');
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] font-[Poppins] text-[var(--text-primary)] pb-28 md:pb-12">

      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-14 lg:top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)]">
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)]/30 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0">
              <Radio className="size-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Signal Center</h1>
              <p className="hidden sm:block text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 tracking-[0.12em] uppercase">
                Broadcast · Engage · Grow
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchMyStatuses}
              disabled={loading}
              className="size-9 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all active:scale-95 disabled:opacity-40"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => openCreator()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-[12px] font-bold shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 active:scale-95 transition-all"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">New Signal</span>
              <span className="sm:hidden">Post</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── Stats Row ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Live Signals',   value: activeStatuses.length,        Icon: Activity,   color: 'text-[var(--accent)]',  ring: 'border-[var(--accent)]/20',   bg: 'bg-[var(--accent)]/8' },
            { label: 'Total Views',    value: totalViews.toLocaleString(),   Icon: Eye,        color: 'text-emerald-500',       ring: 'border-emerald-500/20',        bg: 'bg-emerald-500/8' },
            { label: 'Total Likes',    value: totalLikes.toLocaleString(),   Icon: Heart,      color: 'text-rose-500',          ring: 'border-rose-500/20',           bg: 'bg-rose-500/8' },
            { label: 'Engagement',     value: `${engagementRate}%`,          Icon: TrendingUp, color: 'text-amber-500',         ring: 'border-amber-500/20',          bg: 'bg-amber-500/8' },
          ].map(({ label, value, Icon, color, ring, bg }) => (
            <div key={label} className={`rounded-2xl border ${ring} ${bg} p-4 flex items-center gap-3`}>
              <div className={`size-9 rounded-xl ${bg} border ${ring} flex items-center justify-center shrink-0`}>
                <Icon className={`size-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">{label}</p>
                <p className={`text-[15px] font-bold leading-tight mt-0.5 ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main layout: content + sidebar ───────────────────────────────── */}
        <div className="grid xl:grid-cols-3 gap-5">

          {/* ── LEFT: Active + Archive ──────────────────────────────────────── */}
          <div className="xl:col-span-2 space-y-5">

            {/* Active Signals */}
            <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <h2 className="text-sm font-bold tracking-tight">Live Signals</h2>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500">
                    {activeStatuses.length} active
                  </span>
                </div>
                <Link href="/vendor/analytics" className="text-[10px] font-semibold text-[var(--accent)] hover:opacity-70 transition-opacity">
                  Analytics →
                </Link>
              </div>

              <div className="p-4">
                {activeStatuses.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center gap-3">
                    <div className="size-14 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)]">
                      <Radio className="size-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">No live signals</p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Post a signal to reach your followers right now.</p>
                    </div>
                    <button
                      onClick={() => openCreator()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-[12px] font-bold shadow-md shadow-[var(--accent)]/20 active:scale-95 transition-all hover:opacity-90"
                    >
                      <Plus className="size-4" />
                      Post First Signal
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeStatuses.map((status) => {
                      const meta = TYPE_META[status.type] || TYPE_META.image;
                      const tlColor = timeLeftColorClass(status.expires_at);
                      return (
                        <article
                          key={status._id}
                          className="group overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 hover:border-[var(--accent)]/30 transition-all"
                        >
                          {/* Thumbnail */}
                          <div className="relative h-48 overflow-hidden bg-zinc-950 rounded-t-xl">
                            {status.type !== 'text' ? (
                              <MediaThumbnail
                                src={status.content_url}
                                poster={status.thumbnail_url}
                                className="size-full"
                                imgClassName="transition-transform duration-700 group-hover:scale-105 object-cover size-full"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center p-5 text-center bg-gradient-to-br from-[var(--accent)]/15 to-transparent">
                                <p className="line-clamp-5 text-sm font-semibold leading-6 text-white">{status.text_content}</p>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent pointer-events-none" />

                            {/* Top-left badges */}
                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                              <span className={`flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm px-2 py-1 text-[9px] font-bold ${tlColor}`}>
                                <Clock className="size-2.5" />
                                {getTimeLeft(status.expires_at)} left
                              </span>
                              <span className={`flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm px-2 py-1 text-[9px] font-bold ${meta.color}`}>
                                <meta.Icon className="size-2.5" />
                                {meta.label}
                              </span>
                            </div>

                            {/* Delete button */}
                            <button
                              onClick={() => handleDelete(status._id)}
                              disabled={deletingId === status._id}
                              className="absolute top-2.5 right-2.5 size-7 flex items-center justify-center rounded-lg bg-black/55 backdrop-blur-sm text-white/70 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                            >
                              {deletingId === status._id
                                ? <RefreshCw className="size-3 animate-spin" />
                                : <Trash2 className="size-3" />}
                            </button>

                            {/* Caption */}
                            {(status.caption || signalLabel(status)) && (
                              <p className="absolute inset-x-2.5 bottom-2.5 line-clamp-1 text-[11px] font-semibold text-white/90 drop-shadow">
                                {status.caption || signalLabel(status)}
                              </p>
                            )}
                          </div>

                          {/* Metrics bar */}
                          <div className="flex items-stretch divide-x divide-[var(--glass-border)]">
                            <div className="flex flex-1 items-center justify-center gap-1.5 py-2.5">
                              <Eye className="size-3.5 text-emerald-500" />
                              <span className="text-xs font-bold">{(status.views_count || 0).toLocaleString()}</span>
                              <span className="text-[9px] text-[var(--text-secondary)]">views</span>
                            </div>
                            <div className="flex flex-1 items-center justify-center gap-1.5 py-2.5">
                              <Heart className="size-3.5 fill-rose-500 text-rose-500" />
                              <span className="text-xs font-bold">{(status.likes_count || 0).toLocaleString()}</span>
                              <span className="text-[9px] text-[var(--text-secondary)]">likes</span>
                            </div>
                            {status.linked_product && (
                              <div className="flex items-center justify-center gap-1.5 px-3 py-2.5">
                                <ShoppingBag className="size-3.5 text-[var(--accent)]" />
                                <span className="text-[9px] text-[var(--text-secondary)]">product</span>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Archive */}
            <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center gap-2.5">
                <Archive className="size-4 text-[var(--text-secondary)] opacity-50" />
                <h2 className="text-sm font-bold tracking-tight">Archive</h2>
                <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                  {archivedStatuses.length}
                </span>
              </div>

              {archivedStatuses.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[11px] text-[var(--text-secondary)] opacity-50">No archived signals yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--glass-border)]">
                  {archivedStatuses.map((status) => {
                    const meta = TYPE_META[status.type] || TYPE_META.image;
                    return (
                      <div
                        key={status._id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)]/25 transition-colors"
                      >
                        {/* Thumbnail */}
                        <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-zinc-900 border border-[var(--glass-border)]">
                          {status.content_url ? (
                            <MediaThumbnail
                              src={status.content_url}
                              poster={status.thumbnail_url}
                              className="size-full"
                              imgClassName="opacity-45 grayscale object-cover size-full"
                            />
                          ) : (
                            <div className="size-full flex items-center justify-center">
                              <meta.Icon className={`size-4 opacity-35 ${meta.color}`} />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-[12px] font-semibold opacity-65">{signalLabel(status)}</p>
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] opacity-50">
                              <Clock className="size-2.5" />{formatDate(status.expires_at)}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] opacity-50">
                              <Eye className="size-2.5" />{(status.views_count || 0).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] opacity-50">
                              <Heart className="size-2.5" />{(status.likes_count || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => openCreator(status)}
                            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)]/10 px-3 py-1.5 text-[10px] font-bold text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all active:scale-95"
                          >
                            <RotateCcw className="size-3" />
                            <span className="hidden sm:inline">Repost</span>
                          </button>
                          <button
                            onClick={() => handleDelete(status._id)}
                            className="size-8 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ── RIGHT Sidebar ────────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Quick Post */}
            <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="size-4 text-[var(--accent)]" />
                <p className="text-sm font-bold tracking-tight">Quick Post</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'Image', Icon: ImagePlus, color: 'text-blue-400',   bg: 'hover:bg-blue-500/5' },
                  { label: 'Video', Icon: Film,       color: 'text-violet-400', bg: 'hover:bg-violet-500/5' },
                  { label: 'Text',  Icon: Type,       color: 'text-amber-400',  bg: 'hover:bg-amber-500/5' },
                ].map(({ label, Icon, color, bg }) => (
                  <button
                    key={label}
                    onClick={() => openCreator()}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 py-3.5 text-[10px] font-semibold transition-all hover:border-[var(--accent)]/30 active:scale-95 ${bg}`}
                  >
                    <Icon className={`size-4 ${color}`} />
                    {label}
                  </button>
                ))}
              </div>
              <Link
                href="/vendor/products/add"
                className="flex items-center justify-center gap-2 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 py-2.5 text-[11px] font-semibold hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5 transition-all"
              >
                <ShoppingBag className="size-3.5 text-[var(--accent)]" />
                Link a product
              </Link>
            </section>

            {/* Performance */}
            <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="size-4 text-[var(--accent)]" />
                  <p className="text-sm font-bold tracking-tight">Performance</p>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)] opacity-40">All time</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Live signals',  value: activeStatuses.length,   max: Math.max(activeStatuses.length, 1),  color: 'bg-[var(--accent)]' },
                  { label: 'Total signals', value: statuses.length,          max: Math.max(statuses.length, 1),        color: 'bg-indigo-500' },
                  { label: 'Archived',      value: archivedStatuses.length,  max: Math.max(statuses.length, 1),        color: 'bg-zinc-400' },
                ].map(({ label, value, max, color }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
                      <span className="text-[11px] font-bold">{value}</span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full transition-all duration-700`}
                        style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Signal Tips */}
            <section className="rounded-2xl border border-[var(--accent)]/15 bg-gradient-to-br from-[var(--accent)]/8 to-transparent p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-4 text-[var(--accent)]" />
                <p className="text-[11px] font-bold text-[var(--accent)]">Signal Tips</p>
              </div>
              <ul className="space-y-2.5">
                {[
                  'Post during peak hours — 9am–12pm and 7pm–10pm.',
                  'Signals with a linked product get 2× more clicks.',
                  'Video signals average 3× more views than images.',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-[10px] font-medium text-[var(--text-secondary)] leading-[1.5]">
                    <span className="size-4 shrink-0 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-[9px] font-bold mt-px">
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          </div>

        </div>
      </div>

      {/* ── Mobile FAB ───────────────────────────────────────────────────────── */}
      <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] z-50 md:hidden pointer-events-none">
        <button
          onClick={() => openCreator()}
          className="pointer-events-auto flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--accent)] py-3.5 text-[13px] font-bold text-white shadow-2xl shadow-[var(--accent)]/30 active:scale-[0.98] transition-all"
        >
          <Plus className="size-4.5" />
          Post New Signal
        </button>
      </div>

      {/* ── StatusCreator overlay ────────────────────────────────────────────── */}
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
