#!/usr/bin/env node
/**
 * check-ffmpeg.js
 * Verifies ffmpeg is installed and accessible
 * Run: node scripts/check-ffmpeg.js
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function checkFFmpeg() {
  console.log('\n🔍 Checking FFmpeg Installation...\n');

  try {
    // Check ffmpeg version
    const { stdout: ffmpegVersion } = await execAsync('ffmpeg -version');
    const version = ffmpegVersion.split('\n')[0];
    console.log(`✅ FFmpeg installed: ${version}`);

    // Check ffprobe version
    const { stdout: ffprobeVersion } = await execAsync('ffprobe -version');
    const probeVersion = ffprobeVersion.split('\n')[0];
    console.log(`✅ FFprobe installed: ${probeVersion}`);

    console.log('\n✅ Video compression will work! Status videos will be optimized for mobile.');
    console.log('\nExpected video size: ~2-5MB per minute (vs 50-100MB uncompressed)');
    console.log('Expected playback: Smooth on mobile 3G/4G networks\n');
    return true;
  } catch (error) {
    console.error('❌ FFmpeg not found!\n');
    console.error('Video compression is disabled. Videos will upload uncompressed, which causes:');
    console.error('  • Slow loading on mobile');
    console.error('  • Large file sizes (50-100MB)');
    console.error('  • Buffering and stopping playback\n');

    console.log('📦 Install FFmpeg:\n');
    
    const os = process.platform;
    if (os === 'darwin') {
      console.log('macOS (Homebrew):');
      console.log('  brew install ffmpeg\n');
    } else if (os === 'linux') {
      console.log('Ubuntu/Debian:');
      console.log('  sudo apt-get update');
      console.log('  sudo apt-get install ffmpeg\n');
      console.log('Red Hat/CentOS:');
      console.log('  sudo yum install ffmpeg\n');
    } else if (os === 'win32') {
      console.log('Windows:');
      console.log('  1. Download from: https://ffmpeg.org/download.html');
      console.log('  2. Extract to: C:\\ffmpeg');
      console.log('  3. Add to PATH environment variable\n');
      console.log('  Or use Chocolatey:');
      console.log('  choco install ffmpeg\n');
    }

    console.log('After installation, run this script again to verify.\n');
    return false;
  }
}

checkFFmpeg().then(success => {
  process.exit(success ? 0 : 1);
});
