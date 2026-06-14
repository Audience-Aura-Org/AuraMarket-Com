"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Scissors, FileVideo } from 'lucide-react';
import { STATUS_VIDEO_MAX_SECONDS } from '@/constants/statusVideo';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatTime = (seconds = 0) => {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  const ms = Math.floor((seconds - Math.floor(seconds)) * 100);
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
};

const formatSize = (bytes = 0) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export default function StatusVideoTrimmer({
  previewUrl,
  duration = 0,
  fileSize = 0,
  trimStart,
  trimEnd,
  onTrimStartChange,
  onTrimEndChange,
  onEditingChange,
}) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(trimStart);
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
      setCurrentTime(video.currentTime);
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
      setCurrentTime(trimStart);
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
      setCurrentTime(trimStart);
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
    () => `${formatTime(trimStart)} – ${formatTime(trimEnd)}`,
    [trimStart, trimEnd]
  );

  return (
    <div className="space-y-4 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/70 p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[13px] md:text-[14px] font-bold text-[var(--text-primary)]">
            <Scissors className="size-4 md:size-4.5 text-[var(--accent)]" />
            Trim Story Video
          </p>
          <p className="text-[11px] md:text-[12px] font-medium text-[var(--text-secondary)] mt-0.5">
            WhatsApp-style 9:16 • Max {STATUS_VIDEO_MAX_SECONDS}s clip
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1.5 text-[10px] md:text-[11px] font-bold uppercase tracking-wider ${
            atMax ? 'bg-amber-500/15 text-amber-500' : 'bg-[var(--accent)]/10 text-[var(--accent)]'
          }`}>
            {selectedLength.toFixed(1)}s / {STATUS_VIDEO_MAX_SECONDS}s
          </span>
          <span className="flex items-center gap-1 rounded-full px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] md:text-[11px] font-semibold text-[var(--text-secondary)]">
            <FileVideo className="size-3.5" />
            {formatSize(fileSize)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-black">
          <video
            ref={videoRef}
            src={previewUrl}
            className="aspect-[9/16] max-h-[360px] w-full object-cover"
            playsInline
            muted={false}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
          <button
            type="button"
            onClick={togglePlayback}
            className="absolute bottom-4 right-4 flex size-12 items-center justify-center rounded-full border-2 border-white/25 bg-black/60 text-white backdrop-blur-md hover:bg-black/75 transition-all shadow-lg"
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20">
            <span className="text-[11px] font-mono font-bold text-white">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] md:text-[12px] font-semibold text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <span className="text-[var(--accent)] font-bold">Selection:</span> {timelineLabel}
              </span>
              <span>Total: {formatTime(safeDuration)}</span>
            </div>

            <div className="relative h-12 md:h-14 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
              <div
                className="absolute inset-y-1.5 rounded-xl bg-[var(--accent)]/25"
                style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
              />
              <div
                className="absolute top-1/2 z-20 size-5 md:size-6 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)] shadow-xl cursor-grab active:cursor-grabbing"
                style={{ left: `calc(${startPct}% - 10px)` }}
              />
              <div
                className="absolute top-1/2 z-20 size-5 md:size-6 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)] shadow-xl cursor-grab active:cursor-grabbing"
                style={{ left: `calc(${endPct}% - 10px)` }}
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2">
              <span className="text-[11px] md:text-[12px] font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                <span className="text-[var(--accent)] font-bold">Start</span> Time
              </span>
              <input
                type="number"
                min={0}
                max={Math.max(0, safeDuration - 0.5)}
                step={0.1}
                value={Number(trimStart.toFixed(1))}
                onChange={(e) => updateStart(e.target.value)}
                className="h-12 md:h-14 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 text-[15px] md:text-[14px] font-bold outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] md:text-[12px] font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                <span className="text-[var(--accent)] font-bold">End</span> Time
              </span>
              <input
                type="number"
                min={trimStart + 0.5}
                max={Math.min(safeDuration, trimStart + STATUS_VIDEO_MAX_SECONDS)}
                step={0.1}
                value={Number(trimEnd.toFixed(1))}
                onChange={(e) => updateEnd(e.target.value)}
                className="h-12 md:h-14 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 text-[15px] md:text-[14px] font-bold outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
