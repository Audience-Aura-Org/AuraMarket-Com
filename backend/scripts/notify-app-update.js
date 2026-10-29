/**
 * Ask Android app users on an old version to update.
 *
 *   node scripts/notify-app-update.js           # dry run: counts who would be told
 *   node scripts/notify-app-update.js --send    # sends the notification
 *
 * Who: users with an Android push token whose app version is older than
 * APP_LATEST_VERSION, or unknown (apps before 1.7.1 did not report a version).
 * What: an in-app notification plus a phone push. Old apps cannot open the APK
 * from a notification tap, so the text says where to download it.
 * Each user is told at most once per version (re-running is safe).
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const PushSubscription = require('../models/PushSubscription.model');
const Notification = require('../models/Notification.model');
const { sendNotification } = require('../utils/notifier');
const { latest, compareVersions } = require('../utils/appVersion');

const send = process.argv.includes('--send');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const version = latest();
  const tokens = await PushSubscription.find({ channel: 'android', fcm_token: { $type: 'string' } }).select('user_id app_version').lean();

  // A user is current if any of their phones runs the latest version.
  const byUser = new Map();
  for (const t of tokens) {
    const id = t.user_id.toString();
    const current = Boolean(t.app_version) && compareVersions(t.app_version, version) >= 0;
    byUser.set(id, (byUser.get(id) || false) || current);
  }
  const outdated = [...byUser].filter(([, current]) => !current).map(([id]) => id);
  // The version-specific link marks who was already told about this version.
  const link = `https://auradime.com/install?v=${version}`;
  const alreadyTold = new Set((await Notification.distinct('recipient', { 'metadata.link': link, recipient: { $in: outdated } })).map(String));
  const targets = outdated.filter((id) => !alreadyTold.has(id));

  console.log(`Latest app: ${version}`);
  console.log(`Android app users: ${byUser.size} · on an older version: ${outdated.length} · already told: ${alreadyTold.size} · to notify: ${targets.length}`);
  if (!send) {
    console.log('Dry run. Re-run with --send to notify them.');
    await mongoose.disconnect();
    return;
  }

  let ok = 0;
  for (const id of targets) {
    try {
      await sendNotification(null, id, {
        title: `Update Auradime to ${version}`,
        message: `A new version of the Auradime app is ready, with live rider tracking and a faster, smoother app. Open auradime.com/install in your phone's browser to download it, then install it over this one. Your account and data stay.`,
        type: 'system_alert',
        metadata: { link },
      });
      ok++;
    } catch (e) {
      console.error(`  ! ${id}: ${e.message}`);
    }
  }
  console.log(`Sent to ${ok} of ${targets.length}.`);
  // Pushes go out in the background; give them a moment before disconnecting.
  await new Promise((r) => setTimeout(r, 5000));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
