/**
 * scripts/purge_restaurant_seeds.js
 * Auradime — Remove all seeded restaurant data
 *
 * Deletes:
 *   - All vendors with vendor_type = 'restaurant'
 *   - Their User accounts, Stores, RestaurantProfiles
 *   - All Products (meals) belonging to those vendors + S3 images
 *   - All Orders belonging to those vendors
 *
 * Run: node backend/scripts/purge_restaurant_seeds.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// ── Register models needed for virtuals / middleware ──────────────────────────
require('../models/Category.model');
require('../models/UserSubscription.model');
require('../models/Store.model');
require('../models/Shipment.model');
require('../models/Escrow.model');
require('../models/LogisticZone.model');

const User              = require('../models/User.model');
const Vendor            = require('../models/Vendor.model');
const Store             = require('../models/Store.model');
const Product           = require('../models/Product.model');
const Order             = require('../models/Order.model');
const RestaurantProfile = require('../models/RestaurantProfile.model');

// ── S3 setup ──────────────────────────────────────────────────────────────────
const S3_BUCKET = process.env.AWS_S3_BUCKET;
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_ENABLED = !!process.env.AWS_S3_ENABLED && !!process.env.AWS_ACCESS_KEY_ID && !!S3_BUCKET;

let s3;
if (S3_ENABLED) {
  s3 = new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

function isOwnS3Url(url) {
  if (!url || !S3_BUCKET) return false;
  return url.includes('.amazonaws.com') && url.includes(S3_BUCKET);
}

function extractS3Key(url) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, '')) || null;
  } catch {
    return null;
  }
}

async function deleteS3Url(url) {
  if (!s3 || !isOwnS3Url(url)) return false;
  const key = extractS3Key(url);
  if (!key) return false;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch (err) {
    console.warn(`  ⚠  S3 delete failed for key "${key}": ${err.message}`);
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg)  { console.log(msg); }
function step(msg) { console.log(`\n── ${msg} ─────────────────────────────────`); }

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');

  await mongoose.connect(uri);
  log('Connected to MongoDB');
  if (S3_ENABLED) log(`S3 enabled — bucket: ${S3_BUCKET}`);
  else             log('S3 not configured — skipping image deletion from S3');

  // ── 1. Find all restaurant vendors ──────────────────────────────────────────
  step('Finding restaurant vendors');
  const vendors = await Vendor.find({ vendor_type: 'restaurant' }).select('_id user_id store_name').lean();
  if (!vendors.length) {
    log('No restaurant vendors found — nothing to delete.');
    await mongoose.disconnect();
    return;
  }
  vendors.forEach(v => log(`  • ${v.store_name} (vendor: ${v._id})`));
  const vendorIds = vendors.map(v => v._id);
  const userIds   = vendors.map(v => v.user_id).filter(Boolean);

  // ── 2. Collect + delete S3 product images ───────────────────────────────────
  step('Collecting product images');
  const products = await Product.find({ vendor_id: { $in: vendorIds } })
    .select('_id name images')
    .lean();
  log(`  Found ${products.length} product(s)`);

  let s3Deleted = 0;
  let s3Skipped = 0;
  for (const p of products) {
    const urls = (p.images || []).map(img => (typeof img === 'object' ? img.url : img)).filter(Boolean);
    for (const url of urls) {
      if (isOwnS3Url(url)) {
        const ok = await deleteS3Url(url);
        ok ? s3Deleted++ : s3Skipped++;
      } else {
        s3Skipped++;
      }
    }
  }
  log(`  S3 images deleted: ${s3Deleted}, skipped (CDN/no-S3): ${s3Skipped}`);

  // ── 3. Collect + delete S3 store logo / banner ──────────────────────────────
  step('Collecting store images (logo / banner)');
  const stores = await Store.find({ vendor_id: { $in: vendorIds } })
    .select('_id logo banner')
    .lean();
  for (const store of stores) {
    for (const field of ['logo', 'banner']) {
      const url = store[field];
      if (url && isOwnS3Url(url)) {
        const ok = await deleteS3Url(url);
        log(`  ${ok ? '✅' : '⚠ '} Store ${field}: ${url.slice(-40)}`);
      }
    }
  }

  // ── 4. Delete Orders ─────────────────────────────────────────────────────────
  step('Deleting orders');
  const { deletedCount: ordersDeleted } = await Order.deleteMany({ vendor_id: { $in: vendorIds } });
  log(`  Deleted ${ordersDeleted} order(s)`);

  // ── 5. Delete Products ───────────────────────────────────────────────────────
  step('Deleting products / meals');
  const { deletedCount: productsDeleted } = await Product.deleteMany({ vendor_id: { $in: vendorIds } });
  log(`  Deleted ${productsDeleted} product(s)`);

  // ── 6. Delete RestaurantProfiles (including orphans whose vendor was already removed) ──
  step('Deleting restaurant profiles');
  // Also sweep for any RestaurantProfile whose vendor_id has no matching Vendor (orphans)
  const allProfiles = await RestaurantProfile.find({}).select('vendor_id').lean();
  const allVendorIds = (await Vendor.find({}).select('_id').lean()).map(v => v._id.toString());
  const orphanProfileVendorIds = allProfiles
    .filter(p => !allVendorIds.includes(p.vendor_id.toString()))
    .map(p => p.vendor_id);
  const profileDeleteIds = [...vendorIds, ...orphanProfileVendorIds];
  const { deletedCount: profilesDeleted } = await RestaurantProfile.deleteMany({ vendor_id: { $in: profileDeleteIds } });
  log(`  Deleted ${profilesDeleted} restaurant profile(s) (incl. ${orphanProfileVendorIds.length} orphan(s))`);

  // ── 7. Delete Stores ─────────────────────────────────────────────────────────
  step('Deleting stores');
  const { deletedCount: storesDeleted } = await Store.deleteMany({ vendor_id: { $in: vendorIds } });
  log(`  Deleted ${storesDeleted} store(s)`);

  // ── 8. Delete Vendors ────────────────────────────────────────────────────────
  step('Deleting vendor records');
  const { deletedCount: vendorsDeleted } = await Vendor.deleteMany({ _id: { $in: vendorIds } });
  log(`  Deleted ${vendorsDeleted} vendor(s)`);

  // ── 9. Delete User accounts ──────────────────────────────────────────────────
  step('Deleting user accounts');
  const { deletedCount: usersDeleted } = await User.deleteMany({ _id: { $in: userIds } });
  log(`  Deleted ${usersDeleted} user(s)`);

  // ── Summary ───────────────────────────────────────────────────────────────────
  log('\n══════════════════════════════════════════════════');
  log('Purge complete');
  log(`  Vendors:              ${vendorsDeleted}`);
  log(`  Users:                ${usersDeleted}`);
  log(`  Stores:               ${storesDeleted}`);
  log(`  Restaurant profiles:  ${profilesDeleted}`);
  log(`  Products / meals:     ${productsDeleted}`);
  log(`  Orders:               ${ordersDeleted}`);
  log(`  S3 objects deleted:   ${s3Deleted}`);
  log('══════════════════════════════════════════════════');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('\n❌ Purge failed:', err.message);
  process.exit(1);
});
