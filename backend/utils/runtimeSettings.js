/**
 * Admin-editable values that synchronous code needs (mobile money fee, app
 * versions). Cached from PlatformSettings: refreshed every minute and right
 * after an admin saves, so each server process picks up changes within a minute
 * without a restart. Until the first load (and in tests) callers fall back to env.
 */
let cache = {};
let timer = null;

const KEYS = ['momo_fixed_fee_xaf', 'app_latest_version', 'app_min_version'];

const apply = (settings) => {
  cache = Object.fromEntries(KEYS.map((k) => [k, settings?.[k] ?? null]));
};

const refresh = async () => {
  try {
    const PlatformSettings = require('../models/PlatformSettings.model');
    apply(await PlatformSettings.findOne().select(KEYS.join(' ')).lean());
  } catch { /* keep the last values */ }
};

/** Admin value, or null when not set (use the env default). */
const get = (key) => (cache[key] === undefined ? null : cache[key]);

const startRuntimeSettings = () => {
  if (timer) return;
  refresh();
  timer = setInterval(refresh, 60 * 1000);
  if (timer.unref) timer.unref();
};

module.exports = { get, apply, refresh, startRuntimeSettings };
