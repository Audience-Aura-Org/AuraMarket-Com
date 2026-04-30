const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const { uploadSingle, uploadMultiple } = require('../controllers/upload.controller');

const router = express.Router();

/**
 * 🚀 Direct S3 Upload Configuration
 * Using memory storage instead of disk since files go directly to S3
 * Much more efficient for production
 */
const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept images and videos (for statuses)
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed'), false);
  }
};

const upload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per file
  }
});

router.use(protect); // Ensure all uploads are authenticated

// @route   POST /api/upload/single
// @desc    Upload a single file to S3 (or Cloudinary/Local fallback)
// @access  Private
router.post('/single', upload.single('image'), uploadSingle);

// @route   POST /api/upload/multiple
// @desc    Upload multiple files to S3 (limit 5)
// @access  Private
router.post('/multiple', upload.array('images', 5), uploadMultiple);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB'
      });
    }
  }
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  next();
});

module.exports = router;
