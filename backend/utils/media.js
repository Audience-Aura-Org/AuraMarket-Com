/**
 * utils/media.js
 * Helper to normalize media URLs (avatar, branding) so clients always
 * receive absolute URLs regardless of storage backend (S3, Cloudinary, Local).
 */
const { AWS_S3_ENABLED, AWS_S3_BUCKET, AWS_REGION } = require('../config/env');

function buildS3Url(key) {
  if (!AWS_S3_BUCKET) return null;
  const region = AWS_REGION || 'us-east-1';
  // Ensure key has no leading slash
  const normalizedKey = key.replace(/^\/+/, '');
  return `https://${AWS_S3_BUCKET}.s3.${region}.amazonaws.com/${encodeURIComponent(normalizedKey)}`;
}

function normalizeMediaUrl(value) {
  if (!value) return value;
  if (typeof value !== 'string') return value;
  // Already an absolute URL
  if (/^https?:\/\//i.test(value)) return value;

  // If value looks like a local uploads path but S3 is enabled, build S3 public URL
  if (AWS_S3_ENABLED && /uploads\//.test(value)) {
    // remove leading slash if present
    const key = value.replace(/^\/+/, '');
    return buildS3Url(key);
  }

  // Otherwise return as-is (may be a relative path served by the API)
  return value;
}

function normalizeUserMedia(userObj) {
  if (!userObj) return userObj;
  try {
    if (userObj.avatar) userObj.avatar = normalizeMediaUrl(userObj.avatar);
    if (userObj.branding) {
      if (userObj.branding.logo) userObj.branding.logo = normalizeMediaUrl(userObj.branding.logo);
      if (userObj.branding.banner) userObj.branding.banner = normalizeMediaUrl(userObj.branding.banner);
    }
  } catch (err) {
    // no-op on normalization errors
  }
  return userObj;
}

module.exports = { normalizeMediaUrl, normalizeUserMedia };
