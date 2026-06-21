const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const { uploadSingle, uploadMultiple, presignUpload, processVideoFromS3 } = require('../controllers/upload.controller');

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
    // Mobile story videos use the server-trim path first, so this route must allow
    // the larger source upload before folder-specific limits are enforced later.
    fileSize: 500 * 1024 * 1024
  }
});

router.use(protect); // Ensure all uploads are authenticated

// @route   POST /api/upload/presign — JSON body; returns S3 PUT URL (no file through API)
router.post('/presign', presignUpload);

// @route   POST /api/upload/process-s3 — JSON body; trims/transcodes a file already in S3
// @desc    Downloads source from status-sources/, runs ffmpeg, re-uploads to statuses/
// @access  Private (no multer — body is plain JSON)
router.post('/process-s3', protect, processVideoFromS3);

// Accept image | file | video field names (status creator compatibility)
const pickUploadFile = (req, res, next) => {
  console.log('🔍 [MULTER-CHAIN] After multer.fields():', {
    hasFiles: !!req.files,
    filesKeys: req.files ? Object.keys(req.files) : 'none',
    fileDetails: req.files ? Object.entries(req.files).map(([k, arr]) => `${k}: ${arr?.length || 0} file(s)`).join(', ') : 'N/A',
    headers: {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
    }
  });
  req.file = req.files?.image?.[0] || req.files?.file?.[0] || req.files?.video?.[0] || null;
  next();
};

// @route   POST /api/upload/single
// @desc    Upload a single file (image/video) to S3 with server-side processing
// @access  Private
router.post(
  '/single',
  // Debug: log request BEFORE multer processes
  (req, res, next) => {
    console.log('🔍 [MULTER-BEFORE] Request headers:', {
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length'],
      transferEncoding: req.headers['transfer-encoding'],
    });
    next();
  },
  // Multer field parser
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  // Pick the uploaded file from any field
  pickUploadFile,
  // Upload to S3
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
