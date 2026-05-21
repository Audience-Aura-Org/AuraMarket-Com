/**
 * utils/storage.js
 * Multi-environment Storage Engine (S3 > Local Fallback)
 * 🚀 Persistent storage for Vercel/AWS deployments
 */
const { 
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
  // Implement a lightweight multer storage engine that uploads directly
  // to S3 using AWS SDK v3 (@aws-sdk/client-s3 + @aws-sdk/lib-storage).
  const { S3Client } = require('@aws-sdk/client-s3');
  const { Upload } = require('@aws-sdk/lib-storage');

  const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  class MulterS3V3 {
    constructor(opts) {
      this.client = opts.client;
      this.bucket = opts.bucket;
      this.getKey = opts.getKey;
      this.getMetadata = opts.getMetadata;
    }

    _handleFile(req, file, cb) {
      (async () => {
        try {
          const subFolder = req.body.type || 'general';
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const filename = `${subFolder}/${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;

          const parallelUpload = new Upload({
            client: this.client,
            params: {
              Bucket: this.bucket,
              Key: filename,
              Body: file.stream,
              ContentType: file.mimetype,
              Metadata: this.getMetadata ? this.getMetadata(req, file) : undefined,
            },
          });

          const result = await parallelUpload.done();

          const region = AWS_REGION || 'us-east-1';
          const url = `https://${this.bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(filename)}`;

          // Provide multer-compatible file properties
          cb(null, {
            path: url,
            size: result?.$metadata?.httpStatusCode === 200 ? undefined : undefined,
            filename: filename.split('/').pop(),
            key: filename,
            location: url,
          });
        } catch (err) {
          cb(err);
        }
      })();
    }

    _removeFile(req, file, cb) {
      // No-op: we don't delete objects here. Implement if needed.
      cb(null);
    }
  }

  engine = new MulterS3V3({
    client: s3Client,
    bucket: AWS_S3_BUCKET,
    getMetadata: (req, file) => ({ fieldName: file.fieldname }),
  });

  console.log('✅ [Storage] AWS S3 Persistent Node CALIBRATED (v3).');
}
else {
  // 2. Local Storage Implementation (Ephemeral — files lost on Vercel/AWS deploy)
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
  console.warn('⚠️  [Storage] Using Ephemeral Local Storage (No S3 detected).');
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
