/**
 * scratch/migrate-usernames.js
 * One-time migration: Generate usernames for all existing users who don't have one.
 *
 * Usage:  node scratch/migrate-usernames.js
 * Requires: MONGO_URI env var (or .env file in project root)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') });
const mongoose = require('mongoose');
const User = require('../backend/models/User.model');

const RESERVED_USERNAMES = new Set([
  'admin', 'support', 'aura', 'auradime', 'auradime_support', 'help', 'system',
  'moderator', 'mod', 'staff', 'root', 'superadmin', 'delivery', 'logistics',
  'vendor', 'customer', 'api', 'www', 'mail', 'info', 'contact', 'null', 'undefined',
]);

const generateUsername = async (name) => {
  const base = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
  const safeName = base.length >= 3 ? base : base.padEnd(3, '0');
  let candidate = safeName;
  let suffix = 0;
  const MAX_ATTEMPTS = 50;

  while (suffix < MAX_ATTEMPTS) {
    if (!RESERVED_USERNAMES.has(candidate) && !(await User.exists({ username: candidate }))) {
      return candidate;
    }
    suffix++;
    candidate = `${safeName.slice(0, 17)}${suffix}`;
  }
  const rand = Math.floor(Math.random() * 9999);
  return `${safeName.slice(0, 15)}${rand}`;
};

(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGO_URI found in env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const usersWithout = await User.find({
    $or: [{ username: null }, { username: { $exists: false } }, { username: '' }],
  }).select('_id name username');

  console.log(`Found ${usersWithout.length} users without a username`);

  let updated = 0;
  for (const user of usersWithout) {
    try {
      const username = await generateUsername(user.name);
      await User.findByIdAndUpdate(user._id, { $set: { username } }, { runValidators: true });
      updated++;
      console.log(`  ${user.name} → @${username}`);
    } catch (err) {
      console.error(`  FAILED for ${user._id} (${user.name}):`, err.message);
    }
  }

  console.log(`\nDone. Updated ${updated}/${usersWithout.length} users.`);
  await mongoose.disconnect();
  process.exit(0);
})();
