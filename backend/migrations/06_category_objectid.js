/**
 * Migration 06 — Backfill Product.category_id from Category collection
 *
 * For every product without a category_id:
 *   1. Tries to match Category by slug (slug derived from category string: lowercase, spaces→hyphens)
 *   2. Falls back to exact name match (case-insensitive)
 *   3. Falls back to partial name match (contains)
 *   4. If no match: logs the miss and skips — does NOT update
 *
 * This migration MUST exit non-zero if any products are missed. The schema change
 * (dropping Product.category string) MUST NOT be deployed if missed_count > 0.
 *
 * Idempotent: skips products already having category_id.
 *
 * Run: node backend/migrations/06_category_objectid.js
 */

(async () => {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const mongoose = require('mongoose');
  const Product = require('../models/Product.model');
  const Category = require('../models/Category.model');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[06] Connected to MongoDB');

  const categories = await Category.find({ is_active: { $ne: false } }).lean();
  if (categories.length === 0) {
    console.error('[06] No categories found — aborting');
    process.exit(1);
  }
  console.log(`[06] Loaded ${categories.length} categories for matching`);

  // Build lookup maps for fast matching
  const bySlug = {};
  const byNameLower = {};
  for (const cat of categories) {
    if (cat.slug) bySlug[cat.slug.toLowerCase()] = cat;
    if (cat.name) byNameLower[cat.name.toLowerCase().trim()] = cat;
  }

  // Derive a slug from a category string the same way slugify typically works
  const toSlug = (str) =>
    str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const products = await Product.find({ category_id: null }).select('_id category').lean();
  console.log(`[06] Found ${products.length} products without category_id`);

  let updated = 0;
  let skipped = 0;
  const misses = [];

  for (const product of products) {
    if (!product.category) {
      misses.push({ id: product._id, category: '(empty)' });
      continue;
    }

    const catStr = product.category.trim();
    const derivedSlug = toSlug(catStr);
    const nameLower = catStr.toLowerCase();

    // Match priority: exact slug → exact name → partial name
    let matched =
      bySlug[derivedSlug] ||
      bySlug[nameLower] || // some slugs may equal the name
      byNameLower[nameLower] ||
      categories.find(c => c.name.toLowerCase().includes(nameLower)) ||
      categories.find(c => nameLower.includes(c.name.toLowerCase()));

    if (!matched) {
      misses.push({ id: product._id, category: catStr });
      continue;
    }

    await Product.updateOne({ _id: product._id }, { $set: { category_id: matched._id } });
    updated++;
  }

  // Summary
  console.log(`\n[06] Updated: ${updated}, Already had category_id (skipped): ${skipped}, Misses: ${misses.length}`);

  if (misses.length > 0) {
    console.warn('\n[06] MISSES — no Category found for these products (manual review needed):');
    misses.forEach(m => console.warn(`  Product ${m.id}  category="${m.category}"`));
    console.error('\n[06] ⚠️  Schema change (drop Product.category) MUST NOT be deployed until misses = 0');
    process.exit(1); // Non-zero exit — signals CI/deploy guard
  }

  console.log('\n[06] All products matched. Safe to proceed.');
  await mongoose.disconnect();
  console.log('[06] Done\n');
})().catch(err => { console.error(err); process.exit(1); });
