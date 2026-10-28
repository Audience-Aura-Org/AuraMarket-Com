const express = require('express');
const { searchLocations, resolveLocation } = require('../controllers/location.controller');

const router = express.Router();
router.get('/search', searchLocations);
router.get('/resolve', resolveLocation);

module.exports = router;
