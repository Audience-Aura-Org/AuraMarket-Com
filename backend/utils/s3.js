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
  // Encode only the filename part, not folder slashes
  const parts = key.split('/');
  const encodedKey = parts.map(p => encodeURIComponent(p)).join('/');
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

async function uploadToS3(fileBuffer, fileName, folder = 'uploads', contentType = 'application/octet-stream') {
  if (!s3Client) {
    throw new Error('S3 is not enabled or not configured. Check AWS_S3_ENABLED in .env');
  }

  const timestamp = Date.now();
  const randomSuffix = Math.round(Math.random() * 1e9);
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileKey = `${folder}/${timestamp}-${randomSuffix}-${safeFileName}`;

  // Determine if this is a video for proper streaming headers
  const isVideo = contentType.startsWith('video/');

  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey,
    Body: fileBuffer,
    ContentType: contentType,
    // ✅ Critical for video streaming on mobile
    AcceptRanges: 'bytes',
    // ✅ Allow browsers to stream/seek video without full download
    CacheControl: isVideo ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    // ✅ Inline for browser playback, not download
    ContentDisposition: isVideo ? 'inline' : 'attachment',
    // NOTE: No ACL here — use bucket policy for public access.
    // Adding ACL: 'public-read' fails on buckets with Block Public ACLs enabled.
    Metadata: {
      'Uploaded-At': new Date().toISOString(),
      'Original-Name': safeFileName,
    },
  };

  try {
    const parallelUpload = new Upload({
      client: s3Client,
      params,
    });

    await parallelUpload.done();

    const url = buildPublicUrl(process.env.AWS_S3_BUCKET, REGION, fileKey);
    console.log(`✅ [S3] File uploaded successfully: ${fileKey}${isVideo ? ' (video with streaming headers)' : ''}`);
    return { success: true, url, key: fileKey, bucket: process.env.AWS_S3_BUCKET };
  } catch (error) {
    // Log full error for diagnosis (code, requestId, etc.)
    console.error(`❌ [S3] Upload failed for ${fileKey}:`, {
      code: error.Code || error.code || error.name,
      message: error.message,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
    });
    throw error;
  }
}

async function uploadMultipleToS3(fileBuffers, fileNames, folder = 'uploads', contentTypes = []) {
  if (!s3Client) throw new Error('S3 is not enabled or not configured');
  const uploads = fileBuffers.map((buffer, index) => 
    uploadToS3(buffer, fileNames[index], folder, contentTypes[index] || 'application/octet-stream')
  );
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
