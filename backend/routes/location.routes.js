const express = require('express');
const { searchLocations, resolveLocation, placeLocation } = require('../controllers/location.controller');

const router = express.Router();
router.get('/search', searchLocations);
router.get('/resolve', resolveLocation);
router.get('/place/:id', require('../middleware/rateLimiter').placeLookupLimiter, placeLocation);

module.exports = router;
