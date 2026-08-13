/**
 * routes/restaurant.routes.js
 * Auradime — Restaurant Profile Management (vendor-authenticated)
 *
 *   GET   /api/restaurant/profile   — fetch own RestaurantProfile
 *   POST  /api/restaurant/profile   — create RestaurantProfile
 *   PATCH /api/restaurant/profile   — update RestaurantProfile (triggers zone sync)
 */

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { getOwnProfile, createProfile, updateProfile } = require('../controllers/restaurant.controller');

router.get('/profile',   protect, restrictTo('vendor'), getOwnProfile);
router.post('/profile',  protect, restrictTo('vendor'), createProfile);
router.patch('/profile', protect, restrictTo('vendor'), updateProfile);

module.exports = router;
