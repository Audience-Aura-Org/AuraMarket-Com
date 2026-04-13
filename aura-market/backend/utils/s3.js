/**
 * utils/s3.js
 * Direct AWS S3 upload handler with fallback support
 */

const AWS = require('aws-sdk');
require('dotenv').config();

const { AWS_S3_ENABLED } = require('../config/env');

let s3Instance = null;

// Initialize S3 if enabled
if (AWS_S3_ENABLED) {
  s3Instance = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });
  console.log('✅ [S3] AWS S3 client initialized and ready for uploads');
}

/**
 * Upload a single file to S3
 * @param {Buffer} fileBuffer - File content as buffer
 * @param {string} fileName - Original file name
 * @param {string} folder - S3 folder path (default: 'uploads')
 * @returns {Promise} S3 upload result with Location (public URL)
 */
async function uploadToS3(fileBuffer, fileName, folder = 'uploads') {
  if (!s3Instance) {
    throw new Error('S3 is not enabled or not configured. Check AWS_S3_ENABLED in .env');
  }

  const timestamp = Date.now();
  const randomSuffix = Math.round(Math.random() * 1e9);
  const fileKey = `${folder}/${timestamp}-${randomSuffix}-${fileName}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey,
    Body: fileBuffer,
    ContentType: 'application/octet-stream', // Will be overridden by multer
    // Note: ACL disabled - use bucket policy for public access instead
    Metadata: {
      'Uploaded-At': new Date().toISOString(),
      'Original-Name': fileName,
    },
  };

  try {
    const result = await s3Instance.upload(params).promise();
    console.log(`✅ [S3] File uploaded successfully: ${fileKey}`);
    return {
      success: true,
      url: result.Location, // Public S3 URL
      key: result.Key, // S3 object key
      bucket: result.Bucket,
      eTag: result.ETag,
    };
  } catch (error) {
    console.error(`❌ [S3] Upload failed for ${fileKey}:`, error.message);
    throw error;
  }
}

/**
 * Upload multiple files to S3
 * @param {Array<Buffer>} fileBuffers - Array of file buffers
 * @param {Array<string>} fileNames - Array of file names
 * @param {string} folder - S3 folder path
 * @returns {Promise<Array>} Array of S3 upload results
 */
async function uploadMultipleToS3(fileBuffers, fileNames, folder = 'uploads') {
  if (!s3Instance) {
    throw new Error('S3 is not enabled or not configured');
  }

  const uploads = fileBuffers.map((buffer, index) =>
    uploadToS3(buffer, fileNames[index], folder)
  );

  return Promise.all(uploads);
}

/**
 * Check if S3 is enabled
 */
function isS3Enabled() {
  return AWS_S3_ENABLED && s3Instance !== null;
}

module.exports = {
  uploadToS3,
  uploadMultipleToS3,
  isS3Enabled,
};
