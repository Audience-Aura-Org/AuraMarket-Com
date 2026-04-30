/**
 * controllers/upload.controller.js
 * Handles file uploads directly to S3 with fallback to Cloudinary/Local
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { uploadToS3, uploadMultipleToS3, isS3Enabled } = require('../utils/s3');
const { compressVideo } = require('../utils/videoCompression');

async function maybeTranscodeVideoForWeb(file) {
  if (!file?.buffer || !file?.mimetype?.startsWith('video/')) {
    return {
      buffer: file?.buffer,
      originalname: file?.originalname,
      mimetype: file?.mimetype,
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

  try {
    fs.writeFileSync(inputPath, file.buffer);
    await compressVideo(inputPath, outputPath);
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
  console.log(`📦 [API] File received:`, {
    filename: req.file?.filename,
    originalname: req.file?.originalname,
    mimetype: req.file?.mimetype,
    size: req.file?.size,
    hasBuffer: !!req.file?.buffer,
  });
  
  if (!req.file) {
    console.error('❌ [API] No file provided in request');
    return res.status(400).json({ success: false, message: 'Please upload a file' });
  }

  try {
    let fileUrl = '';
    let uploadMethod = 'unknown';

    // 🚀 S3 Direct Upload (Persistent)
    if (isS3Enabled()) {
      const folder = req.body.type || 'general';
      console.log(`🚀 [API] Uploading to S3 with folder: ${folder}, mimetype: ${req.file.mimetype}`);
      const uploadPayload = await maybeTranscodeVideoForWeb(req.file);
      const s3Result = await uploadToS3(
        uploadPayload.buffer,
        uploadPayload.originalname,
        folder,
        uploadPayload.mimetype
      );
      fileUrl = s3Result.url;
      uploadMethod = 'S3';
      console.log(`✅ [API] S3 upload successful: ${fileUrl}`);
    }
    // Fallback: Cloudinary or Local
    else if (req.file.path && req.file.path.startsWith('http')) {
      fileUrl = req.file.path;
      uploadMethod = 'Cloudinary';
      console.log(`✅ [API] Cloudinary upload successful: ${fileUrl}`);
    }
    // Fallback: Local disk
    else if (req.file.path) {
      const normalizedPath = req.file.path.replace(/\\/g, '/');
      const uploadsIndex = normalizedPath.lastIndexOf('/uploads');
      if (uploadsIndex !== -1) {
        fileUrl = normalizedPath.substring(uploadsIndex);
      } else {
        fileUrl = `/uploads/${req.body.type || 'general'}/${req.file.filename}`;
      }
      uploadMethod = 'Local';
      console.log(`✅ [API] Local upload successful: ${fileUrl}`);
    } else {
      fileUrl = `/uploads/${req.body.type || 'general'}/${req.file.filename}`;
      uploadMethod = 'Local (filename only)';
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
    const uploadMethod = isS3Enabled() ? 'S3' : 'Local/Cloudinary';

    // 🚀 S3 Direct Upload (Persistent)
    if (isS3Enabled()) {
      const folder = req.body.type || 'others';
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
    // Fallback: Cloudinary or Local
    else {
      // ... (rest of local/cloudinary logic)
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
          method: 'Local/Cloudinary'
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

module.exports = {
  uploadSingle,
  uploadMultiple
};
