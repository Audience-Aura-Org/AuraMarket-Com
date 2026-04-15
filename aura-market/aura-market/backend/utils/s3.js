/**
 * utils/s3.js
 * AWS SDK v3 implementation for S3 uploads (uses @aws-sdk/client-s3 and @aws-sdk/lib-storage)
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
require('dotenv').config();

const { AWS_S3_ENABLED } = require('../config/env');

const REGION = process.env.AWS_REGION || 'us-east-1';

let s3Client = null;
if (AWS_S3_ENABLED) {
  s3Client = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log('✅ [S3] AWS SDK v3 client initialized and ready for uploads');
}

function buildPublicUrl(bucket, region, key) {
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`;
}

async function uploadToS3(fileBuffer, fileName, folder = 'uploads', contentType = 'application/octet-stream') {
  if (!s3Client) {
    throw new Error('S3 is not enabled or not configured. Check AWS_S3_ENABLED in .env');
  }

  const timestamp = Date.now();
  const randomSuffix = Math.round(Math.random() * 1e9);
  const fileKey = `${folder}/${timestamp}-${randomSuffix}-${fileName}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey,
    Body: fileBuffer,
    ContentType: contentType,
    Metadata: {
      'Uploaded-At': new Date().toISOString(),
      'Original-Name': fileName,
    },
  };

  try {
    // Use the managed Upload helper (handles multipart uploads for large files)
    const parallelUpload = new Upload({
      client: s3Client,
      params,
    });

    const result = await parallelUpload.done();

    const url = buildPublicUrl(process.env.AWS_S3_BUCKET, REGION, fileKey);

    console.log(`✅ [S3] File uploaded successfully: ${fileKey}`);
    return {
      success: true,
      url,
      key: fileKey,
      bucket: process.env.AWS_S3_BUCKET,
      result,
    };
  } catch (error) {
    console.error(`❌ [S3] Upload failed for ${fileKey}:`, error.message || error);
    throw error;
  }
}

async function uploadMultipleToS3(fileBuffers, fileNames, folder = 'uploads', mimetypes = []) {
  if (!s3Client) throw new Error('S3 is not enabled or not configured');
  const uploads = fileBuffers.map((buffer, index) => {
    const mimetype = mimetypes[index] || 'application/octet-stream';
    return uploadToS3(buffer, fileNames[index], folder, mimetype);
  });
  return Promise.all(uploads);
}

function isS3Enabled() {
  return AWS_S3_ENABLED && s3Client !== null;
}

module.exports = {
  uploadToS3,
  uploadMultipleToS3,
  isS3Enabled,
};
