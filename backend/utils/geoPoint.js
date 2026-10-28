/**
 * Validates a customer-confirmed map point ({ lat, lng, source }).
 * Returns a clean point, or null when absent or outside Cameroon.
 */
const SOURCES = ['search', 'pin', 'gps', 'saved'];

const inCameroon = (lat, lng) => lat >= 1.6 && lat <= 13.1 && lng >= 8.4 && lng <= 16.2;

const confirmedPoint = (input) => {
  if (!input || typeof input !== 'object') return null;
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inCameroon(lat, lng)) return null;
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    source: SOURCES.includes(input.source) ? input.source : 'pin',
    confirmed_at: new Date(),
  };
};

module.exports = { confirmedPoint, inCameroon };
