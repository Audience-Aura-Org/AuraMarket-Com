/**
 * utils/s3.js
 * AWS SDK v3 implementation for S3 uploads (uses @aws-sdk/client-s3 and @aws-sdk/lib-storage)
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
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

function normalizeS3Folder(folder = 'uploads') {
  const raw = String(folder || 'uploads').trim().toLowerCase();
  if (['status-source', 'status-sources', 'statuses-source', 'story-source', 'story-sources', 'story-original', 'status-original'].includes(raw)) {
    return 'status-sources';
  }
  if (['status', 'statuses', 'story', 'stories', 'aura-story', 'aurastory'].includes(raw)) {
    return 'statuses';
  }
  return raw.replace(/[^a-z0-9/_-]/g, '-').replace(/\/+/g, '/').replace(/^\/|\/$/g, '') || 'uploads';
}

function cacheControlForUpload(folder, contentType = '') {
  const normalizedFolder = normalizeS3Folder(folder);
  const isStatusMedia = normalizedFolder === 'statuses' || normalizedFolder === 'status-sources';
  const isVideo = contentType.startsWith('video/');

  if (isStatusMedia) {
    return 'public, max-age=259200';
  }

  return isVideo ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
}

async function uploadToS3(fileBuffer, fileName, folder = 'uploads', contentType = 'application/octet-stream') {
  if (!s3Client) {
    throw new Error('S3 is not enabled or not configured. Check AWS_S3_ENABLED in .env');
  }

  const timestamp = Date.now();
  const randomSuffix = Math.round(Math.random() * 1e9);
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const normalizedFolder = normalizeS3Folder(folder);
  const fileKey = `${normalizedFolder}/${timestamp}-${randomSuffix}-${safeFileName}`;

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
    CacheControl: cacheControlForUpload(normalizedFolder, contentType),
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
      queueSize: 4,
      partSize: 8 * 1024 * 1024,
      leavePartsOnError: false,
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

/**
 * Presigned PUT URL — browser uploads directly to S3 (fastest; bypasses API body limits).
 */
async function createPresignedUpload({ fileName, folder = 'uploads', contentType = 'application/octet-stream' }) {
  if (!s3Client) {
    throw new Error('S3 is not enabled or not configured.');
  }

  const timestamp = Date.now();
  const randomSuffix = Math.round(Math.random() * 1e9);
  const safeFileName = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const normalizedFolder = normalizeS3Folder(folder);
  const fileKey = `${normalizedFolder}/${timestamp}-${randomSuffix}-${safeFileName}`;
  const isVideo = contentType.startsWith('video/');

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey,
    ContentType: contentType,
    CacheControl: cacheControlForUpload(normalizedFolder, contentType),
    ContentDisposition: isVideo ? 'inline' : 'attachment',
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  const publicUrl = buildPublicUrl(process.env.AWS_S3_BUCKET, REGION, fileKey);

  return { uploadUrl, publicUrl, key: fileKey, bucket: process.env.AWS_S3_BUCKET };
}

function extractS3KeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
    return key || null;
  } catch {
    const statusesIndex = url.indexOf('statuses/');
    if (statusesIndex === -1) return null;
    return decodeURIComponent(url.slice(statusesIndex));
  }
}

async function deleteS3ObjectByUrl(url, { allowedPrefix = 'statuses/' } = {}) {
  if (!s3Client || !process.env.AWS_S3_BUCKET) {
    return { success: false, skipped: true, reason: 'S3 is not configured.' };
  }

  const key = extractS3KeyFromUrl(url);
  const allowedPrefixes = Array.isArray(allowedPrefix) ? allowedPrefix : [allowedPrefix];
  const hasAllowedPrefix = allowedPrefixes
    .filter(Boolean)
    .some((prefix) => key?.startsWith(prefix));
  if (!key || (allowedPrefixes.some(Boolean) && !hasAllowedPrefix)) {
    return { success: false, skipped: true, reason: 'URL is not an allowed temporary S3 object.' };
  }

  await s3Client.send(new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  }));

  return { success: true, key };
}

/**
 * Download an S3 object as a Buffer (used by process-s3 endpoint for server-side trim).
 */
async function downloadFromS3(key) {
  if (!s3Client) throw new Error('S3 is not enabled or not configured.');

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  });

  const response = await s3Client.send(command);

  // AWS SDK v3 returns Body as a Node.js Readable stream
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

module.exports = {
  uploadToS3,
  uploadMultipleToS3,
  createPresignedUpload,
  downloadFromS3,
  deleteS3ObjectByUrl,
  normalizeS3Folder,
  isS3Enabled,
};
