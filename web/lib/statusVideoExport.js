import { Capacitor } from '@capacitor/core';
import api from '@/services/api';
import {
  STATUS_VIDEO_MAX_SECONDS,
  STATUS_VIDEO_EXPORT_WIDTH,
  STATUS_VIDEO_EXPORT_HEIGHT,
} from '@/constants/statusVideo';

export const isAndroidNative = () =>
  typeof window !== 'undefined'
  && Capacitor.isNativePlatform()
  && Capacitor.getPlatform() === 'android';

export const getSupportedVideoMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';

  const candidates = isAndroidNative()
    ? [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
        'video/3gpp',
      ]
    : [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

export const canClientExportStatusVideo = () => {
  if (typeof window === 'undefined') return false;
  if (!getSupportedVideoMimeType()) return false;

  const video = document.createElement('video');
  const canvas = document.createElement('canvas');
  const hasVideoStream = typeof video.captureStream === 'function'
    || typeof HTMLMediaElement.prototype.captureStream === 'function';
  const hasCanvasStream = typeof canvas.captureStream === 'function'
    || typeof HTMLCanvasElement.prototype.captureStream === 'function';

  return hasVideoStream && hasCanvasStream;
};

const drawVideoFrame = (ctx, video, cropMode = 'crop') => {
  const sourceWidth = video.videoWidth || STATUS_VIDEO_EXPORT_WIDTH;
  const sourceHeight = video.videoHeight || STATUS_VIDEO_EXPORT_HEIGHT;
  const targetRatio = STATUS_VIDEO_EXPORT_WIDTH / STATUS_VIDEO_EXPORT_HEIGHT;
  const sourceRatio = sourceWidth / Math.max(sourceHeight, 1);

  ctx.fillStyle = '#07030a';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (cropMode === 'fit') {
    if (sourceRatio > targetRatio) {
      const targetHeight = STATUS_VIDEO_EXPORT_WIDTH / sourceRatio;
      ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight, 0, (STATUS_VIDEO_EXPORT_HEIGHT - targetHeight) / 2, STATUS_VIDEO_EXPORT_WIDTH, targetHeight);
    } else {
      const targetWidth = STATUS_VIDEO_EXPORT_HEIGHT * sourceRatio;
      ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight, (STATUS_VIDEO_EXPORT_WIDTH - targetWidth) / 2, 0, targetWidth, STATUS_VIDEO_EXPORT_HEIGHT);
    }
    return;
  }

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, ctx.canvas.width, ctx.canvas.height);
};

export async function exportEditedStatusVideo(file, { trimStart = 0, trimEnd = STATUS_VIDEO_MAX_SECONDS, cropMode = 'crop', onProgress } = {}) {
  const mimeType = getSupportedVideoMimeType();
  if (!mimeType) {
    throw new Error('Video editing is not supported on this device. Please trim the video in your gallery and try again.');
  }

  const sourceUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Could not load video for editing.'));
    });

    const start = Math.max(0, Math.min(trimStart, video.duration || 0));
    const end = Math.min(Math.max(start + 1, trimEnd), video.duration || start + STATUS_VIDEO_MAX_SECONDS);
    const duration = Math.min(STATUS_VIDEO_MAX_SECONDS, end - start);

    const canvas = document.createElement('canvas');
    canvas.width = STATUS_VIDEO_EXPORT_WIDTH;
    canvas.height = STATUS_VIDEO_EXPORT_HEIGHT;
    const ctx = canvas.getContext('2d');
    const canvasStream = canvas.captureStream(30);
    const captureStream = video.captureStream?.bind(video)
      || HTMLMediaElement.prototype.captureStream?.bind(video);
    const sourceStream = captureStream?.();
    sourceStream?.getAudioTracks?.().forEach((track) => canvasStream.addTrack(track));

    const chunks = [];
    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: isAndroidNative() ? 1_500_000 : 2_000_000,
      audioBitsPerSecond: 96_000,
    });

    const recorded = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('Video export failed.'));
      recorder.onstop = resolve;
    });

    await new Promise((resolve) => {
      video.onseeked = resolve;
      video.currentTime = start;
    });

    let stopped = false;
    const draw = () => {
      if (stopped) return;
      drawVideoFrame(ctx, video, cropMode);
      const elapsed = Math.max(0, video.currentTime - start);
      onProgress?.(Math.min(95, Math.round((elapsed / Math.max(duration, 1)) * 95)));
      if (elapsed >= duration || video.ended) {
        stopped = true;
        video.pause();
        if (recorder.state !== 'inactive') recorder.stop();
        return;
      }
      requestAnimationFrame(draw);
    };

    recorder.start(500);
    try {
      await video.play();
    } catch {
      video.muted = true;
      await video.play();
    }
    draw();
    await recorded;

    const blob = new Blob(chunks, { type: mimeType.split(';')[0] || 'video/webm' });
    const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const baseName = (file.name || 'status-video').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}-story.${extension}`, {
      type: blob.type || 'video/webm',
      lastModified: Date.now(),
    });
  } finally {
    video.pause();
    URL.revokeObjectURL(sourceUrl);
  }
}

async function uploadStatusVideoWithServerTrim(file, { trimStart, trimEnd, cropMode = 'crop', onProgress } = {}) {
  const formData = new FormData();
  formData.append('type', 'status-sources');
  formData.append('video', file);
  formData.append('image', file);
  formData.append('trimStart', String(trimStart ?? 0));
  formData.append('trimEnd', String(trimEnd ?? STATUS_VIDEO_MAX_SECONDS));
  formData.append('cropMode', cropMode);

  const res = await api.post('/upload/single', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    __skipRetry: true,
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.min(99, Math.round((event.loaded * 100) / event.total)));
      }
    },
  });

  if (!res.data?.success) {
    throw new Error(res.data?.message || 'Server video trim failed.');
  }

  onProgress?.(100);
  return res.data;
}

export async function prepareStatusVideoForUpload(file, { trimStart = 0, trimEnd = STATUS_VIDEO_MAX_SECONDS, cropMode = 'crop', onProgress } = {}) {
  if (canClientExportStatusVideo()) {
    try {
      const exported = await exportEditedStatusVideo(file, { trimStart, trimEnd, cropMode, onProgress });
      return { mode: 'client', file: exported };
    } catch (err) {
      console.warn('[StatusVideo] Client export failed, using server trim fallback:', err.message);
    }
  }

  const uploadResult = await uploadStatusVideoWithServerTrim(file, { trimStart, trimEnd, cropMode, onProgress });
  return { mode: 'server', uploadResult };
}
