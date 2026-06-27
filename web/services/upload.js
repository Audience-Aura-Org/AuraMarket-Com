import api from './api';
import axios from 'axios';

const MB = 1024 * 1024;

const isVideo = (file) => file?.type?.startsWith('video/');

const normalizeUploadFolder = (folder = 'general') => {
  const raw = String(folder || 'general').trim().toLowerCase();
  if (['status-source', 'status-sources', 'statuses-source', 'story-source', 'story-sources', 'story-original', 'status-original'].includes(raw)) {
    return 'status-sources';
  }
  if (['status', 'statuses', 'story', 'stories', 'aura-story', 'aurastory'].includes(raw)) {
    return 'statuses';
  }
  return raw.replace(/[^a-z0-9/_-]/g, '-').replace(/\/+/g, '/').replace(/^\/|\/$/g, '') || 'general';
};

const UPLOAD_LIMITS = {
  statuses: { video: 16 * MB, image: 8 * MB, file: 16 * MB },
  'status-sources': { video: 500 * MB, image: 8 * MB, file: 500 * MB },
  products: { image: 5 * MB, file: 5 * MB },
  product: { image: 5 * MB, file: 5 * MB },
  banners: { image: 5 * MB, file: 5 * MB },
  banner: { image: 5 * MB, file: 5 * MB },
  logos: { image: 5 * MB, file: 5 * MB },
  logo: { image: 5 * MB, file: 5 * MB },
  chat: { video: 10 * MB, image: 10 * MB, file: 10 * MB },
  'chat-media': { video: 10 * MB, image: 10 * MB, file: 10 * MB },
};

const IMAGE_PROFILES = {
  statuses: { maxWidth: 1080, quality: 0.84 },
  products: { maxWidth: 1600, quality: 0.82 },
  product: { maxWidth: 1600, quality: 0.82 },
  banners: { maxWidth: 1920, quality: 0.82 },
  banner: { maxWidth: 1920, quality: 0.82 },
  logos: { maxWidth: 700, quality: 0.86 },
  logo: { maxWidth: 700, quality: 0.86 },
  general: { maxWidth: 1600, quality: 0.82 },
};

const cacheControlForUpload = (folder, file) => {
  if (['statuses', 'status-sources'].includes(normalizeUploadFolder(folder))) return 'public, max-age=259200';
  return isVideo(file) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
};

function assertUploadLimit(file, folder) {
  if (!file) return;
  const normalizedFolder = normalizeUploadFolder(folder);
  const mediaType = file.type?.startsWith('video/')
    ? 'video'
    : file.type?.startsWith('image/')
      ? 'image'
      : 'file';
  const limit = UPLOAD_LIMITS[normalizedFolder]?.[mediaType] || UPLOAD_LIMITS[normalizedFolder]?.file;
  if (limit && file.size > limit) {
    throw new Error(`File is too large. Maximum ${mediaType} size for ${normalizedFolder} is ${Math.round(limit / MB)}MB.`);
  }
}

const canvasToBlob = (canvas, type = 'image/webp', quality = 0.82) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

async function optimizeImageForUpload(file, folder) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  try {
    const normalizedFolder = normalizeUploadFolder(folder);
    const profile = IMAGE_PROFILES[normalizedFolder] || IMAGE_PROFILES.general;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, profile.maxWidth / Math.max(bitmap.width, 1));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await canvasToBlob(canvas, 'image/webp', profile.quality);
    if (!blob || blob.size >= file.size) return file;

    const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn('[Upload] Image optimization skipped:', err.message || err);
    return file;
  }
}

async function uploadViaPresign(file, folder, onProgress) {
  const isVid = isVideo(file);
  const contentType = file.type || 'application/octet-stream';
  const normalizedFolder = normalizeUploadFolder(folder);
  const cacheControl = cacheControlForUpload(normalizedFolder, file);
  const contentDisposition = isVid ? 'inline' : 'attachment';

  const presignRes = await api.post('/upload/presign', {
    fileName: file.name,
    contentType,
    fileSize: file.size,
    type: normalizedFolder,
  });

  if (!presignRes.data?.success) {
    throw new Error(presignRes.data?.message || 'Could not prepare upload');
  }

  const { uploadUrl, url } = presignRes.data.data;

  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'Content-Disposition': contentDisposition,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 600000,
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.min(99, Math.round((event.loaded * 100) / event.total)));
      }
    },
  });

  if (onProgress) onProgress(100);
  return { success: true, data: { url, method: 'S3-direct' } };
}

async function uploadViaApi(file, folder, fieldName = 'image') {
  const formData = new FormData();
  formData.append('type', normalizeUploadFolder(folder));
  formData.append(fieldName, file);

  try {
    const response = await api.post('/upload/single', formData, {
      timeout: 600000,
    });
    return response.data;
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      throw new Error('Upload timed out. Please try again.');
    }
    if (!err.response) {
      throw new Error('Upload server is unreachable. Check your connection and try again.');
    }
    throw err;
  }
}

export const uploadService = {
  uploadSingle: async (file, type = 'general', options = {}) => {
    const { onProgress } = options;
    const folder = normalizeUploadFolder(type || 'general');
    assertUploadLimit(file, folder);

    const uploadFile = isVideo(file) ? file : await optimizeImageForUpload(file, folder);
    assertUploadLimit(uploadFile, folder);

    if (folder === 'statuses' || folder === 'status-sources') {
      try {
        return await uploadViaPresign(uploadFile, folder, onProgress);
      } catch (presignErr) {
        console.warn('[Upload] Direct story upload failed, falling back to API upload:', presignErr.message || presignErr);
        if (onProgress) onProgress(10);
        const result = await uploadViaApi(uploadFile, folder, isVideo(uploadFile) ? 'video' : 'image');
        if (onProgress) onProgress(100);
        return result;
      }
    }

    if (isVideo(uploadFile)) {
      try {
        return await uploadViaPresign(uploadFile, folder, onProgress);
      } catch (presignErr) {
        console.warn('[Upload] Direct S3 upload failed, falling back to API upload:', presignErr.message || presignErr);
        if (onProgress) onProgress(10);
        const result = await uploadViaApi(uploadFile, folder, 'video');
        if (onProgress) onProgress(100);
        return result;
      }
    }

    if (uploadFile.size > 8 * MB) {
      try {
        return await uploadViaPresign(uploadFile, folder, onProgress);
      } catch {
        // Fall back to API upload.
      }
    }

    if (onProgress) onProgress(20);
    const result = await uploadViaApi(uploadFile, folder, 'image');
    if (onProgress) onProgress(100);
    return result;
  },

  uploadMultiple: async (files, type = 'general') => {
    const folder = normalizeUploadFolder(type);
    const optimizedFiles = await Promise.all(Array.from(files).map(async (file) => {
      assertUploadLimit(file, folder);
      const optimized = isVideo(file) ? file : await optimizeImageForUpload(file, folder);
      assertUploadLimit(optimized, folder);
      return optimized;
    }));

    const formData = new FormData();
    formData.append('type', folder);
    optimizedFiles.forEach((file) => {
      formData.append('images', file);
    });

    const res = await api.post('/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    });
    return res.data;
  },
};
