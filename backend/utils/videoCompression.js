/**
 * Video Compression Utility
 * Optimizes videos for fast streaming on status
 * 
 * Usage:
 * const compressed = await compressVideo(inputPath, outputPath);
 * 
 * Install ffmpeg first:
 * macOS: brew install ffmpeg
 * Ubuntu: sudo apt-get install ffmpeg
 * Windows: Download from ffmpeg.org
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Compress video for streaming
 * Target: 1.5 Mbps bitrate, H.264 codec, AAC audio
 * Result: ~5-10MB for typical 30-60s video
 */
/** Status stories — WhatsApp-style: 9:16 center crop, 30s max, 720p */
const STATUS_VIDEO_MAX_SECONDS = 30;

const compressVideoForStatus = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i "${inputPath}" \
      -t ${STATUS_VIDEO_MAX_SECONDS} \
      -vf "scale=w=720:h=1280:force_original_aspect_ratio=increase,crop=720:1280" \
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
    const command = `ffmpeg -i "${inputPath}" \
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
 * Quick quality check for video
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
    console.error('[Video] Quality check failed:', error.message);
    return null;
  }
};

/**
 * Generate thumbnail from video
 * Extracts frame at 2 seconds
 */
const generateThumbnail = async (videoPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i "${videoPath}" \
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
  checkVideoQuality,
  generateThumbnail,
};

// Example usage (uncomment to test):
/*
(async () => {
  try {
    const inputVideo = './test-video.mp4';
    const outputVideo = './test-video-compressed.mp4';
    
    // Check original quality
    const original = await checkVideoQuality(inputVideo);
    console.log('Original:', original);
    
    // Compress
    const result = await compressVideo(inputVideo, outputVideo);
    console.log('Compressed:', result);
    
    // Generate thumbnail
    await generateThumbnail(outputVideo, './thumbnail.jpg');
  } catch (error) {
    console.error('Error:', error);
  }
})();
*/
