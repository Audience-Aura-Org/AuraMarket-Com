import api from './api';
import axios from 'axios';

/**
 * Upload progress callback: (percent 0–100) => void
 */

const isVideo = (file) => file?.type?.startsWith('video/');

/**
 * Direct S3 presigned PUT — fastest path; bypasses Next.js/Vercel body limits.
 */
async function uploadViaPresign(file, folder, onProgress) {
  const presignRes = await api.post('/upload/presign', {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    type: folder,
  });

  if (!presignRes.data?.success) {
    throw new Error(presignRes.data?.message || 'Could not prepare upload');
  }

  const { uploadUrl, url } = presignRes.data.data;

  await axios.put(uploadUrl, file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 600000,
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.min(99, Math.round((e.loaded * 100) / e.total)));
      }
    },
  });

  if (onProgress) onProgress(100);
  return { success: true, data: { url, method: 'S3-direct' } };
}

/**
 * Legacy multipart through API (images + fallback when S3 presign unavailable).
 */
async function uploadViaApi(file, folder, fieldName = 'image') {
  const formData = new FormData();
  formData.append('type', folder);
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
    const folder = type || 'general';

    // Videos: prefer direct S3 when available (fast + no proxy 404/413)
    if (isVideo(file)) {
      try {
        return await uploadViaPresign(file, folder, onProgress);
      } catch (presignErr) {
        const status = presignErr.response?.status;
        if (status === 503 || presignErr.response?.data?.fallback === 'single') {
          if (onProgress) onProgress(10);
          const result = await uploadViaApi(file, folder, 'video');
          if (onProgress) onProgress(100);
          return result;
        }
        throw presignErr;
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
    formData.append('type', type);
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
