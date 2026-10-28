/**
 * Feature flags for the logistics/maps rollout. Stored in PlatformSettings.features,
 * switched by admins, all off by default. Dispatch flags have a third "shadow" mode:
 * the engine computes and records its choice, but humans still assign.
 */
const FEATURE_FLAGS = Object.freeze({
  location_picker: 'boolean',        // search + map pin when choosing addresses
  live_tracking: 'boolean',          // rider GPS on customer tracking pages
  rider_accounts: 'boolean',         // agencies manage rider logins
  agency_packages: 'boolean',        // agencies register packages themselves
  tracking_links: 'boolean',         // secure /delivery/track?t= links + WhatsApp share
  auto_rider_dispatch: 'mode',       // off | shadow | on
  auto_agency_dispatch: 'mode',      // off | shadow | on
  payment_triggered_dispatch: 'boolean',
  enhanced_chat: 'boolean',
});
const MODES = ['off', 'shadow', 'on'];

const defaults = () => Object.fromEntries(Object.entries(FEATURE_FLAGS).map(([k, t]) => [k, t === 'mode' ? 'off' : false]));

/** Effective flags from a settings document (unknown/missing keys fall back to off). */
const readFlags = (settings) => {
  const stored = settings?.features || {};
  return Object.fromEntries(Object.entries(FEATURE_FLAGS).map(([k, t]) => {
    const v = stored[k];
    return [k, t === 'mode' ? (MODES.includes(v) ? v : 'off') : v === true];
  }));
};

/** Validates an admin update; returns { flags } or { error }. Only listed keys are accepted. */
const parseFlagUpdate = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'features must be an object.' };
  const flags = {};
  for (const [k, v] of Object.entries(input)) {
    const kind = FEATURE_FLAGS[k];
    if (!kind) return { error: `Unknown feature flag: ${k}` };
    if (kind === 'mode' ? !MODES.includes(v) : typeof v !== 'boolean') {
      return { error: kind === 'mode' ? `${k} must be one of ${MODES.join(', ')}.` : `${k} must be true or false.` };
    }
    flags[k] = v;
  }
  return { flags };
};

const isEnabled = (settings, flag) => {
  const value = readFlags(settings)[flag];
  return value === true || value === 'on';
};

module.exports = { FEATURE_FLAGS, MODES, defaults, readFlags, parseFlagUpdate, isEnabled };
