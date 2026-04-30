/**
 * Media URL Configuration Utility
 * Switch between S3 and CloudFront URLs with environment variables
 * 
 * Usage:
 * const mediaUrl = getMediaUrl('statuses/video-123.mp4');
 * // Returns: https://cdn.example.com/statuses/video-123.mp4 (if CDN enabled)
 * // Or: https://bucket.s3.region.amazonaws.com/statuses/video-123.mp4 (if S3)
 */

/**
 * Get optimized URL for media files
 * Automatically uses CloudFront if configured, falls back to S3
 */
const getMediaUrl = (path) => {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  const s3Bucket = process.env.AWS_S3_BUCKET;
  const s3Region = process.env.AWS_REGION || 'eu-north-1';
  
  // Ensure path doesn't start with /
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Use CloudFront if configured
  if (cdnUrl) {
    return `https://${cdnUrl}/${cleanPath}`;
  }
  
  // Fallback to S3
  if (s3Bucket) {
    return `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${cleanPath}`;
  }
  
  // Last resort - relative path
  return `/${cleanPath}`;
};

/**
 * Get media URL for specific type (video, image, etc)
 */
const getMediaTypeUrl = (filename, type = 'general') => {
  return getMediaUrl(`${type}/${filename}`);
};

/**
 * Get video status URL (optimized for video streaming)
 */
const getVideoStatusUrl = (filename) => {
  return getMediaUrl(`statuses/${filename}`);
};

/**
 * Get image URL with optional size variant
 */
const getImageUrl = (filename, variant = null) => {
  const baseUrl = getMediaUrl(`images/${filename}`);
  return variant ? baseUrl.replace(/(\.[^.]+)$/, `-${variant}$1`) : baseUrl;
};

/**
 * Configuration information
 */
const getMediaConfig = () => {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  const s3Bucket = process.env.AWS_S3_BUCKET;
  const s3Region = process.env.AWS_REGION || 'eu-north-1';
  
  return {
    useCDN: !!cdnUrl,
    cdnUrl: cdnUrl || null,
    s3Bucket,
    s3Region,
    baseUrl: cdnUrl 
      ? `https://${cdnUrl}`
      : `https://${s3Bucket}.s3.${s3Region}.amazonaws.com`,
  };
};

// Frontend-safe export (no secrets exposed)
const getMediaConfigSafe = () => {
  const config = getMediaConfig();
  return {
    useCDN: config.useCDN,
    baseUrl: config.baseUrl,
  };
};

module.exports = {
  getMediaUrl,
  getMediaTypeUrl,
  getVideoStatusUrl,
  getImageUrl,
  getMediaConfig,
  getMediaConfigSafe,
};
