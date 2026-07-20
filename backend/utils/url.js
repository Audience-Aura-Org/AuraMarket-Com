/**
 * utils/url.js
 * Utility for handling dynamic URLs and domain detection
 */

const PUBLIC_WEB_URL = (process.env.WEB_CLIENT_URL || 'https://auradime.com').replace(/\/$/, '');

// Origins that belong to the Capacitor native shell or local dev — NOT valid
// as payment-gateway return URLs. Always fall back to the public web domain.
const isNativeOrLocalOrigin = (hostname, protocol) => {
  if (protocol === 'capacitor:') return true;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '10.0.2.2';
};

const getWebUrl = (req) => {
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    try {
      const url = new URL(origin);
      if (isNativeOrLocalOrigin(url.hostname, url.protocol)) {
        // Capacitor / local dev — use the configured public web URL so that
        // payment gateways receive a real return URL (not https://localhost).
        return PUBLIC_WEB_URL;
      }
      return url.origin.replace(/\/$/, '');
    } catch (e) {
      return origin.replace(/\/$/, '');
    }
  }
  return PUBLIC_WEB_URL;
};

module.exports = { getWebUrl };
