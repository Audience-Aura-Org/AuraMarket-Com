const express = require('express');
const router = express.Router();
const { 
  getNewArrivals, 
  getTrending, 
  getPopular, 
  getRecommended, 
  getTopVendors, 
  getDiscoveryFeed 
} = require('../controllers/discovery.controller');
const { protectOptional } = require('../middleware/auth.middleware');

// All discovery routes support optional authentication for personalization
router.use(protectOptional);

router.get('/new', getNewArrivals);
router.get('/trending', getTrending);
router.get('/popular', getPopular);
router.get('/recommended', getRecommended);
router.get('/vendors', getTopVendors);
router.get('/feed', getDiscoveryFeed);

module.exports = router;
