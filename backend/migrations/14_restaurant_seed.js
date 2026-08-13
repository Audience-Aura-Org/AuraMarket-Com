/**
 * migrations/14_restaurant_seed.js
 * Auradime — Phase 3: Seed 3 sample restaurants with meals
 *
 * Creates:
 *   - 3 User accounts (role: vendor, auth: password)
 *   - 3 Vendor docs (vendor_type: restaurant, is_onboarded: true)
 *   - 3 Store docs
 *   - 3 RestaurantProfile docs (city: Yaoundé, service_zones: Biyem-Assi)
 *   - 4–5 Product meals per restaurant
 *
 * Idempotent: guarded by email uniqueness — re-run is safe (skips existing).
 *
 * Usage:
 *   node backend/migrations/14_restaurant_seed.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User              = require('../models/User.model');
const Vendor            = require('../models/Vendor.model');
const Store             = require('../models/Store.model');
const RestaurantProfile = require('../models/RestaurantProfile.model');
const Product           = require('../models/Product.model');
const Category          = require('../models/Category.model');
const LogisticZone      = require('../models/LogisticZone.model');

// ── Restaurant definitions ────────────────────────────────────────────────────
const RESTAURANTS = [
  {
    // ── Restaurant 1: Cameroonian street-food spot ─────────────────────────
    user: {
      name: 'Mama Pauline Kitchen',
      email: 'mama.pauline@test.auradime.cm',
      password: 'Test@1234',
      phone: '+237670000001',
    },
    vendor: {
      store_name: 'Mama Pauline Kitchen',
      description: 'Authentic Cameroonian dishes — ndolé, soya, achu and more.',
      phone: '+237670000001',
    },
    profile: {
      prep_time_minutes: 25,
      cuisine_slugs: ['cameroonian'],
    },
    meals: [
      {
        name: 'Ndolé with Plantains',
        description: 'Classic Cameroonian bitterleaf stew with plantains and fish.',
        price: 2500,
        category_slug: 'soups-stews',
        dietary_tags: ['gluten_free'],
        spice_level: 'mild',
        option_groups: [
          {
            name: 'Protein choice',
            min_select: 1,
            max_select: 1,
            is_required: true,
            options: [
              { label: 'Fish',   price_delta: 0,    is_default: true,  is_available: true },
              { label: 'Beef',   price_delta: 500,  is_default: false, is_available: true },
              { label: 'Shrimp', price_delta: 800,  is_default: false, is_available: true },
            ],
          },
        ],
      },
      {
        name: 'Achu Soup',
        description: 'Traditional cocoyam paste with yellow achu soup and crayfish.',
        price: 2000,
        category_slug: 'soups-stews',
        dietary_tags: ['gluten_free'],
        spice_level: 'medium',
        option_groups: [],
      },
      {
        name: 'Soya (Beef Skewers)',
        description: 'Spiced beef skewers grilled over charcoal. Served with suya spices.',
        price: 1500,
        category_slug: 'grilled-roasted',
        dietary_tags: [],
        spice_level: 'hot',
        option_groups: [
          {
            name: 'Quantity',
            min_select: 1,
            max_select: 1,
            is_required: true,
            options: [
              { label: '5 sticks',  price_delta: 0,    is_default: true,  is_available: true },
              { label: '10 sticks', price_delta: 1500, is_default: false, is_available: true },
            ],
          },
        ],
      },
      {
        name: 'Koki Beans',
        description: 'Steamed black-eyed pea pudding wrapped in banana leaves.',
        price: 1200,
        category_slug: 'sides-snacks',
        dietary_tags: ['vegan', 'gluten_free'],
        spice_level: 'none',
        option_groups: [],
      },
    ],
  },

  {
    // ── Restaurant 2: Fast-food burger joint ───────────────────────────────
    user: {
      name: 'Burger Lab Yaoundé',
      email: 'burgerlab@test.auradime.cm',
      password: 'Test@1234',
      phone: '+237670000002',
    },
    vendor: {
      store_name: 'Burger Lab',
      description: 'Smash burgers, loaded fries and milkshakes in the heart of Yaoundé.',
      phone: '+237670000002',
    },
    profile: {
      prep_time_minutes: 15,
      cuisine_slugs: ['burgers', 'fast-food'],
    },
    meals: [
      {
        name: 'Classic Smash Burger',
        description: 'Double smash patty, cheddar, pickles, caramelised onions, special sauce.',
        price: 3500,
        category_slug: 'sandwiches-wraps',
        dietary_tags: [],
        spice_level: 'none',
        option_groups: [
          {
            name: 'Bun type',
            min_select: 1,
            max_select: 1,
            is_required: true,
            options: [
              { label: 'Brioche bun',   price_delta: 0,   is_default: true,  is_available: true },
              { label: 'Whole wheat',   price_delta: 0,   is_default: false, is_available: true },
            ],
          },
          {
            name: 'Extras',
            min_select: 0,
            max_select: 3,
            is_required: false,
            options: [
              { label: 'Bacon',          price_delta: 500, is_default: false, is_available: true },
              { label: 'Extra cheese',   price_delta: 300, is_default: false, is_available: true },
              { label: 'Fried egg',      price_delta: 300, is_default: false, is_available: true },
            ],
          },
        ],
      },
      {
        name: 'Loaded Cheese Fries',
        description: 'Crispy fries topped with cheddar sauce, jalapeños and crispy bacon bits.',
        price: 2000,
        category_slug: 'sides-snacks',
        dietary_tags: [],
        spice_level: 'mild',
        option_groups: [],
      },
      {
        name: 'Chicken Wrap',
        description: 'Grilled spiced chicken, lettuce, tomato and garlic mayo in a soft tortilla.',
        price: 2800,
        category_slug: 'sandwiches-wraps',
        dietary_tags: [],
        spice_level: 'mild',
        option_groups: [
          {
            name: 'Sauce',
            min_select: 1,
            max_select: 1,
            is_required: true,
            options: [
              { label: 'Garlic mayo',   price_delta: 0, is_default: true,  is_available: true },
              { label: 'Hot sauce',     price_delta: 0, is_default: false, is_available: true },
              { label: 'BBQ',           price_delta: 0, is_default: false, is_available: true },
            ],
          },
        ],
      },
      {
        name: 'Vanilla Milkshake',
        description: 'Thick creamy milkshake blended with premium vanilla ice cream.',
        price: 1500,
        category_slug: 'cold-drinks',
        dietary_tags: [],
        spice_level: 'none',
        option_groups: [
          {
            name: 'Size',
            min_select: 1,
            max_select: 1,
            is_required: true,
            options: [
              { label: 'Regular (500ml)', price_delta: 0,   is_default: true,  is_available: true },
              { label: 'Large (750ml)',   price_delta: 500, is_default: false, is_available: true },
            ],
          },
        ],
      },
      {
        name: 'Veggie Burger',
        description: 'Black bean & beetroot patty with avocado, lettuce and chipotle mayo.',
        price: 3000,
        category_slug: 'sandwiches-wraps',
        dietary_tags: ['vegetarian'],
        spice_level: 'none',
        option_groups: [
          {
            name: 'Bun type',
            min_select: 1,
            max_select: 1,
            is_required: true,
            options: [
              { label: 'Brioche bun', price_delta: 0, is_default: true,  is_available: true },
              { label: 'Gluten-free', price_delta: 200, is_default: false, is_available: true },
            ],
          },
        ],
      },
    ],
  },

  {
    // ── Restaurant 3: Breakfast & Coffee café ─────────────────────────────
    user: {
      name: 'Le Petit Café',
      email: 'lepetitcafe@test.auradime.cm',
      password: 'Test@1234',
      phone: '+237670000003',
    },
    vendor: {
      store_name: 'Le Petit Café',
      description: 'Yaoundé\'s favourite breakfast spot — pastries, eggs and specialty coffee.',
      phone: '+237670000003',
    },
    profile: {
      prep_time_minutes: 10,
      cuisine_slugs: ['breakfast', 'desserts-and-drinks'],
    },
    meals: [
      {
        name: 'Full English Breakfast',
        description: 'Eggs, sausages, grilled tomato, mushrooms, baked beans and toast.',
        price: 3000,
        category_slug: 'rice-fufu',  // using rice-fufu as the general plate category
        dietary_tags: [],
        spice_level: 'none',
        option_groups: [
          {
            name: 'Egg style',
            min_select: 1,
            max_select: 1,
            is_required: true,
            options: [
              { label: 'Scrambled',  price_delta: 0, is_default: true,  is_available: true },
              { label: 'Fried',      price_delta: 0, is_default: false, is_available: true },
              { label: 'Poached',    price_delta: 0, is_default: false, is_available: true },
            ],
          },
        ],
      },
      {
        name: 'Avocado Toast',
        description: 'Sourdough toast with smashed avocado, poached eggs and chilli flakes.',
        price: 2500,
        category_slug: 'sandwiches-wraps',
        dietary_tags: ['vegetarian'],
        spice_level: 'mild',
        option_groups: [],
      },
      {
        name: 'Cappuccino',
        description: 'Double espresso with steamed milk foam. Made with Cameroonian arabica beans.',
        price: 1000,
        category_slug: 'hot-drinks',
        dietary_tags: ['vegan'],
        spice_level: 'none',
        option_groups: [
          {
            name: 'Milk',
            min_select: 1,
            max_select: 1,
            is_required: true,
            options: [
              { label: 'Whole milk',  price_delta: 0,   is_default: true,  is_available: true },
              { label: 'Oat milk',    price_delta: 200, is_default: false, is_available: true },
            ],
          },
          {
            name: 'Extras',
            min_select: 0,
            max_select: 2,
            is_required: false,
            options: [
              { label: 'Extra shot',   price_delta: 300, is_default: false, is_available: true },
              { label: 'Vanilla syrup',price_delta: 150, is_default: false, is_available: true },
            ],
          },
        ],
      },
      {
        name: 'Croissant',
        description: 'Buttery flaky croissant baked fresh every morning.',
        price: 800,
        category_slug: 'desserts-pastries',
        dietary_tags: ['vegetarian'],
        spice_level: 'none',
        option_groups: [
          {
            name: 'Filling',
            min_select: 1,
            max_select: 1,
            is_required: true,
            options: [
              { label: 'Plain',          price_delta: 0,   is_default: true,  is_available: true },
              { label: 'Chocolate',      price_delta: 200, is_default: false, is_available: true },
              { label: 'Ham & cheese',   price_delta: 400, is_default: false, is_available: true },
            ],
          },
        ],
      },
    ],
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log('Connected to MongoDB\n');

  // ── 1. Find Yaoundé city zone ───────────────────────────────────────────
  const yaounde = await LogisticZone.findOne({
    name: /^yaound[eé]/i,
    type: { $in: ['city', 'region'] },
  }).lean();
  if (!yaounde) throw new Error('Yaoundé city zone not found — run migration 01 first.');
  console.log(`✔ City zone: ${yaounde.name} (${yaounde._id})`);

  // ── 2. Find districts that belong to Yaoundé (linked via parent_id) ────
  const districts = await LogisticZone.find({
    parent_id: yaounde._id,
    type: 'district',
  }).lean();
  if (!districts.length) throw new Error('No Yaoundé districts found — run migration 02 first.');
  const serviceZoneId = districts[0]._id;
  console.log(`✔ Service zone: ${districts[0].name} (${serviceZoneId})`);
  const allServiceZoneIds = districts.map(d => d._id);

  // ── 3. Load category map (slug → _id) ──────────────────────────────────
  const categories = await Category.find({ applies_to: 'restaurant' }).lean();
  if (!categories.length) throw new Error('No restaurant categories found — run migration 11 first.');
  const catBySlug = {};
  for (const c of categories) catBySlug[c.slug] = c;
  console.log(`✔ Loaded ${categories.length} restaurant categories\n`);

  // ── 4. Hash shared password ─────────────────────────────────────────────
  const salt = await bcrypt.genSalt(12);

  let created = 0;
  let skipped = 0;

  for (const def of RESTAURANTS) {
    console.log(`── ${def.vendor.store_name} ─────────────────────────`);

    // ── 4a. Skip if user already exists ──────────────────────────────────
    const existingUser = await User.findOne({ email: def.user.email }).lean();
    if (existingUser) {
      console.log(`  ⏩ Already exists — skipping (${def.user.email})\n`);
      skipped++;
      continue;
    }

    // ── 4b. Create User ────────────────────────────────────────────────────
    const hashedPw = await bcrypt.hash(def.user.password, salt);
    const user = await User.create({
      name:                def.user.name,
      email:               def.user.email,
      password:            hashedPw,
      phone:               def.user.phone,
      role:                'vendor',
      verification_status: 'verified',
      is_active:           true,
      auth_provider:       'password',
      onboarded:           true,
    });
    console.log(`  ✅ User: ${user._id}`);

    // ── 4c. Create Vendor ──────────────────────────────────────────────────
    const vendor = await Vendor.create({
      user_id:         user._id,
      store_name:      def.vendor.store_name,
      description:     def.vendor.description,
      phone:           def.vendor.phone,
      vendor_type:     'restaurant',
      verified:        true,
      is_onboarded:    true,
      onboarding_step: 'complete',
      pickup_address: {
        city:     'Yaoundé',
        quartier: districts[0].name,
        zone_id:  serviceZoneId,
      },
    });
    console.log(`  ✅ Vendor: ${vendor._id}`);

    // ── 4d. Create Store ────────────────────────────────────────────────────
    await Store.create({
      vendor_id:  vendor._id,
      is_active:  true,
      categories: def.profile.cuisine_slugs,
    });
    console.log(`  ✅ Store created`);

    // ── 4e. Resolve cuisine_types ObjectIds ────────────────────────────────
    const cuisineIds = def.profile.cuisine_slugs
      .map(s => catBySlug[s]?._id)
      .filter(Boolean);

    // ── 4f. Create RestaurantProfile ────────────────────────────────────────
    // Build full 7-day opening schedule (closed Sundays for variety)
    const opening_hours = [0, 1, 2, 3, 4, 5, 6].map(day => ({
      day,
      opens:     '07:30',
      closes:    '22:00',
      is_closed: day === 0, // closed Sunday
    }));

    const profile = await RestaurantProfile.create({
      vendor_id:            vendor._id,
      city_zone_id:         yaounde._id,
      cuisine_types:        cuisineIds,
      opening_hours,
      prep_time_minutes:    def.profile.prep_time_minutes,
      is_accepting_orders:  true,
      accepts_scheduled:    false,
      service_zones: districts.slice(0, 3).map(d => ({
        zone_id:          d._id,
        min_order_amount: 1000,
        is_active:        true,
      })),
    });
    console.log(`  ✅ RestaurantProfile: ${profile._id} (${cuisineIds.length} cuisine types)`);

    // ── 4g. Create meals ────────────────────────────────────────────────────
    let mealCount = 0;
    for (const meal of def.meals) {
      const catDoc = catBySlug[meal.category_slug];
      if (!catDoc) {
        console.warn(`  ⚠  Category slug not found: "${meal.category_slug}" — skipping meal "${meal.name}"`);
        continue;
      }

      await Product.create({
        vendor_id:            vendor._id,
        name:                 meal.name,
        description:          meal.description,
        price:                meal.price,
        category:             catDoc.name,
        category_id:          catDoc._id,
        stock:                999,
        status:               'active',
        is_meal:              true,
        is_intercity_eligible: false,
        service_zone_ids:     allServiceZoneIds,
        meal: {
          dietary_tags:          meal.dietary_tags || [],
          spice_level:           meal.spice_level || 'none',
          is_available_today:    true,
          booking_options:       [{ type: 'delivery' }, { type: 'pickup' }],
          option_groups:         meal.option_groups || [],
        },
      });
      mealCount++;
      console.log(`    🍽  ${meal.name} — ${meal.price.toLocaleString()} XAF`);
    }
    console.log(`  ✅ ${mealCount} meals created\n`);
    created++;
  }

  console.log(`\n══════════════════════════════════`);
  console.log(`Done. Created: ${created}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
