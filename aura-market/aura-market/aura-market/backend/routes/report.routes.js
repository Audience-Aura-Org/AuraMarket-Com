const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { submitReport } = require('../controllers/report.controller');

router.use(protect);

router.post('/', submitReport);

module.exports = router;
