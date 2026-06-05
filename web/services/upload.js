import api from './api';
import axios from 'axios';

/**
 * Upload progress callback: (percent 0–100) => void
 */

const isVideo = (file) => file?.type?.startsWith('video/');
const normalizeUploadFolder = (folder = 'general') => {
  const raw = String(folder || 'general').trim().toLowerCase();
  if (['status', 'statuses', 'story', 'stories', 'aura-story', 'aurastory'].includes(raw)) {
    return 'statuses';
  }
  return raw.replace(/[^a-z0-9/_-]/g, '-').replace(/\/+/g, '/').replace(/^\/|\/$/g, '') || 'general';
};

const cacheControlForUpload = (folder, file) => {
  if (normalizeUploadFolder(folder) === 'statuses') return 'public, max-age=259200';
  return isVideo(file) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
};

/**
 * Direct S3 presigned PUT — fastest path; bypasses Next.js/Vercel body limits.
 */
async function uploadViaPresign(file, folder, onProgress) {
  const isVid = isVideo(file);
  const contentType = file.type || 'application/octet-stream';
  const normalizedFolder = normalizeUploadFolder(folder);
  const cacheControl = cacheControlForUpload(normalizedFolder, file);
  const contentDisposition = isVid ? 'inline' : 'attachment';

  const presignRes = await api.post('/upload/presign', {
    fileName: file.name,
    contentType: contentType,
    type: normalizedFolder,
  });

  if (!presignRes.data?.success) {
    throw new Error(presignRes.data?.message || 'Could not prepare upload');
  }

  const { uploadUrl, url } = presignRes.data.data;

  try {
    await axios.put(uploadUrl, file, {
      headers: { 
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Content-Disposition': contentDisposition
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 600000,
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.min(99, Math.round((e.loaded * 100) / e.total)));
        }
      },
    });
  } catch (err) {
    console.error('❌ [Upload] S3 Direct PUT failed:', {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      config: {
        url: uploadUrl,
        contentType,
        cacheControl,
        contentDisposition
      }
    });
    throw err;
  }

  if (onProgress) onProgress(100);
  return { success: true, data: { url, method: 'S3-direct' } };
}

/**
 * Legacy multipart through API (images + fallback when S3 presign unavailable).
 */
async function uploadViaApi(file, folder, fieldName = 'image') {
  const formData = new FormData();
  formData.append('type', normalizeUploadFolder(folder));
  formData.append(fieldName, file);
  if (fieldName !== 'image') formData.append('image', file);

  const res = await api.post('/upload/single', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return res.data;
}

export const uploadService = {
  uploadSingle: async (file, type = 'general', options = {}) => {
    const { onProgress } = options;
    const folder = normalizeUploadFolder(type || 'general');

    // Videos: prefer direct S3 when available (fast + no proxy 404/413)
    if (isVideo(file)) {
      try {
        return await uploadViaPresign(file, folder, onProgress);
      } catch (presignErr) {
        console.warn('⚠️ [Upload] Direct S3 upload failed, falling back to legacy API upload:', presignErr.message || presignErr);
        if (onProgress) onProgress(10);
        const result = await uploadViaApi(file, folder, 'video');
        if (onProgress) onProgress(100);
        return result;
      }
    }

    // Images: small enough for API path; try presign for large files (>8MB)
    if (file.size > 8 * 1024 * 1024) {
      try {
        return await uploadViaPresign(file, folder, onProgress);
      } catch {
        /* fall through */
      }
    }

    if (onProgress) onProgress(20);
    const result = await uploadViaApi(file, folder, 'image');
    if (onProgress) onProgress(100);
    return result;
  },

  uploadMultiple: async (files, type = 'general') => {
    const formData = new FormData();
    formData.append('type', normalizeUploadFolder(type));
    Array.from(files).forEach((file) => {
      formData.append('images', file);
    });

    const res = await api.post('/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
    });
    return res.data;
  },
};
