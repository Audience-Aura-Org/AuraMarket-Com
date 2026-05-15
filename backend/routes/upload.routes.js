const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const { uploadSingle, uploadMultiple, presignUpload } = require('../controllers/upload.controller');

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
    fileSize: 500 * 1024 * 1024 // 500MB limit per file
  }
});

router.use(protect); // Ensure all uploads are authenticated

// @route   POST /api/upload/presign — JSON body; returns S3 PUT URL (no file through API)
router.post('/presign', presignUpload);

// Accept image | file | video field names (status creator compatibility)
const pickUploadFile = (req, res, next) => {
  req.file = req.files?.image?.[0] || req.files?.file?.[0] || req.files?.video?.[0] || null;
  next();
};

// @route   POST /api/upload/single
router.post(
  '/single',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  pickUploadFile,
  uploadSingle
);

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
        message: 'File too large. Maximum size is 500MB'
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
