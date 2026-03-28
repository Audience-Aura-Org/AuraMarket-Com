import api from './api';

/**
 * uploadService
 * Handles multi-part/form-data requests for image uploads.
 */
export const uploadService = {
  // Upload a single file
  uploadSingle: async (file, type = 'general') => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);

    const res = await api.post('/upload/single', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  // Upload multiple files (up to 5)
  uploadMultiple: async (files, type = 'general') => {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('images', file);
    });
    formData.append('type', type);

    const res = await api.post('/upload/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  }
};
