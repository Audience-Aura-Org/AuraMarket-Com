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
    <div className="space-y-6 rounded-3xl glass-panel p-6 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary-container/20 border border-primary-container/30">
            <Scissors className="size-6 text-primary-container" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface">
              Trim Story Video
            </h3>
            <p className="text-sm font-medium text-on-surface-variant mt-1">
              WhatsApp-style • Max {maxClip}s • 9:16 Aspect
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wider ${
            overMax ? 'bg-red-500/15 text-error border border-error/20' :
            atMax ? 'bg-amber-500/15 text-yellow-300 border border-yellow-300/20' : 
            'bg-primary-container/10 text-primary-container border border-primary-container/20'
          }`}>
            <Maximize2 className="size-4" />
            {selectedLength.toFixed(1)}s / {maxClip}s
          </span>
          <span className="flex items-center gap-2 rounded-full px-4 py-2 bg-surface-container border border-glass-border text-sm font-semibold text-on-surface-variant">
            <FileVideo className="size-4" />
            {formatSize(fileSize)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-8">
        {/* Video Preview */}
        <div className="relative overflow-hidden rounded-3xl border border-glass-border bg-surface-midnight shadow-2xl">
          <video
            ref={videoRef}
            src={previewUrl}
            className="aspect-[9/16] w-full max-h-[420px] sm:max-h-[480px] object-cover"
            playsInline
            muted={false}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
          />
          <button
            type="button"
            onClick={togglePlayback}
            className="absolute bottom-6 right-6 flex size-16 sm:size-18 items-center justify-center rounded-full border-2 border-white/30 bg-black/65 text-white backdrop-blur-xl hover:bg-black/80 hover:scale-105 active:scale-95 transition-all shadow-2xl magenta-glow"
          >
            {playing ? <Pause className="size-7 sm:size-8" /> : <Play className="size-7 sm:size-8 ml-1" />}
          </button>
          <div className="absolute top-6 left-6 bg-black/65 backdrop-blur-xl rounded-full px-5 py-2.5 border border-white/25 shadow-lg">
            <span className="text-sm font-mono font-bold text-white">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

        {/* Controls Section */}
        <div className="space-y-6 flex flex-col justify-center">
          {/* Timeline Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-semibold text-on-surface-variant">
              <span className="flex items-center gap-2">
                <span className="text-primary-container font-bold text-base">Selection:</span>
                <span className="font-mono">{timelineLabel}</span>
              </span>
              <span className="font-mono">Total: {formatTime(safeDuration)}</span>
            </div>
          </div>

          {/* Timeline Slider */}
          <div className="space-y-4">
            <div className="relative h-16 sm:h-18 rounded-2xl bg-surface-container border border-glass-border p-2">
              <div
                className="absolute inset-y-2 rounded-xl bg-gradient-to-r from-primary-container/30 to-primary-container/20"
                style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
              />
              <div
                className="absolute top-1/2 z-20 size-6 sm:size-7 -translate-y-1/2 rounded-full border-4 border-white bg-primary-container shadow-xl magenta-glow cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                style={{ left: `calc(${startPct}% - 12px)` }}
              />
              <div
                className="absolute top-1/2 z-20 size-6 sm:size-7 -translate-y-1/2 rounded-full border-4 border-white bg-primary-container shadow-xl magenta-glow cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
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
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary-container magenta-glow"></span>
                <span className="text-base font-bold text-on-surface-variant">Start Time</span>
              </div>
              <input
                type="number"
                min={0}
                max={Math.max(0, safeDuration - 0.5)}
                step={0.1}
                value={Number(trimStart.toFixed(1))}
                onChange={(e) => updateStart(e.target.value)}
                className="h-16 sm:h-18 w-full rounded-2xl border border-glass-border bg-surface-container px-5 text-lg font-mono font-bold text-on-surface outline-none focus:border-primary-container focus:ring-4 focus:ring-primary-container/20 transition-all"
              />
            </label>
            <label className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary-container magenta-glow"></span>
                <span className="text-base font-bold text-on-surface-variant">End Time</span>
              </div>
              <input
                type="number"
                min={trimStart + 0.5}
                max={Math.min(safeDuration, trimStart + maxClip)}
                step={0.1}
                value={Number(trimEnd.toFixed(1))}
                onChange={(e) => updateEnd(e.target.value)}
                className="h-16 sm:h-18 w-full rounded-2xl border border-glass-border bg-surface-container px-5 text-lg font-mono font-bold text-on-surface outline-none focus:border-primary-container focus:ring-4 focus:ring-primary-container/20 transition-all"
              />
            </label>
          </div>

          {/* Helper Text */}
          <div className="p-4 rounded-2xl bg-primary-container/5 border border-primary-container/15">
            <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
              <span className="text-primary-container font-bold">Tip:</span> Drag the sliders or type exact times. Your video will be trimmed to exactly {maxClip} seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
