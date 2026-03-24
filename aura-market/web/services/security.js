import api from './api';

/**
 * securityService
 * Handles Two-Factor Authentication (2FA) setup logic.
 */
export const securityService = {
  // Generate secret and QR code
  generate2FA: async () => {
    const res = await api.get('/security/2fa/generate');
    return res.data;
  },

  // Verify and enable 2FA
  enable2FA: async (token) => {
    const res = await api.post('/security/2fa/enable', { token });
    return res.data;
  },

  // Disable 2FA
  disable2FA: async (token) => {
    const res = await api.post('/security/2fa/disable', { token });
    return res.data;
  }
};
