/**
 * utils/storage.js
 * Multi-environment Storage Engine (S3 > Cloudinary > Local Fallback)
 * 🚀 Persistent storage for Vercel/AWS deployments
 */
const { 
  CLOUDINARY_CLOUD_NAME, 
  CLOUDINARY_API_KEY, 
  CLOUDINARY_API_SECRET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET,
  AWS_S3_ENABLED
} = require('../config/env');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. AWS S3 Integration (Most Persistent)
let engine;
const useS3 = AWS_S3_ENABLED && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_S3_BUCKET;

if (useS3) {
  const AWS = require('aws-sdk');
  const multerS3 = require('multer-s3');

  const s3 = new AWS.S3({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION
  });

  engine = multerS3({
    s3: s3,
    bucket: AWS_S3_BUCKET,
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      const subFolder = req.body.type || 'general';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const fileName = `${subFolder}/${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;
      cb(null, fileName);
    }
  });
  console.log('✅ [Storage] AWS S3 Persistent Node CALIBRATED.');
}
// 2. Cloudinary Integration (Persistent)
else if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_CLOUD_NAME !== 'your_cloud_name') {
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
  console.log('✅ [Storage] Cloudinary Persistent Node CALIBRATED.');
}
else {
  // 3. Local Storage Implementation (Ephemeral — files lost on Vercel/AWS deploy)
  const baseDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(baseDir)) {
     fs.mkdirSync(baseDir, { recursive: true });
     console.log(`📡 [Storage] Initialized Node Landing Zone: ${baseDir}`);
  }

  engine = multer.diskStorage({
    destination: (req, file, cb) => {
      // 📂 Dynamic Sub-folder Logic: organizes by 'type' from req.body
      const subFolder = req.body.type || 'general';
      const finalPath = path.join(baseDir, subFolder);
      
      try {
        if (!fs.existsSync(finalPath)) {
          fs.mkdirSync(finalPath, { recursive: true });
          console.log(`📁 [Storage] Created category sector: ${subFolder}`);
        }
        cb(null, finalPath);
      } catch (err) {
        console.error(`❌ [Storage] Partition creation fail: ${err.message}`);
        cb(null, baseDir); // Fallback to root
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const name = `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;
      console.log(`📦 [Storage] Indexing asset: ${name}`);
      cb(null, name);
    }
  });
  console.warn('⚠️  [Storage] Using Ephemeral Local Storage (No S3 or Cloudinary detected).');
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
