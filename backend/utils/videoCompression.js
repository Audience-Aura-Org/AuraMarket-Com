/**
 * Video Compression Utility
 * Optimizes videos for fast streaming on status
 * Uses ffmpeg-static for self-contained execution
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const ffmpeg = require('ffmpeg-static');

const execAsync = promisify(exec);

/** Status stories — WhatsApp-style: 9:16 center crop, 60s max, 720p */
const STATUS_VIDEO_MAX_SECONDS = 60;

const trimAndCompressStatusVideo = async (inputPath, outputPath, { start = 0, end = STATUS_VIDEO_MAX_SECONDS } = {}, cropMode = 'crop') => {
  const clipDuration = Math.min(
    STATUS_VIDEO_MAX_SECONDS,
    Math.max(0.5, Number(end) - Number(start))
  );
  const seekStart = Math.max(0, Number(start) || 0);

  // Generate ffmpeg filter based on cropMode
  const videoFilter = cropMode === 'fit'
    ? 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black'
    : 'scale=w=720:h=1280:force_original_aspect_ratio=increase,crop=720:1280';

  return new Promise((resolve, reject) => {
    const command = `"${ffmpeg}" -ss ${seekStart} -i "${inputPath}" \
      -t ${clipDuration} \
      -vf "${videoFilter}" \
      -vcodec libx264 \
      -preset ultrafast \
      -b:v 1200k \
      -maxrate 1500k \
      -bufsize 3000k \
      -acodec aac \
      -b:a 96k \
      -movflags +faststart \
      -y \
      "${outputPath}"`;

    exec(command, { timeout: 120000 }, (error) => {
      if (error) {
        reject(new Error(`Status video trim failed: ${error.message}`));
        return;
      }
      const stats = fs.statSync(outputPath);
      resolve({
        success: true,
        path: outputPath,
        size: stats.size,
        sizeMB: parseFloat((stats.size / 1024 / 1024).toFixed(2)),
      });
    });
  });
};

const compressVideoForStatus = async (inputPath, outputPath, trimOptions = null, cropMode = 'crop') => {
  if (trimOptions) {
    return trimAndCompressStatusVideo(inputPath, outputPath, trimOptions, cropMode);
  }

  // Generate ffmpeg filter based on cropMode
  const videoFilter = cropMode === 'fit'
    ? 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black'
    : 'scale=w=720:h=1280:force_original_aspect_ratio=increase,crop=720:1280';

  return new Promise((resolve, reject) => {
    const command = `"${ffmpeg}" -i "${inputPath}" \
      -t ${STATUS_VIDEO_MAX_SECONDS} \
      -vf "${videoFilter}" \
      -vcodec libx264 \
      -preset ultrafast \
      -b:v 1200k \
      -maxrate 1500k \
      -bufsize 3000k \
      -acodec aac \
      -b:a 96k \
      -movflags +faststart \
      -y \
      "${outputPath}"`;

    exec(command, { timeout: 120000 }, (error) => {
      if (error) {
        reject(new Error(`Status video compression failed: ${error.message}`));
        return;
      }
      const stats = fs.statSync(outputPath);
      resolve({
        success: true,
        path: outputPath,
        size: stats.size,
        sizeMB: parseFloat((stats.size / 1024 / 1024).toFixed(2)),
      });
    });
  });
};

const compressVideo = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const command = `"${ffmpeg}" -i "${inputPath}" \
      -vcodec libx264 \
      -preset faster \
      -b:v 1500k \
      -maxrate 2000k \
      -bufsize 4000k \
      -acodec aac \
      -b:a 128k \
      -movflags +faststart \
      -y \
      "${outputPath}"`;

    console.log('[Video] Compressing:', path.basename(inputPath));
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('[Video] Compression failed:', error.message);
        reject(new Error(`Video compression failed: ${error.message}`));
        return;
      }

      // Get file size
      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`✅ [Video] Compressed: ${sizeMB}MB`);
      
      resolve({
        success: true,
        path: outputPath,
        size: stats.size,
        sizeMB: parseFloat(sizeMB)
      });
    });
  });
};

/**
 * Quick quality check for video (falls back to parsing ffmpeg output if ffprobe is missing)
 */
const checkVideoQuality = async (filePath) => {
  try {
    const command = `ffprobe -v error -select_streams v:0 \
      -show_entries stream=codec_name,width,height,duration \
      -of json "${filePath}"`;
    
    const { stdout } = await execAsync(command);
    const data = JSON.parse(stdout);
    
    if (data.streams && data.streams[0]) {
      const stream = data.streams[0];
      return {
        codec: stream.codec_name,
        width: stream.width,
        height: stream.height,
        duration: parseFloat(stream.duration),
      };
    }
    
    throw new Error('No video stream found');
  } catch (error) {
    console.log('[Video] ffprobe is not available, attempting ffmpeg parser fallback');
  }

  // Fallback: parse ffmpeg output for duration
  try {
    const command = `"${ffmpeg}" -i "${filePath}"`;
    let info = '';
    try {
      await execAsync(command);
    } catch (err) {
      info = err.stderr || err.message || '';
    }

    const match = info.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/i);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const ms = parseInt(match[4], 10);
      const duration = hours * 3600 + minutes * 60 + seconds + ms / 100;
      return {
        codec: 'unknown',
        width: 720,
        height: 1280,
        duration,
      };
    }
  } catch (err) {
    console.error('[Video] ffmpeg fallback check failed:', err.message);
  }
  return null;
};

/**
 * Generate thumbnail from video
 * Extracts frame at 2 seconds
 */
const generateThumbnail = async (videoPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const command = `"${ffmpeg}" -i "${videoPath}" \
      -ss 2 \
      -vframes 1 \
      -vf "scale=320:180:force_original_aspect_ratio=decrease" \
      -y \
      "${outputPath}"`;

    exec(command, (error) => {
      if (error) {
        console.error('[Video] Thumbnail generation failed:', error.message);
        reject(error);
        return;
      }
      
      console.log(`✅ [Video] Thumbnail generated: ${outputPath}`);
      resolve(outputPath);
    });
  });
};

module.exports = {
  compressVideo,
  compressVideoForStatus,
  trimAndCompressStatusVideo,
  checkVideoQuality,
  generateThumbnail,
};
