/**
 * migrations/12_parcel_class_backfill.js
 * Auradime — Phase 4 Step 3: backfill Product.parcel_class = 'small'
 *
 * All existing products default to 'small'. Vendors can change to 'oversize'
 * in the product upload form (blocks intercity shipping).
 *
 * Idempotent: skips products that already have parcel_class set.
 *
 * Usage:
 *   node backend/migrations/12_parcel_class_backfill.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product.model');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const result = await Product.updateMany(
    { parcel_class: { $exists: false } },
    { $set: { parcel_class: 'small' } }
  );

  console.log(`Updated ${result.modifiedCount} products to parcel_class: 'small'`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
