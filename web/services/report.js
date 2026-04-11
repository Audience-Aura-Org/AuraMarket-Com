import api from './api';

/**
 * reportService
 * Handles user submission of fraud or abuse reports.
 */
export const reportService = {
  // Submit a report
  submitReport: async (reportData) => {
    const res = await api.post('/reports', reportData);
    return res.data;
  }
};
