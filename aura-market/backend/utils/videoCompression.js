/**
 * Video Compression Utility
 * Optimizes videos for fast streaming on status
 *
 * Install ffmpeg first:
 * Windows: Download from ffmpeg.org
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const compressVideo = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i "${inputPath}" -vcodec libx264 -preset faster -b:v 1500k -maxrate 2000k -bufsize 4000k -acodec aac -b:a 128k -movflags +faststart -y "${outputPath}"`;

    console.log('[Video] Compressing:', path.basename(inputPath));

    exec(command, (error) => {
      if (error) {
        console.error('[Video] Compression failed:', error.message);
        reject(new Error(`Video compression failed: ${error.message}`));
        return;
      }

      const stats = fs.statSync(outputPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`✅ [Video] Compressed: ${sizeMB}MB`);

      resolve({
        success: true,
        path: outputPath,
        size: stats.size,
        sizeMB: parseFloat(sizeMB),
      });
    });
  });
};

const checkVideoQuality = async (filePath) => {
  try {
    const command = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,duration -of json "${filePath}"`;
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

module.exports = {
  compressVideo,
  checkVideoQuality,
};
