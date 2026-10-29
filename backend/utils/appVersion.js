/**
 * Android app versions (env, so a release needs no code change):
 *   APP_LATEST_VERSION   newest APK on the download page, e.g. "1.7.1"
 *   APP_MIN_VERSION      oldest version still allowed to run (blocking update screen below it)
 *   APP_DOWNLOAD_URL     where the APK is downloaded
 */
const latest = () => process.env.APP_LATEST_VERSION || '1.7.1';
const minimum = () => process.env.APP_MIN_VERSION || null;
const downloadUrl = () => process.env.APP_DOWNLOAD_URL || 'https://auradime.com/downloads/Auradime.apk';

/** -1 / 0 / 1 comparing "1.7.0" style versions; missing parts count as 0. */
const compareVersions = (a, b) => {
  const pa = String(a || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
};

/** What the app should do for a given installed version. */
const statusFor = (installed) => ({
  latest: latest(),
  minimum: minimum(),
  download_url: downloadUrl(),
  update_available: Boolean(installed) && compareVersions(installed, latest()) < 0,
  update_required: Boolean(installed && minimum()) && compareVersions(installed, minimum()) < 0,
});

module.exports = { latest, minimum, downloadUrl, compareVersions, statusFor };
