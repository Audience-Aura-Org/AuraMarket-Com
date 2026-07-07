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

// Capture a real video frame to canvas using play→timeupdate→capture→pause.
// On Android WebView, seeking alone does NOT commit a pixel surface — the video
// must actually output frames (timeupdate) before drawImage/createImageBitmap
// returns anything other than solid black.
const captureVideoFrame = async (video, targetTime = 0) => {
  try {
    video.currentTime = targetTime > 0 ? targetTime : 0.001;
    await new Promise((r) => { video.addEventListener('seeked', r, { once: true }); setTimeout(r, 500); });

    const savedMuted = video.muted;
    video.muted = true;
    await video.play();
    // Wait for the HW decoder to present a real frame
    await new Promise((r) => {
      video.addEventListener('timeupdate', r, { once: true });
      setTimeout(r, 700);
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 568;
    const ctx = canvas.getContext('2d');

    // GPU path preferred (works on Android HW decoder)
    if (typeof createImageBitmap === 'function') {
      try {
        const bmp = await createImageBitmap(video);
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        bmp.close?.();
      } catch {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    video.pause();
    video.currentTime = targetTime > 0 ? targetTime : 0.001;
    video.muted = savedMuted;

    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
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
  hideVideoPreview = false,
}) {
  const videoRef = useRef(null);
  const animationRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(trimStart);
  const [posterUrl, setPosterUrl] = useState(null);
  const safeDuration = Math.max(0.1, Number(duration) || STATUS_VIDEO_MAX_SECONDS);
  const selectedLength = Math.max(0.1, trimEnd - trimStart);
  const maxClip = STATUS_VIDEO_MAX_SECONDS;

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
    () => `${formatTime(trimStart)} - ${formatTime(trimEnd)}`,
    [trimStart, trimEnd]
  );

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-[#151517] p-4 text-white shadow-sm md:p-5">
      {!hideVideoPreview && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl border border-[#20c763]/25 bg-[#20c763]/10">
              <Scissors className="size-5 text-[#20c763]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Trim Story Video</h3>
              <p className="mt-0.5 text-[11px] font-semibold text-white/55">Max {maxClip}s - exports 9:16</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${
              overMax ? 'border border-red-500/20 bg-red-500/15 text-red-300' :
              atMax ? 'border border-amber-400/25 bg-amber-400/15 text-amber-300' :
              'border border-[#20c763]/20 bg-[#20c763]/10 text-[#20c763]'
            }`}>
              <Maximize2 className="size-3.5" />
              {selectedLength.toFixed(1)}s / {maxClip}s
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-bold text-white/65">
              <FileVideo className="size-3.5" />
              {formatSize(fileSize)}
            </span>
          </div>
        </div>
      )}

      <div className={hideVideoPreview ? "w-full" : "grid grid-cols-1 gap-4 lg:grid-cols-[160px_1fr]"}>
        {!hideVideoPreview && (
          <div className="relative mx-auto w-full max-w-[160px] overflow-hidden rounded-2xl border border-white/10 bg-black shadow-xl lg:mx-0">
            <video
              ref={videoRef}
              src={previewUrl}
              className="aspect-[9/16] w-full object-cover"
              playsInline
              preload="auto"
              muted={false}
              poster={posterUrl || undefined}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                // Capture a real first frame using play→timeupdate→pause so
                // the poster image is never black on Android WebView.
                // (Simple seek to 0.001 does not initialize the HW surface.)
                captureVideoFrame(v, trimStart > 0 ? trimStart : 0.001)
                  .then((url) => { if (url) setPosterUrl(url); })
                  .catch(() => {});
              }}
            />
            <button
              type="button"
              onClick={togglePlayback}
              className="absolute bottom-3 right-3 flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/65 text-white shadow-xl backdrop-blur-xl transition-all active:scale-95"
              aria-label={playing ? 'Pause trim preview' : 'Play trim preview'}
            >
              {playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
            </button>
            <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/65 px-3 py-1.5 shadow-lg backdrop-blur-xl">
              <span className="font-mono text-[11px] font-bold text-white">{formatTime(currentTime)}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col justify-center space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-white/60">
            <span className="flex items-center gap-2">
              <span className="font-black text-[#20c763]">Selection</span>
              <span className="font-mono">{timelineLabel}</span>
            </span>
            {hideVideoPreview && (
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                overMax ? 'bg-red-500/15 text-red-300' :
                atMax ? 'bg-amber-400/15 text-amber-300' :
                'bg-[#20c763]/10 text-[#20c763]'
              }`}>
                {selectedLength.toFixed(1)}s / {maxClip}s
              </span>
            )}
            <span className="font-mono">Total: {formatTime(safeDuration)}</span>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-black/35 p-3">
            <label className="block space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.12em] text-white/55">
                <span>Start</span>
                <span className="font-mono text-[#20c763]">{formatTime(trimStart)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, safeDuration - 0.5)}
                step={0.1}
                value={trimStart}
                onChange={(e) => updateStart(e.target.value)}
                className="h-2 w-full accent-[#20c763]"
                aria-label="Trim start"
              />
            </label>
            <label className="block space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.12em] text-white/55">
                <span>End</span>
                <span className="font-mono text-[#20c763]">{formatTime(trimEnd)}</span>
              </div>
              <input
                type="range"
                min={trimStart + 0.5}
                max={Math.min(safeDuration, trimStart + maxClip)}
                step={0.1}
                value={trimEnd}
                onChange={(e) => updateEnd(e.target.value)}
                className="h-2 w-full accent-[#20c763]"
                aria-label="Trim end"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Start</span>
              <input
                type="number"
                min={0}
                max={Math.max(0, safeDuration - 0.5)}
                step={0.1}
                value={Number(trimStart.toFixed(1))}
                onChange={(e) => updateStart(e.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/8 px-4 font-mono text-sm font-bold text-white outline-none transition-all focus:border-[#20c763] focus:ring-4 focus:ring-[#20c763]/10"
              />
            </label>
            <label className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white/55">End</span>
              <input
                type="number"
                min={trimStart + 0.5}
                max={Math.min(safeDuration, trimStart + maxClip)}
                step={0.1}
                value={Number(trimEnd.toFixed(1))}
                onChange={(e) => updateEnd(e.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/8 px-4 font-mono text-sm font-bold text-white outline-none transition-all focus:border-[#20c763] focus:ring-4 focus:ring-[#20c763]/10"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
