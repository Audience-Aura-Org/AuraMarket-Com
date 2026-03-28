/**
 * utils/storage.js
 * Multi-environment Storage Engine (Cloudinary with Local Fallback)
 * 🚀 Fixes the issue where Render wipes uploaded files on every deploy.
 */
const { 
  CLOUDINARY_CLOUD_NAME, 
  CLOUDINARY_API_KEY, 
  CLOUDINARY_API_SECRET 
} = require('../config/env');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. Cloudinary Integration (Persistent)
let engine;
const useCloudinary = CLOUDINARY_CLOUD_NAME && CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

if (useCloudinary) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });

  engine = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'aura-market',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'svg'],
      transformation: [{ width: 800, height: 800, crop: 'limit' }],
      public_id: (req, file) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        return `upload-${uniqueSuffix}`;
      }
    }
  });
  console.log('✅ [Storage] External Persistent Node (Cloudinary) CALIBRATED.');
} else {
  // 2. Local Storage Implementation (Ephemeral — files lost on Render deploy)
  console.warn('⚠️  [Storage] NO Cloudinary credentials found. Using Ephemeral Local Storage.');
  console.warn('👉  CRITICAL: Files uploaded will be WIPED on every Render restart/push.');
  
  const baseDir = 'uploads/';
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);

  engine = multer.diskStorage({
    destination: (req, file, cb) => {
      // 📂 Dynamic Sub-folder Logic: organizes by 'type' from req.body
      const subFolder = req.body.type || 'general';
      const finalPath = path.join(baseDir, subFolder);
      
      if (!fs.existsSync(finalPath)) {
        fs.mkdirSync(finalPath, { recursive: true });
      }
      cb(null, finalPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  });
}

// ── Master Multer Configuration ───────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Signal Intercepted: Standard images only (.jpg, .png, .webp)'), false);
  }
};

const upload = multer({ 
  storage: engine,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB Limit per file
});

module.exports = upload;
