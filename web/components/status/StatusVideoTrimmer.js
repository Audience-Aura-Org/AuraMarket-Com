"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Scissors } from 'lucide-react';
import { STATUS_VIDEO_MAX_SECONDS } from '@/constants/statusVideo';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatTime = (seconds = 0) => {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export default function StatusVideoTrimmer({
  previewUrl,
  duration = 0,
  trimStart,
  trimEnd,
  onTrimStartChange,
  onTrimEndChange,
  onEditingChange,
}) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const safeDuration = Math.max(0.1, Number(duration) || STATUS_VIDEO_MAX_SECONDS);
  const selectedLength = Math.max(0.1, trimEnd - trimStart);
  const maxClip = Math.min(STATUS_VIDEO_MAX_SECONDS, safeDuration);

  const startPct = (trimStart / safeDuration) * 100;
  const endPct = (trimEnd / safeDuration) * 100;

  const atMax = selectedLength >= STATUS_VIDEO_MAX_SECONDS - 0.05;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const onTimeUpdate = () => {
      if (video.currentTime >= trimEnd - 0.05) {
        video.pause();
        video.currentTime = trimStart;
        setPlaying(false);
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [trimStart, trimEnd]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime < trimStart || video.currentTime > trimEnd) {
      video.currentTime = trimStart;
    }
  }, [trimStart, trimEnd, previewUrl]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      setPlaying(false);
      return;
    }
    if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
      video.currentTime = trimStart;
    }
    try {
      await video.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const updateStart = (raw) => {
    const next = clamp(Number(raw) || 0, 0, Math.max(0, safeDuration - 1));
    const maxEnd = Math.min(safeDuration, next + STATUS_VIDEO_MAX_SECONDS);
    const nextEnd = clamp(trimEnd, next + 0.5, maxEnd);
    onTrimStartChange(next);
    onTrimEndChange(nextEnd);
    onEditingChange?.(true);
  };

  const updateEnd = (raw) => {
    const maxEnd = Math.min(safeDuration, trimStart + STATUS_VIDEO_MAX_SECONDS);
    const next = clamp(Number(raw) || maxEnd, trimStart + 0.5, maxEnd);
    onTrimEndChange(next);
    onEditingChange?.(true);
  };

  const timelineLabel = useMemo(
    () => `${formatTime(trimStart)} – ${formatTime(trimEnd)} (${Math.round(selectedLength)}s)`,
    [trimStart, trimEnd, selectedLength]
  );

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
            <Scissors className="size-3.5 text-[var(--accent)]" />
            Trim story video
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">
            WhatsApp-style 9:16 · max {STATUS_VIDEO_MAX_SECONDS}s clip
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${
          atMax ? 'bg-amber-500/15 text-amber-500' : 'bg-[var(--accent)]/10 text-[var(--accent)]'
        }`}>
          {Math.round(selectedLength)}s / {STATUS_VIDEO_MAX_SECONDS}s
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-black">
        <video
          ref={videoRef}
          src={previewUrl}
          className="aspect-[9/16] max-h-[320px] w-full object-cover"
          playsInline
          muted={false}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
        <button
          type="button"
          onClick={togglePlayback}
          className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--text-secondary)]">
          <span>{timelineLabel}</span>
          <span>{formatTime(safeDuration)} total</span>
        </div>

        <div className="relative h-10 rounded-xl bg-[var(--bg-primary)]">
          <div
            className="absolute inset-y-2 rounded-lg bg-[var(--accent)]/20"
            style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
          />
          <div
            className="absolute top-1/2 z-20 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)] shadow"
            style={{ left: `calc(${startPct}% - 8px)` }}
          />
          <div
            className="absolute top-1/2 z-20 size-4 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)] shadow"
            style={{ left: `calc(${endPct}% - 8px)` }}
          />
          <input
            type="range"
            min={0}
            max={Math.floor(safeDuration)}
            step={0.1}
            value={trimStart}
            onChange={(e) => updateStart(e.target.value)}
            className="absolute inset-0 z-30 h-full w-full cursor-pointer opacity-0"
            aria-label="Trim start"
          />
          <input
            type="range"
            min={0}
            max={Math.floor(safeDuration)}
            step={0.1}
            value={trimEnd}
            onChange={(e) => updateEnd(e.target.value)}
            className="absolute inset-0 z-40 h-full w-full cursor-pointer opacity-0"
            aria-label="Trim end"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Start</span>
            <input
              type="number"
              min={0}
              max={Math.max(0, safeDuration - 0.5)}
              step={0.1}
              value={Number(trimStart.toFixed(1))}
              onChange={(e) => updateStart(e.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[16px] font-semibold outline-none focus:border-[var(--accent)] md:text-[12px]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-semibold text-[var(--text-secondary)]">End</span>
            <input
              type="number"
              min={trimStart + 0.5}
              max={Math.min(safeDuration, trimStart + STATUS_VIDEO_MAX_SECONDS)}
              step={0.1}
              value={Number(trimEnd.toFixed(1))}
              onChange={(e) => updateEnd(e.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[16px] font-semibold outline-none focus:border-[var(--accent)] md:text-[12px]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
