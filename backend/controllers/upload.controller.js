/**
 * controllers/upload.controller.js
 * Handles file uploads directly to S3 with local fallback
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const {
  uploadToS3,
  uploadMultipleToS3,
  createPresignedUpload,
  downloadFromS3,
  getS3Stream,
  isS3Enabled,
  normalizeS3Folder,
} = require('../utils/s3');
const { compressVideo, compressVideoForStatus, checkVideoQuality } = require('../utils/videoCompression');

const MB = 1024 * 1024;
const UPLOAD_LIMITS = {
  statuses: { video: 64 * MB, image: 8 * MB, file: 64 * MB },
  'status-sources': { video: 500 * MB, image: 8 * MB, file: 500 * MB },
  products: { image: 5 * MB, file: 5 * MB },
  product: { image: 5 * MB, file: 5 * MB },
  banners: { image: 5 * MB, file: 5 * MB },
  banner: { image: 5 * MB, file: 5 * MB },
  logos: { image: 5 * MB, file: 5 * MB },
  logo: { image: 5 * MB, file: 5 * MB },
  chat: { video: 10 * MB, image: 10 * MB, file: 10 * MB },
  'chat-media': { video: 10 * MB, image: 10 * MB, file: 10 * MB },
};

function enforceUploadSize({ folder = 'general', contentType = '', size = 0 }) {
  const normalizedFolder = normalizeS3Folder(folder);
  const numericSize = Number(size || 0);
  if (!numericSize) return;

  const mediaType = contentType.startsWith('video/')
    ? 'video'
    : contentType.startsWith('image/')
      ? 'image'
      : 'file';
  const folderLimits = UPLOAD_LIMITS[normalizedFolder];
  const limit = folderLimits?.[mediaType] || folderLimits?.file;
  if (!limit) return;

  if (numericSize > limit) {
    const limitMb = Math.round(limit / MB);
    throw new Error(`Max ${limitMb}MB ${normalizedFolder} ${mediaType}.`);
  }
}

const SKIP_TRANSCODE_MAX_BYTES = 28 * 1024 * 1024; // already-mp4 under ~28MB → upload as-is

async function maybeTranscodeVideoForWeb(file, folder = 'general', trimOptions = null, cropMode = 'crop') {
  if (!file?.buffer || !file?.mimetype?.startsWith('video/')) {
    return {
      buffer: file?.buffer,
      originalname: file?.originalname,
      mimetype: file?.mimetype,
    };
  }

  const isMp4 = file.mimetype === 'video/mp4' || /\.mp4$/i.test(file.originalname || '');
  if (isMp4 && file.buffer.length <= SKIP_TRANSCODE_MAX_BYTES && !trimOptions) {
    console.log(`🎬 [Video] Skipping transcode (${(file.buffer.length / 1024 / 1024).toFixed(1)}MB mp4)`);
    return {
      buffer: file.buffer,
      originalname: file.originalname?.replace(/\.[^.]+$/, '') + '.mp4' || 'video.mp4',
      mimetype: 'video/mp4',
    };
  }

  console.log(`🎬 [Video] Compressing for mobile playback...`);
  const originalSize = (file.buffer.length / 1024 / 1024).toFixed(2);
  console.log(`   Original size: ${originalSize}MB`);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-video-'));
  const inputPath = path.join(tmpDir, `in-${Date.now()}-${file.originalname || 'upload'}`);
  const outputBase = (file.originalname || 'video').replace(/\.[^.]+$/, '');
  const outputName = `${outputBase}-web.mp4`;
  const outputPath = path.join(tmpDir, `out-${Date.now()}-${outputName}`);
  const compressFn = (folder === 'statuses' || trimOptions) ? compressVideoForStatus : compressVideo;
  const outputFolder = trimOptions ? 'statuses' : folder;

  try {
    fs.writeFileSync(inputPath, file.buffer);
    if (outputFolder === 'statuses' && !trimOptions) {
      const quality = await checkVideoQuality(inputPath);
      if (quality?.duration && quality.duration > 31) {
        throw new Error('Status videos must be 30 seconds or less.');
      }
    }
    await compressFn(inputPath, outputPath, trimOptions, cropMode);
    const outBuffer = fs.readFileSync(outputPath);
    const compressedSize = (outBuffer.length / 1024 / 1024).toFixed(2);
    const reduction = (((file.buffer.length - outBuffer.length) / file.buffer.length) * 100).toFixed(0);
    console.log(`   ✅ Compressed: ${compressedSize}MB (${reduction}% reduction)`);
    return {
      buffer: outBuffer,
      originalname: outputName,
      mimetype: 'video/mp4',
    };
  } catch (err) {
    if (err.message?.includes('Status videos must be')) {
      throw err;
    }
    // If ffmpeg is unavailable or transcoding fails, gracefully fall back.
    console.warn(`⚠️  [Video] Compression failed: ${err.message}`);
    console.warn(`   Uploading uncompressed video (this will be slow on mobile!)`);
    console.warn(`   To fix: Install ffmpeg - see scripts/check-ffmpeg.js`);
    return {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

const uploadSingle = async (req, res) => {
  console.log(`📡 [API] Upload triggered - S3 Enabled: ${isS3Enabled()}`);
  console.log(`📦 [API] Request Headers:`, {
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    transferEncoding: req.headers['transfer-encoding'],
    authorization: req.headers.authorization ? 'Bearer ...' : 'NONE',
    allHeaders: Object.keys(req.headers).sort().join(', '),
  });
  console.log(`📦 [API] Request Method & Path:`, {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
  });
  console.log(`📦 [API] Multer Parse State:`, {
    hasFile: !!req.file,
    hasFiles: !!req.files,
    filesKeys: req.files ? Object.keys(req.files) : 'NONE',
    fileCount: req.files ? Object.values(req.files).reduce((sum, arr) => sum + (arr?.length || 0), 0) : 0,
    bodyFields: req.body ? Object.keys(req.body) : 'NO BODY',
  });
  console.log(`📦 [API] req.files value:`, JSON.stringify(req.files, null, 2));
  
  if (!req.file) {
    console.error('❌ [API] No file provided in request');
    console.error('❌ [API] Received fields:', req.files ? Object.keys(req.files) : 'no req.files object');
    return res.status(400).json({ success: false, message: 'Please upload a file' });
  }

  try {
    let fileUrl = '';
    let uploadMethod = 'unknown';

    // 🚀 S3 Direct Upload (Persistent)
    if (isS3Enabled()) {
      const folder = normalizeS3Folder(req.body.type || 'general');
      enforceUploadSize({ folder, contentType: req.file.mimetype, size: req.file.size || req.file.buffer?.length });
      console.log(`🚀 [API] Uploading to S3 with folder: ${folder}, mimetype: ${req.file.mimetype}`);

      const trimStart = Number(req.body.trimStart);
      const trimEnd = Number(req.body.trimEnd);
      const trimOptions = Number.isFinite(trimStart) && Number.isFinite(trimEnd)
        ? { start: trimStart, end: trimEnd }
        : null;
      const cropMode = req.body.cropMode || 'crop';

      const uploadPayload = await maybeTranscodeVideoForWeb(req.file, folder, trimOptions, cropMode);
      const outputFolder = trimOptions ? 'statuses' : folder;
      const s3Result = await uploadToS3(
        uploadPayload.buffer,
        uploadPayload.originalname,
        outputFolder,
        uploadPayload.mimetype
      );
      fileUrl = s3Result.url;
      uploadMethod = 'S3';
      console.log(`✅ [API] S3 upload successful: ${fileUrl}`);
    }
    // Fallback: external storage URL or local disk saving with transcode/trim support
    else {
      const folder = normalizeS3Folder(req.body.type || 'general');
      const trimStart = Number(req.body.trimStart);
      const trimEnd = Number(req.body.trimEnd);
      const trimOptions = Number.isFinite(trimStart) && Number.isFinite(trimEnd)
        ? { start: trimStart, end: trimEnd }
        : null;
      const cropMode = req.body.cropMode || 'crop';

      // Run video transcode/trim if video file
      const uploadPayload = await maybeTranscodeVideoForWeb(req.file, folder, trimOptions, cropMode);
      
      const uploadDir = path.join(__dirname, '..', 'uploads', folder);
      // Ensure directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const timestamp = Date.now();
      const ext = path.extname(uploadPayload.originalname || req.file.originalname || '.jpg');
      const filename = `${timestamp}-${Math.round(Math.random() * 1e9)}${ext}`;
      const targetPath = path.join(uploadDir, filename);

      // Write buffer to local disk
      fs.writeFileSync(targetPath, uploadPayload.buffer || req.file.buffer);

      fileUrl = `/uploads/${folder}/${filename}`;
      uploadMethod = 'Local (saved + trimmed)';
      console.log(`✅ [API] Local upload saved & trimmed: ${fileUrl}`);
    }

    res.status(200).json({
      success: true,
      data: {
        url: fileUrl,
        filename: req.file.filename,
        mimetype: req.file.mimetype?.startsWith('video/') ? 'video/mp4' : req.file.mimetype,
        size: req.file.size,
        method: uploadMethod,
      }
    });
  } catch (err) {
    const errorCode = err.Code || err.code || err.name || 'UnknownError';
    const s3Status = err.$metadata?.httpStatusCode;
    console.error(`❌ [API] Upload failed [${errorCode}]:`, err.message);
    console.error(`❌ [API] Error stack:`, err.stack);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      code: errorCode,
      ...(s3Status && { s3Status }),
    });
  }
};

const uploadMultiple = async (req, res) => {
  console.log(`📡 [API] Batch upload triggered - S3 Enabled: ${isS3Enabled()}`);
  console.log(`📦 [API] Files received:`, req.files?.length || 0);
  
  if (!req.files || req.files.length === 0) {
    console.error('❌ [API] No files provided in request');
    return res.status(400).json({ success: false, message: 'Please upload files' });
  }

  try {
    const urls = [];
    const uploadMethod = isS3Enabled() ? 'S3' : 'Local';

    // 🚀 S3 Direct Upload (Persistent)
    if (isS3Enabled()) {
      const folder = normalizeS3Folder(req.body.type || 'others');
      req.files.forEach((file) => enforceUploadSize({
        folder,
        contentType: file.mimetype,
        size: file.size || file.buffer?.length,
      }));
      const fileBuffers = req.files.map(f => f.buffer);
      const fileNames = req.files.map(f => f.originalname);
      const mimetypes = req.files.map(f => f.mimetype);
      
      console.log(`🚀 [API] Uploading ${fileNames.length} files to S3 with folder: ${folder}`);
      const s3Results = await uploadMultipleToS3(fileBuffers, fileNames, folder, mimetypes);
      s3Results.forEach(result => {
        urls.push({
          url: result.url,
          filename: result.key.split('/').pop(),
          method: 'S3'
        });
      });
      console.log(`✅ [API] ${urls.length} files uploaded to S3`);
    }
    // Fallback: external storage URL or local disk
    else {
      req.files.forEach(file => {
        let fileUrl = '';
        
        if (file.path && file.path.startsWith('http')) {
          fileUrl = file.path;
        } else if (file.path) {
          const normalizedPath = file.path.replace(/\\/g, '/');
          const uploadsIndex = normalizedPath.lastIndexOf('/uploads');
          if (uploadsIndex !== -1) {
            fileUrl = normalizedPath.substring(uploadsIndex);
          } else {
            fileUrl = `/uploads/${req.body.type || 'others'}/${file.filename}`;
          }
        } else {
          fileUrl = `/uploads/${req.body.type || 'others'}/${file.filename}`;
        }
        
        urls.push({
          url: fileUrl,
          filename: file.filename,
          method: file.path && file.path.startsWith('http') ? 'External' : 'Local'
        });
      });
    }

    res.status(200).json({
      success: true,
      data: { 
        urls,
        count: urls.length,
        uploadMethod
      }
    });
  } catch (err) {
    const errorCode = err.Code || err.code || err.name || 'UnknownError';
    const s3Status = err.$metadata?.httpStatusCode;
    console.error(`❌ [API] Batch upload failed [${errorCode}]:`, err.message);
    console.error(`❌ [API] Error stack:`, err.stack);
    res.status(500).json({
      success: false,
      message: 'Batch upload failed',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      code: errorCode,
      ...(s3Status && { s3Status }),
    });
  }
};

/** @route POST /api/upload/presign — direct browser → S3 (fast path for status videos) */
const presignUpload = async (req, res) => {
  try {
    if (!isS3Enabled()) {
      return res.status(503).json({
        success: false,
        message: 'Direct upload unavailable. S3 is not configured — use /upload/single instead.',
        fallback: 'single',
      });
    }

    const { fileName, contentType, fileSize, type: rawFolder = 'statuses' } = req.body;
    const folder = normalizeS3Folder(rawFolder || 'statuses');
    if (!fileName || !contentType) {
      return res.status(400).json({ success: false, message: 'fileName and contentType are required.' });
    }
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      return res.status(400).json({ success: false, message: 'Only image and video uploads are allowed.' });
    }
    enforceUploadSize({ folder, contentType, size: fileSize });

    const result = await createPresignedUpload({
      fileName,
      folder,
      contentType,
    });

    return res.status(200).json({
      success: true,
      data: {
        uploadUrl: result.uploadUrl,
        url: result.publicUrl,
        key: result.key,
        method: 'PUT',
      },
    });
  } catch (err) {
    console.error('❌ [API] Presign failed:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @route POST /api/upload/process-s3
 * @desc  Server-side trim + transcode a video already uploaded to S3 via presigned PUT.
 *        Accepts { key, trimStart, trimEnd, cropMode }.
 *        Downloads the source from status-sources/, runs ffmpeg, re-uploads to statuses/.
 * @access Private
 */
const processVideoFromS3 = async (req, res) => {
  const { key, trimStart, trimEnd, cropMode = 'crop' } = req.body;

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ success: false, message: 'S3 key is required.' });
  }
  // Security: only allow keys from the status-sources folder
  if (!key.startsWith('status-sources/')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid key. Only status-sources objects may be processed.',
    });
  }
  if (!isS3Enabled()) {
    return res.status(503).json({ success: false, message: 'S3 is not enabled on this server.' });
  }

  try {
    // Stream S3 object directly to a temp file — avoids allocating a full in-memory
    // Buffer (~7.8MB RAM saved per upload). Bytes are written to disk as they arrive.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-s3trim-'));
    const fileName = key.split('/').pop() || 'video.mp4';
    const inputPath = path.join(tmpDir, `in-${Date.now()}-${fileName}`);
    const outputName = fileName.replace(/\.[^.]+$/, '') + '-trimmed.mp4';
    const outputPath = path.join(tmpDir, `out-${Date.now()}-${outputName}`);

    try {
      console.log(`🎬 [API] process-s3: Streaming source from S3 to disk: ${key}`);
      const s3Stream = await getS3Stream(key);
      await pipeline(s3Stream, fs.createWriteStream(inputPath));

      const inputSizeMB = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(1);
      console.log(`🎬 [API] process-s3: Wrote ${inputSizeMB}MB to disk, starting ffmpeg...`);

      const trimOptions =
        Number.isFinite(Number(trimStart)) && Number.isFinite(Number(trimEnd))
          ? { start: Number(trimStart), end: Number(trimEnd) }
          : null;

      await compressVideoForStatus(inputPath, outputPath, trimOptions, cropMode);

      const outBuffer = fs.readFileSync(outputPath);
      const s3Result = await uploadToS3(outBuffer, outputName, 'statuses', 'video/mp4');

      console.log(`✅ [API] process-s3: Trimmed video uploaded: ${s3Result.url}`);

      return res.status(200).json({
        success: true,
        data: { url: s3Result.url, method: 'S3-trim', mimetype: 'video/mp4' },
      });
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  } catch (err) {
    const errorCode = err.Code || err.code || err.name || 'UnknownError';
    console.error(`❌ [API] process-s3 failed [${errorCode}]:`, err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Video processing failed.',
      code: errorCode,
    });
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  presignUpload,
  processVideoFromS3,
};

