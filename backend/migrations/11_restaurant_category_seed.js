/**
 * migrations/11_restaurant_category_seed.js
 * Auradime — Phase 3-D Step 3: Restaurant Category Taxonomy
 *
 * Inserts the initial cuisine types and meal categories for the restaurant/dine surface.
 * Idempotent: guarded by slug — re-run is safe, will not create duplicates.
 *
 * All rows use `applies_to: 'restaurant'` so they are excluded from retail surfaces.
 *
 * Cuisine types (restaurant-level — group restaurants by cooking style):
 *   Cameroonian · Fast Food · Chinese · Pizza · Burgers · Shawarma ·
 *   Breakfast · Seafood · Vegetarian · Desserts & Drinks
 *
 * Meal categories (product-level — group individual meals by dish type):
 *   Rice & Fufu dishes · Grilled & Roasted · Soups & Stews ·
 *   Sandwiches & Wraps · Sides & Snacks · Cold Drinks · Hot Drinks ·
 *   Desserts & Pastries
 *
 * Usage:
 *   node backend/migrations/11_restaurant_category_seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category.model');

const CUISINE_TYPES = [
  { name: 'Cameroonian',       slug: 'cameroonian',        icon: '🇨🇲' },
  { name: 'Fast Food',         slug: 'fast-food',           icon: '🍔' },
  { name: 'Chinese',           slug: 'chinese',             icon: '🥢' },
  { name: 'Pizza',             slug: 'pizza',               icon: '🍕' },
  { name: 'Burgers',           slug: 'burgers',             icon: '🍔' },
  { name: 'Shawarma',          slug: 'shawarma',            icon: '🌯' },
  { name: 'Breakfast',         slug: 'breakfast',           icon: '🍳' },
  { name: 'Seafood',           slug: 'seafood',             icon: '🦞' },
  { name: 'Vegetarian',        slug: 'vegetarian',          icon: '🥗' },
  { name: 'Desserts & Drinks', slug: 'desserts-and-drinks', icon: '🧃' },
];

const MEAL_CATEGORIES = [
  { name: 'Rice & Fufu dishes',    slug: 'rice-fufu',         icon: '🍚' },
  { name: 'Grilled & Roasted',     slug: 'grilled-roasted',   icon: '🍖' },
  { name: 'Soups & Stews',         slug: 'soups-stews',       icon: '🍲' },
  { name: 'Sandwiches & Wraps',    slug: 'sandwiches-wraps',  icon: '🥙' },
  { name: 'Sides & Snacks',        slug: 'sides-snacks',      icon: '🍟' },
  { name: 'Cold Drinks',           slug: 'cold-drinks',       icon: '🥤' },
  { name: 'Hot Drinks',            slug: 'hot-drinks',        icon: '☕' },
  { name: 'Desserts & Pastries',   slug: 'desserts-pastries', icon: '🧁' },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  let inserted = 0;
  let skipped  = 0;

  const all = [
    ...CUISINE_TYPES.map(c => ({ ...c, applies_to: 'restaurant', is_active: true })),
    ...MEAL_CATEGORIES.map(c => ({ ...c, applies_to: 'restaurant', is_active: true })),
  ];

  for (const cat of all) {
    const existing = await Category.findOne({ slug: cat.slug }).lean();
    if (existing) {
      // Update applies_to if it was previously set to 'retail'
      if (existing.applies_to !== 'restaurant') {
        await Category.findByIdAndUpdate(existing._id, { $set: { applies_to: 'restaurant' } });
        console.log(`  ↻ Updated applies_to for: ${cat.name}`);
      } else {
        console.log(`  ⏩ Already exists: ${cat.name}`);
      }
      skipped += 1;
      continue;
    }

    await Category.create(cat);
    console.log(`  ✅ Inserted: ${cat.name}`);
    inserted += 1;
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped/updated: ${skipped}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
