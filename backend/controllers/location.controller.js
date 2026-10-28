/**
 * Public location endpoints used by the location picker.
 *   GET /locations/search?q=bonam      → cities, districts, quartiers and approved landmarks
 *   GET /locations/resolve?lat=&lng=   → quartier a map pin falls in (+ whether to confirm it)
 */
const locationService = require('../services/location.service');

const searchLocations = async (req, res, next) => {
  try {
    const results = await locationService.search(req.query.q, { limit: Math.min(15, Number(req.query.limit) || 10) });
    res.json({ success: true, data: { results } });
  } catch (err) { next(err); }
};

const resolveLocation = async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    // Cameroon's bounding box, with a margin: anything else is a client bug or abuse.
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 1 || lat > 13.5 || lng < 8 || lng > 16.5) {
      return res.status(400).json({ success: false, message: 'Choose a location inside Cameroon.' });
    }
    res.json({ success: true, data: await locationService.resolvePoint({ lat, lng }) });
  } catch (err) { next(err); }
};

module.exports = { searchLocations, resolveLocation };
