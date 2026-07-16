/**
 * nativeVideoPlayer.js
 *
 * Thin JavaScript wrapper around NativeVideoPlayerPlugin (Android).
 * All functions are no-ops / throw when not on native — callers guard
 * with isNativePlayerAvailable() or isNativePlatform() checks.
 *
 * Plugin events (add listeners via addNativePlayerListener):
 *   "timeUpdate"     { currentTime: number }   — every ~100 ms
 *   "stateChange"    { playing: boolean }       — play / pause changes
 *   "durationUpdate" { duration: number }       — after media is ready
 *   "error"          { message: string }        — playback error
 */

import { Capacitor } from '@capacitor/core';

function plugin() {
  if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform()) return null;
  return Capacitor.Plugins?.NativeVideoPlayer ?? null;
}

/** True when the NativeVideoPlayer plugin is available on this device. */
export const isNativePlayerAvailable = () => plugin() !== null;

/**
 * Create the ExoPlayer + TextureView overlay at the given screen rectangle.
 * Coordinates must be in PHYSICAL pixels (CSS rect × devicePixelRatio).
 *
 * @param {{ x: number, y: number, width: number, height: number, muted?: boolean }}
 */
export async function createNativePlayer({ x, y, width, height, muted = true }) {
  return plugin().create({
    x: Math.round(x), y: Math.round(y),
    width: Math.round(width), height: Math.round(height),
    muted,
  });
}

/** Load a content:// video URI and prepare ExoPlayer. */
export async function setNativeSource(uri) {
  return plugin().setSource({ uri });
}

export async function playNative()           { return plugin().play(); }
export async function pauseNative()          { return plugin().pause(); }

/** Seek to `timeMs` milliseconds (clamped to trim range inside Java). */
export async function seekNative(timeMs)     { return plugin().seek({ timeMs: Math.round(timeMs) }); }

export async function setNativeMuted(muted)  { return plugin().setMuted({ muted }); }

/**
 * Update the trim loop range without reloading the media.
 * Java's 100 ms Handler loop seeks back to startMs when pos ≥ endMs - 250 ms.
 */
export async function setNativeTrimRange(startMs, endMs) {
  return plugin().setTrimRange({
    startMs: Math.round(startMs),
    endMs:   Math.round(endMs),
  });
}

/**
 * Reposition the TextureView overlay — call on orientation change or layout shift.
 * Coordinates must be in physical pixels.
 */
export async function updateNativeBounds({ x, y, width, height }) {
  return plugin().updateBounds({
    x: Math.round(x), y: Math.round(y),
    width: Math.round(width), height: Math.round(height),
  });
}

/** Release ExoPlayer and remove the overlay from the screen. */
export async function destroyNativePlayer() {
  return plugin()?.destroy?.();
}

/**
 * Subscribe to a player event.
 * Returns a PluginListenerHandle — call `.remove()` to unsubscribe.
 *
 * @param {'timeUpdate'|'stateChange'|'durationUpdate'|'error'} event
 * @param {Function} cb
 */
export function addNativePlayerListener(event, cb) {
  return plugin()?.addListener(event, cb);
}
