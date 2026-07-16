/**
 * nativeVideoCapture.js
 *
 * Thin JavaScript wrapper around the native VideoFramePlugin (Android).
 * On web (non-native) all functions return null / throw — callers must check
 * isNativeVideoPickerAvailable() before use.
 *
 * Plugin methods:
 *   pickVideo(count, quality, maxWidth)
 *     → { uri, displayName, size, mimeType, duration, durationMs, width, height, frames[] }
 *
 *   getFrames(uri, count, durationMs, quality, maxWidth)
 *     → { frames: string[] }   (JPEG data-URLs)
 *
 *   getFrame(uri, timeMs, quality, maxWidth)
 *     → { frame: string }      (single JPEG data-URL)
 */

import { Capacitor } from '@capacitor/core';

function getPlugin() {
  if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) return null;
  return Capacitor.Plugins?.VideoFrame ?? null;
}

/** True when the native VideoFrame plugin is registered and ready. */
export function isNativeVideoPickerAvailable() {
  return getPlugin() !== null;
}

/**
 * Open the system video picker and extract filmstrip frames in one native call.
 *
 * @param {{ count?: number, quality?: number, maxWidth?: number }} options
 * @returns {Promise<{
 *   uri: string,
 *   displayName: string,
 *   size: number,
 *   mimeType: string,
 *   duration: number,
 *   durationMs: number,
 *   width: number,
 *   height: number,
 *   frames: string[]
 * }>}
 */
export async function pickNativeVideo(options = {}) {
  const plugin = getPlugin();
  if (!plugin) throw new Error('VideoFrame plugin not available on this platform');
  const { count = 8, quality = 72, maxWidth = 320 } = options;
  return plugin.pickVideo({ count, quality, maxWidth });
}

/**
 * Re-extract filmstrip frames from an already-picked content URI.
 *
 * @param {string} uri              content:// URI returned by pickNativeVideo
 * @param {{ count?, durationMs?, quality?, maxWidth? }} options
 * @returns {Promise<{ frames: string[] }>}
 */
export async function getNativeFilmstripFrames(uri, options = {}) {
  const plugin = getPlugin();
  if (!plugin) throw new Error('VideoFrame plugin not available on this platform');
  const { count = 8, durationMs = 0, quality = 72, maxWidth = 320 } = options;
  return plugin.getFrames({ uri, count, durationMs, quality, maxWidth });
}

/**
 * Get a single video frame at a specific timestamp.
 *
 * @param {string} uri       content:// URI
 * @param {number} timeMs    position in milliseconds
 * @param {{ quality?, maxWidth? }} options
 * @returns {Promise<{ frame: string }>}   JPEG data-URL
 */
export async function getNativeVideoFrame(uri, timeMs, options = {}) {
  const plugin = getPlugin();
  if (!plugin) throw new Error('VideoFrame plugin not available on this platform');
  const { quality = 80, maxWidth = 480 } = options;
  return plugin.getFrame({ uri, timeMs, quality, maxWidth });
}
