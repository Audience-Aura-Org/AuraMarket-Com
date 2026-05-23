/**
 * utils/url.js
 * Utility for handling dynamic URLs and domain detection
 */

const getWebUrl = (req) => {
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    // Return base origin without trailing slash
    try {
      const url = new URL(origin);
      return url.origin;
    } catch (e) {
      return origin.replace(/\/$/, '');
    }
  }
  return (process.env.WEB_CLIENT_URL || 'https://auradime.com').replace(/\/$/, '');
};

module.exports = { getWebUrl };
