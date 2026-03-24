const express = require('express');
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/auth.middleware');
const { uploadSingle, uploadMultiple } = require('../controllers/upload.controller');

const router = express.Router();

// 1. Configure Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 2. File Filter (Optional: restring to images)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit
});

// 3. Define Routes
// Protect uploads so only registered users can upload files
router.use(protect);

router.post('/single', upload.single('image'), uploadSingle);
router.post('/multiple', upload.array('images', 5), uploadMultiple);

module.exports = router;
