"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Scissors, FileVideo, Maximize2 } from 'lucide-react';
import { STATUS_VIDEO_MAX_SECONDS } from '@/constants/statusVideo';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatTime = (seconds = 0) => {
  const total = Math.max(0, seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
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
  const animationRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(trimStart);
  const safeDuration = Math.max(0.1, Number(duration) || STATUS_VIDEO_MAX_SECONDS);
  const selectedLength = Math.max(0.1, trimEnd - trimStart);
  const maxClip = STATUS_VIDEO_MAX_SECONDS;

  const startPct = (trimStart / safeDuration) * 100;
  const endPct = (trimEnd / safeDuration) * 100;

  const atMax = selectedLength >= maxClip - 0.05;
  const overMax = selectedLength > maxClip + 0.01;

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
    if (!playing) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      return undefined;
    }

    const tick = () => {
      const video = videoRef.current;
      if (!video) return;
      setCurrentTime(video.currentTime);
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    };
  }, [playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime < trimStart || video.currentTime > trimEnd) {
      video.currentTime = trimStart;
      setCurrentTime(trimStart);
    } else {
      setCurrentTime(video.currentTime);
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
    const next = clamp(Number(raw) || 0, 0, Math.max(0, safeDuration - 0.5));
    const maxEnd = Math.min(safeDuration, next + maxClip);
    const nextEnd = clamp(trimEnd, next + 0.5, maxEnd);
    onTrimStartChange(next);
    onTrimEndChange(nextEnd);
    onEditingChange?.(true);
  };

  const updateEnd = (raw) => {
    const maxEnd = Math.min(safeDuration, trimStart + maxClip);
    const next = clamp(Number(raw) || maxEnd, trimStart + 0.5, maxEnd);
    onTrimEndChange(next);
    onEditingChange?.(true);
  };

  const timelineLabel = useMemo(
    () => `${formatTime(trimStart)} – ${formatTime(trimEnd)}`,
    [trimStart, trimEnd]
  );

  return (
    <div className="space-y-4 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/70 p-4 shadow-sm md:p-5">
      {/* Header Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10">
            <Scissors className="size-5 text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[var(--text-primary)]">
              Trim Story Video
            </h3>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              WhatsApp-style - max {maxClip}s - 9:16 aspect
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${
            overMax ? 'border border-red-500/20 bg-red-500/15 text-red-500' :
            atMax ? 'border border-amber-400/25 bg-amber-400/15 text-amber-300' :
            'border border-[var(--accent)]/20 bg-[var(--accent)]/10 text-[var(--accent)]'
          }`}>
            <Maximize2 className="size-3.5" />
            {selectedLength.toFixed(1)}s / {maxClip}s
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
            <FileVideo className="size-3.5" />
            {formatSize(fileSize)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[180px_1fr]">
        {/* Video Preview */}
        <div className="relative mx-auto w-full max-w-[180px] overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-black shadow-xl xl:mx-0">
          <video
            ref={videoRef}
            src={previewUrl}
            className="aspect-[9/16] w-full object-cover"
            playsInline
            muted={false}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
          <button
            type="button"
            onClick={togglePlayback}
            className="absolute bottom-3 right-3 flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white shadow-xl backdrop-blur-xl transition-all hover:scale-105 hover:bg-black/80 active:scale-95"
          >
            {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
          </button>
          <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/65 px-3 py-1.5 shadow-lg backdrop-blur-xl">
            <span className="font-mono text-[11px] font-bold text-white">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex flex-col justify-center space-y-4">
          {/* Timeline Info */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
              <span className="flex items-center gap-2">
                <span className="font-black text-[var(--accent)]">Selection</span>
                <span className="font-mono">{timelineLabel}</span>
              </span>
              <span className="font-mono">Total: {formatTime(safeDuration)}</span>
            </div>
          </div>

          {/* Timeline Slider */}
          <div className="space-y-3">
            <div className="relative h-14 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-2">
              <div
                className="absolute inset-y-2 rounded-xl bg-[var(--accent)]/18"
                style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
              />
              <div
                className="absolute top-1/2 z-20 size-6 -translate-y-1/2 cursor-grab rounded-full border-4 border-white bg-[var(--accent)] shadow-xl transition-transform hover:scale-110 active:cursor-grabbing"
                style={{ left: `calc(${startPct}% - 12px)` }}
              />
              <div
                className="absolute top-1/2 z-20 size-6 -translate-y-1/2 cursor-grab rounded-full border-4 border-white bg-[var(--accent)] shadow-xl transition-transform hover:scale-110 active:cursor-grabbing"
                style={{ left: `calc(${endPct}% - 12px)` }}
              />
              <input
                type="range"
                min={0}
                max={safeDuration}
                step={0.1}
                value={trimStart}
                onChange={(e) => updateStart(e.target.value)}
                className="absolute inset-0 z-30 h-full w-full cursor-pointer opacity-0"
                aria-label="Trim start"
              />
              <input
                type="range"
                min={0}
                max={safeDuration}
                step={0.1}
                value={trimEnd}
                onChange={(e) => updateEnd(e.target.value)}
                className="absolute inset-0 z-40 h-full w-full cursor-pointer opacity-0"
                aria-label="Trim end"
              />
            </div>
          </div>

          {/* Numeric Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[var(--accent)]"></span>
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">Start</span>
              </div>
              <input
                type="number"
                min={0}
                max={Math.max(0, safeDuration - 0.5)}
                step={0.1}
                value={Number(trimStart.toFixed(1))}
                onChange={(e) => updateStart(e.target.value)}
                className="h-12 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 font-mono text-sm font-bold text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
              />
            </label>
            <label className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[var(--accent)]"></span>
                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">End</span>
              </div>
              <input
                type="number"
                min={trimStart + 0.5}
                max={Math.min(safeDuration, trimStart + maxClip)}
                step={0.1}
                value={Number(trimEnd.toFixed(1))}
                onChange={(e) => updateEnd(e.target.value)}
                className="h-12 w-full rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 font-mono text-sm font-bold text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/10"
              />
            </label>
          </div>

          {/* Helper Text */}
          <div className="rounded-2xl border border-[var(--accent)]/15 bg-[var(--accent)]/5 p-3">
            <p className="text-[11px] font-semibold leading-relaxed text-[var(--text-secondary)]">
              <span className="font-black text-[var(--accent)]">Tip:</span> Drag the handles or type exact times. Stories publish at {maxClip}s or less.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
