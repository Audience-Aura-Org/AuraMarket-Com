const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { uploadSingle, uploadMultiple } = require('../controllers/upload.controller');
const upload = require('../utils/storage'); // 🚀 Fixed Persistent Engine

const router = express.Router();

/**
 * ── Unified Protocol Uploads ──────────────────────────────────────────────
 * These routes and middlewares are now using a persistent storage engine.
 * When Cloudinary credentials are set in .env, files will NO LONGER
 * be deleted when you push to git.
 */

router.use(protect); // Ensure all uploads are authenticated

// @route   POST /api/upload/single
// @desc    Upload a single file
router.post('/single', upload.single('image'), uploadSingle);

// @route   POST /api/upload/multiple
// @desc    Upload multiple files (limit 5)
router.post('/multiple', upload.array('images', 5), uploadMultiple);

module.exports = router;
