/**
 * controllers/restaurant.controller.js
 * Auradime — Restaurant Profile CRUD + Dine Page API
 *
 * Phase 3 Steps 11 & Phase 3-D
 *
 * Routes exposed:
 *   GET  /api/restaurant/profile         — vendor: fetch own RestaurantProfile
 *   POST /api/restaurant/profile         — vendor: create RestaurantProfile
 *   PATCH /api/restaurant/profile        — vendor: update RestaurantProfile (triggers zone sync)
 *   GET  /api/dine?zone_id=              — public: district-scoped restaurant + meal feed
 *   GET  /api/dine/restaurant/:vendor_id — public: full restaurant menu page
 */

const mongoose = require('mongoose');
const RestaurantProfile = require('../models/RestaurantProfile.model');
const Vendor = require('../models/Vendor.model');
const Store = require('../models/Store.model');
const Product = require('../models/Product.model');
const Category = require('../models/Category.model');
const LogisticZone = require('../models/LogisticZone.model');
const { syncRestaurantServiceZones } = require('../services/restaurantZoneSync.service');
const { hasCoverageInCity, getCompatibleFirms, calculateShipmentFees } = require('../services/logistics.service');
const cache = require('../utils/cache');

const DINE_CACHE_TTL_SECONDS = 300; // 5 minutes — short because is_accepting_orders changes hourly

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

// Compute open/closed status from opening_hours + current Africa/Douala time
const computeOpenStatus = (opening_hours = []) => {
  // If no schedule defined, treat as always open
  if (!opening_hours || opening_hours.length === 0) {
    return { open_status: 'open', next_status_change_at: null };
  }

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Douala' }));
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todayRow = opening_hours.find(h => h.day === dayOfWeek);
  if (!todayRow || todayRow.is_closed) return { open_status: 'closed', next_status_change_at: null };

  const parseTime = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const opensAt = parseTime(todayRow.opens);
  const closesAt = parseTime(todayRow.closes);
  if (opensAt === null || closesAt === null) return { open_status: 'unknown', next_status_change_at: null };

  const isOpen = currentMinutes >= opensAt && currentMinutes < closesAt;

  // Build next_status_change_at as a UTC Date
  const baseDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Douala' }));
  baseDate.setSeconds(0, 0);

  const changeMinutes = isOpen ? closesAt : opensAt;
  if (!isOpen && currentMinutes > closesAt) {
    // Already past closing today — next open is tomorrow
    baseDate.setDate(baseDate.getDate() + 1);
    baseDate.setHours(Math.floor(opensAt / 60), opensAt % 60, 0, 0);
    return { open_status: 'closed', next_status_change_at: baseDate };
  }

  baseDate.setHours(Math.floor(changeMinutes / 60), changeMinutes % 60, 0, 0);
  return { open_status: isOpen ? 'open' : 'closed', next_status_change_at: baseDate };
};

// ─────────────────────────────────────────────
// @route   GET /api/restaurant/profile
// @desc    Get logged-in vendor's RestaurantProfile
// @access  Private (vendor)
// ─────────────────────────────────────────────
const getOwnProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user._id }).select('_id vendor_type').lean();
    if (!vendor || vendor.vendor_type !== 'restaurant') {
      return res.status(403).json({ success: false, message: 'This account is not registered as a restaurant.' });
    }

    const profile = await RestaurantProfile.findOne({ vendor_id: vendor._id })
      .populate('cuisine_types', 'name slug')
      .populate('service_zones.zone_id', 'name code type');

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Restaurant profile not found. Please complete setup.' });
    }

    res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/restaurant/profile
// @desc    Create a RestaurantProfile for the logged-in restaurant vendor
// @access  Private (vendor, vendor_type === 'restaurant')
// ─────────────────────────────────────────────
const createProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user._id }).select('_id vendor_type').lean();
    if (!vendor || vendor.vendor_type !== 'restaurant') {
      return res.status(403).json({ success: false, message: 'Only restaurant vendors can create a restaurant profile.' });
    }

    const existing = await RestaurantProfile.findOne({ vendor_id: vendor._id });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Restaurant profile already exists. Use PATCH to update.' });
    }

    const {
      city_zone_id,
      cuisine_types,
      opening_hours,
      prep_time_minutes,
      accepts_scheduled,
      service_zones,
      timezone,
    } = req.body;

    if (!city_zone_id) {
      return res.status(400).json({ success: false, message: 'city_zone_id is required.' });
    }

    // D-2: Validate that all cuisine_types are restaurant-scoped categories
    if (cuisine_types?.length) {
      const validIds = cuisine_types.filter(id => mongoose.Types.ObjectId.isValid(id));
      const cats = await Category.find({
        _id: { $in: validIds },
        applies_to: { $in: ['restaurant', 'both'] },
      }).select('_id').lean();
      if (cats.length !== validIds.length) {
        return res.status(400).json({
          success: false,
          message: 'cuisine_types must reference categories with applies_to: restaurant or both.',
        });
      }
    }

    const profile = await RestaurantProfile.create({
      vendor_id:        vendor._id,
      city_zone_id,
      cuisine_types:    cuisine_types || [],
      opening_hours:    opening_hours || undefined, // use schema default (7-row seeded)
      prep_time_minutes: prep_time_minutes || 20,
      accepts_scheduled: accepts_scheduled !== undefined ? accepts_scheduled : false,
      service_zones:    service_zones || [],
      timezone:         timezone || 'Africa/Douala',
    });

    // Sync service_zone_ids onto existing meal products (if any)
    await syncRestaurantServiceZones(vendor._id);

    res.status(201).json({ success: true, data: { profile } });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/restaurant/profile
// @desc    Update RestaurantProfile fields
// @access  Private (vendor, vendor_type === 'restaurant')
// ─────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user._id }).select('_id vendor_type').lean();
    if (!vendor || vendor.vendor_type !== 'restaurant') {
      return res.status(403).json({ success: false, message: 'Only restaurant vendors can update a restaurant profile.' });
    }

    const profile = await RestaurantProfile.findOne({ vendor_id: vendor._id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Restaurant profile not found. Create it first.' });
    }

    const UPDATABLE = [
      'city_zone_id', 'cuisine_types', 'opening_hours', 'prep_time_minutes',
      'accepts_scheduled', 'service_zones', 'is_accepting_orders', 'timezone',
    ];

    // D-2: Validate cuisine_types if being updated
    if (req.body.cuisine_types?.length) {
      const validIds = req.body.cuisine_types.filter(id => mongoose.Types.ObjectId.isValid(id));
      const cats = await Category.find({
        _id: { $in: validIds },
        applies_to: { $in: ['restaurant', 'both'] },
      }).select('_id').lean();
      if (cats.length !== validIds.length) {
        return res.status(400).json({
          success: false,
          message: 'cuisine_types must reference categories with applies_to: restaurant or both.',
        });
      }
    }

    const serviceZonesChanged     = req.body.service_zones !== undefined;
    const acceptingOrdersChanged  = req.body.is_accepting_orders !== undefined;

    for (const key of UPDATABLE) {
      if (req.body[key] !== undefined) {
        profile[key] = req.body[key];
      }
    }

    await profile.save();

    // If service zones changed, sync service_zone_ids on all meal products
    if (serviceZonesChanged) {
      await syncRestaurantServiceZones(vendor._id);
    }

    // Bust dine caches on any profile update — prep_time, cuisine_types, city, hours, etc.
    // all affect what buyers see on the dine page and restaurant menu.
    try {
      // Always bust this vendor's menu cache (prep time, opening hours, cuisine types, etc.)
      await cache.delete(`dine:menu:${vendor._id}`);
      // Bust the zone feed cache only when zone membership or open/closed status changes
      if (serviceZonesChanged || acceptingOrdersChanged) {
        for (const k of cache.keys ? cache.keys() : []) {
          if (k.startsWith('dine:v1:')) await cache.delete(k);
        }
      }
    } catch (_) { /* non-fatal */ }

    const populated = await RestaurantProfile.findById(profile._id)
      .populate('cuisine_types', 'name slug')
      .populate('service_zones.zone_id', 'name code type');

    res.status(200).json({ success: true, data: { profile: populated } });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/dine
// @desc    District-scoped restaurant + meal discovery feed
// @access  Public
// ─────────────────────────────────────────────
const getDinePage = async (req, res, next) => {
  try {
    const { zone_id, cuisine, meal_category, page = 1, include_closed } = req.query;

    if (!zone_id) {
      return res.status(400).json({ success: false, message: 'zone_id is required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(zone_id)) {
      return res.status(400).json({ success: false, message: 'zone_id is not a valid ObjectId.' });
    }

    // Resolve cuisine filter early so it can be applied to both restaurants and meals
    const cuisineObjId = cuisine && mongoose.Types.ObjectId.isValid(cuisine)
      ? new mongoose.Types.ObjectId(cuisine)
      : null;

    const cacheKey = `dine:v1:${zone_id}:${cuisine || ''}:${meal_category || ''}:${page}:${include_closed || ''}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json(cached);

    const zoneObjId = new mongoose.Types.ObjectId(zone_id);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const PAGE_SIZE = 20;

    // 1. Resolve the requested zone
    const zone = await LogisticZone.findById(zoneObjId).select('name code type parent_id ancestors').lean();
    if (!zone) {
      return res.status(404).json({ success: false, message: 'Zone not found.' });
    }

    // 2. Find restaurant profiles.
    //    City/region zone → all restaurants whose city_zone_id matches (every district in the city).
    //    District/quartier zone → restaurants that EITHER explicitly serve this district
    //    OR are registered at the city level with no specific district restrictions (city-wide).
    const isCityZone = zone.type === 'city' || zone.type === 'region';

    // Resolve the parent city zone id for district-level queries
    let parentCityId = null;
    if (!isCityZone && zone.parent_id) {
      parentCityId = new mongoose.Types.ObjectId(zone.parent_id?._id ?? zone.parent_id);
    }

    const profileFilter = isCityZone
      ? { city_zone_id: zoneObjId, is_active: { $ne: false } }
      : {
          is_active: { $ne: false },
          $or: [
            { 'service_zones.zone_id': zoneObjId },
            // City-wide restaurants (empty service_zones = no district restriction) in the parent city
            ...(parentCityId
              ? [{ city_zone_id: parentCityId, 'service_zones.0': { $exists: false } }]
              : []),
          ],
        };
    // 24/7 mode — show all restaurants regardless of is_accepting_orders

    const allProfiles = await RestaurantProfile.find(profileFilter)
      .select('vendor_id city_zone_id cuisine_types opening_hours prep_time_minutes is_accepting_orders service_zones')
      .populate('cuisine_types', 'name slug _id')
      .lean();

    const totalCount = allProfiles.length;
    const profiles = allProfiles.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
    const vendorIds = profiles.map(p => p.vendor_id);

    // 3. Build restaurant cards in parallel
    const UserSubscription = require('../models/UserSubscription.model');
    const [vendors, stores, activeSubUserIds] = await Promise.all([
      Vendor.find({ _id: { $in: vendorIds } }).select('_id store_name rating num_reviews verified').lean(),
      Store.find({ vendor_id: { $in: vendorIds } }).select('vendor_id minimum_order_amount logo banner').lean(),
      UserSubscription.distinct('user_id', { role: 'logistics', status: 'active' }),
    ]);

    // Check delivery coverage per unique city_zone_id (one DB check per city, not per restaurant)
    const uniqueCityIds = [...new Set(profiles.map(p => p.city_zone_id?.toString()).filter(Boolean))];
    const coverageMap = {};
    await Promise.all(uniqueCityIds.map(async (cid) => {
      coverageMap[cid] = await hasCoverageInCity(cid, activeSubUserIds);
    }));

    // D-4: Compute delivery_fee_estimate for the buyer's zone.
    let deliveryFeeEstimate = null;
    if (vendorIds.length > 0) {
      try {
        const eligibleFirms = await getCompatibleFirms(zone.name, vendorIds.slice(0, 1));
        if (eligibleFirms.length > 0) {
          const fees = await calculateShipmentFees(
            [{ _id: vendorIds[0], pickup_address: {} }],
            zone.name,
            eligibleFirms[0]._id
          );
          deliveryFeeEstimate = fees.perShipmentFee;
        }
      } catch (_) {
        // non-fatal — estimate shown as null when zone not in any firm's pricing
      }
    }

    const vendorMap  = Object.fromEntries(vendors.map(v => [v._id.toString(), v]));
    const storeMap   = Object.fromEntries(stores.map(s => [s.vendor_id.toString(), s]));
    const profileMap = Object.fromEntries(profiles.map(p => [p.vendor_id.toString(), p]));

    // 4. Fetch all active meals for this zone (no meal_category filter yet — applied per-section below)
    const mealProductFilter = {
      vendor_id: { $in: vendorIds },
      status:    'active',
      'meal':    { $exists: true, $ne: null },
      'meal.is_available_today': { $ne: false },
    };
    // For district zones: include meals that explicitly cover this district OR have no zone
    // restriction at all (city-wide meals from the vendors already in the vendor list).
    // vendorIds already scoped to matching restaurants, so no extra zone filter needed here.
    if (!isCityZone) {
      mealProductFilter.$or = [
        { service_zone_ids: zoneObjId },
        { service_zone_ids: { $size: 0 } },
        { service_zone_ids: { $exists: false } },
      ];
    }

    const allMeals = await Product.find(mealProductFilter)
      .select('vendor_id name price images rating category_id category meal.prep_time_minutes')
      .sort({ rating: -1 })
      .lean();

    // Resolve meal_category ObjectId to a name string for legacy meal fallback matching
    const mealCatObjId = meal_category && mongoose.Types.ObjectId.isValid(meal_category)
      ? new mongoose.Types.ObjectId(meal_category)
      : null;
    let mealCatName = null;
    if (mealCatObjId) {
      const mealCatDoc = await Category.findById(mealCatObjId).select('name').lean();
      mealCatName = mealCatDoc?.name || null;
    }

    // Helper: does a meal match the active meal_category filter?
    // Supports both category_id (new) and category string (legacy).
    const mealMatchesCat = (meal) => {
      if (!mealCatObjId) return true;
      if (meal.category_id && meal.category_id.toString() === mealCatObjId.toString()) return true;
      if (!meal.category_id && mealCatName && meal.category === mealCatName) return true;
      return false;
    };

    // Top-3 meals per restaurant for carousel cards (apply meal_category filter here)
    const mealsByVendor = {};
    for (const meal of allMeals) {
      if (!mealMatchesCat(meal)) continue;
      const vid = meal.vendor_id.toString();
      if (!mealsByVendor[vid]) mealsByVendor[vid] = [];
      if (mealsByVendor[vid].length < 3) mealsByVendor[vid].push(meal);
    }

    // When meal_category is active, only show restaurants that have at least one matching meal
    const mealCatVendorIdSet = mealCatObjId
      ? new Set(allMeals.filter(mealMatchesCat).map(m => m.vendor_id.toString()))
      : null;

    // 5. Build restaurant list, filtered by meal_category OR cuisine and sorted by num_reviews
    const restaurants = profiles
      .filter(p => {
        // Skip orphan profiles whose vendor document no longer exists (hard-deleted vendors)
        if (!vendorMap[p.vendor_id.toString()]) return false;
        if (mealCatVendorIdSet) return mealCatVendorIdSet.has(p.vendor_id.toString());
        if (!cuisineObjId) return true;
        return (p.cuisine_types || []).some(ct => ct._id.toString() === cuisineObjId.toString());
      })
      .map(profile => {
        const vendor = vendorMap[profile.vendor_id.toString()] || {};
        const store  = storeMap[profile.vendor_id.toString()] || {};
        const { open_status, next_status_change_at } = computeOpenStatus(profile.opening_hours);
        const topMeals = (mealsByVendor[profile.vendor_id.toString()] || []).map(m => ({
          _id:           m._id,
          name:          m.name,
          price:         m.price,
          thumbnail_url: m.images?.[0]?.url || null,
        }));

        const cityIdStr = profile.city_zone_id?.toString();
        return {
          vendor_id:            profile.vendor_id,
          store_name:           vendor.store_name || '',
          logo_url:             store.logo || null,
          banner_url:           store.banner || null,
          cuisine_types:        profile.cuisine_types || [],
          is_accepting_orders:  profile.is_accepting_orders,
          open_status,
          next_status_change_at,
          min_order_amount:     store.minimum_order_amount || null,
          prep_time_minutes:    profile.prep_time_minutes,
          top_meals:            topMeals,
          rating:               vendor.rating || 0,
          num_reviews:          vendor.num_reviews || 0,
          is_verified:          vendor.verified || false,
          delivery_available:    cityIdStr ? (coverageMap[cityIdStr] ?? true) : true,
          delivery_fee_estimate: deliveryFeeEstimate,
        };
      })
      // Sort by top-visited (num_reviews desc), then by rating
      .sort((a, b) => (b.num_reviews - a.num_reviews) || (b.rating - a.rating));

    // 6. Build flat meals discovery feed (cuisine + meal_category filtered, top 60 by rating)
    //    Cuisine filter on meals: only include meals from cuisine-matched restaurants
    const cuisineMatchedVendorIdSet = cuisineObjId
      ? new Set(
          profiles
            .filter(p => (p.cuisine_types || []).some(ct => ct._id.toString() === cuisineObjId.toString()))
            .map(p => p.vendor_id.toString())
        )
      : null;

    const meals = allMeals
      .filter(m => {
        if (cuisineMatchedVendorIdSet && !cuisineMatchedVendorIdSet.has(m.vendor_id?.toString())) return false;
        if (!mealMatchesCat(m)) return false;
        return true;
      })
      .slice(0, 60)
      .map(m => ({
        _id:                 m._id,
        name:                m.name,
        price:               m.price,
        thumbnail_url:       m.images?.[0]?.url || null,
        rating:              m.rating || 0,
        num_reviews:         vendorMap[m.vendor_id?.toString()]?.num_reviews || 0,
        category_id:         m.category_id || null,
        vendor_id:           m.vendor_id,
        restaurant_name:     vendorMap[m.vendor_id?.toString()]?.store_name || '',
        restaurant_logo_url: storeMap[m.vendor_id?.toString()]?.logo || null,
        prep_time_minutes:   m.meal?.prep_time_minutes || profileMap[m.vendor_id?.toString()]?.prep_time_minutes || null,
      }));

    // 7. Cuisine types and meal categories for filters
    //    meal_categories: only include categories that have actual meals in this zone
    // 7a. Cuisine types — derived from allProfiles, so only types with actual
    //     restaurants in this zone appear. Sorted alphabetically. No extra DB query.
    const cuisineTypeMap = {};
    for (const profile of allProfiles) {
      for (const ct of (profile.cuisine_types || [])) {
        if (ct._id) cuisineTypeMap[ct._id.toString()] = { _id: ct._id, name: ct.name, slug: ct.slug };
      }
    }
    const cuisineTypes = Object.values(cuisineTypeMap).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );

    // 7b. Meal categories — only categories that have at least one meal in this zone.
    //     Includes top-level categories (parent_id: null) so they appear in the filter bar.
    //     Also handles legacy meals (category_id=null but category string set).
    const activeCatIdSet = new Set(allMeals.map(m => m.category_id?.toString()).filter(Boolean));
    // For legacy meals, resolve category names → IDs so they appear in the filter bar
    const legacyMealNames = [...new Set(allMeals.filter(m => !m.category_id && m.category).map(m => m.category))];
    if (legacyMealNames.length) {
      const legacyCats = await Category.find({ name: { $in: legacyMealNames } }).select('_id').lean();
      for (const c of legacyCats) activeCatIdSet.add(c._id.toString());
    }
    const mealCategories = await Category.find({
      applies_to: { $in: ['restaurant', 'both'] },
      is_active: true,
    }).select('name slug _id parent_id').lean();
    const filteredMealCategories = mealCategories.filter(c => activeCatIdSet.has(c._id.toString()));

    // 8. Resolve city name for display
    let cityName = null;
    if (isCityZone) {
      cityName = zone.name;
    } else if (zone.parent_id) {
      const parentDoc = await LogisticZone.findById(zone.parent_id).select('name').lean();
      cityName = parentDoc?.name || null;
    } else if (zone.ancestors?.length) {
      const parentDoc = await LogisticZone.findById(zone.ancestors[0]).select('name').lean();
      cityName = parentDoc?.name || null;
    }

    const response = {
      success: true,
      data: {
        zone: {
          _id:  zone._id,
          name: zone.name,
          code: zone.code,
          city: cityName,
        },
        restaurants,
        meals,
        cuisine_types:   cuisineTypes,
        meal_categories: filteredMealCategories,
        pagination: {
          page:        pageNum,
          page_size:   PAGE_SIZE,
          total:       totalCount,
          total_pages: Math.ceil(totalCount / PAGE_SIZE),
        },
      },
    };

    await cache.set(cacheKey, response, DINE_CACHE_TTL_SECONDS);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/dine/restaurant/:vendor_id
// @desc    Full menu for a single restaurant (restaurant detail page)
// @access  Public
// ─────────────────────────────────────────────
const getRestaurantMenu = async (req, res, next) => {
  try {
    const { vendor_id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(vendor_id)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor_id.' });
    }

    const cacheKey = `dine:menu:${vendor_id}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.status(200).json(cached);

    const [vendor, store, profile, meals] = await Promise.all([
      Vendor.findById(vendor_id).select('store_name rating num_reviews verified').lean(),
      Store.findOne({ vendor_id }).select('logo banner').lean(),
      RestaurantProfile.findOne({ vendor_id })
        .populate('cuisine_types', 'name slug _id')
        .populate('service_zones.zone_id', 'name code')
        .lean(),
      // Include all active products — meals AND plain products (vendor may not have set meal field yet)
      // Exclude meals explicitly marked unavailable today
      Product.find({ vendor_id, status: 'active', 'meal.is_available_today': { $ne: false } })
        .select('name price images rating meal category_id category service_zone_ids')
        .populate('category_id', 'name slug _id')
        .sort({ rating: -1 })
        .lean(),
    ]);

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    // Profile may not exist yet (restaurant still setting up) — use safe defaults
    const { open_status, next_status_change_at } = computeOpenStatus(profile?.opening_hours);

    // Step 9: check if any eligible firm covers this restaurant's city
    const deliveryAvailable = profile?.city_zone_id
      ? await hasCoverageInCity(profile.city_zone_id)
      : true;

    // Batch-resolve category name → Category doc for legacy meals (category_id not yet set).
    // New meals have category_id populated directly; this covers meals created before the fix.
    const legacyNames = [...new Set(
      meals.filter(m => !m.category_id?._id && m.category).map(m => m.category)
    )];
    const legacyCatDocs = legacyNames.length
      ? await Category.find({ name: { $in: legacyNames } }).select('_id name slug').lean()
      : [];
    const catByName = Object.fromEntries(legacyCatDocs.map(c => [c.name, c]));

    // Group meals by category _id (not name — avoids collisions if two categories share a name)
    const mealsByCategoryId = {};
    const uncategorised = [];
    for (const meal of meals) {
      const catDoc = meal.category_id?._id ? meal.category_id : (catByName[meal.category] || null);
      if (catDoc?._id) {
        const catId = catDoc._id.toString();
        if (!mealsByCategoryId[catId]) {
          mealsByCategoryId[catId] = { category: catDoc, items: [] };
        }
        mealsByCategoryId[catId].items.push(meal);
      } else {
        uncategorised.push(meal);
      }
    }
    // 'Other' only appears when truly uncategorised meals exist; sorted to end
    if (uncategorised.length) mealsByCategoryId['__other__'] = { category: null, items: uncategorised };

    // Sort sections: most items first; uncategorised last
    const mealsByCategory = Object.values(mealsByCategoryId).sort((a, b) => {
      if (!a.category) return 1;
      if (!b.category) return -1;
      return (b.items.length || 0) - (a.items.length || 0);
    });

    const response = {
      success: true,
      data: {
        vendor: {
          _id:         vendor._id,
          store_name:  vendor.store_name,
          logo_url:    store?.logo || null,
          banner_url:  store?.banner || null,
          rating:      vendor.rating || 0,
          num_reviews: vendor.num_reviews || 0,
          verified:    vendor.verified || false,
        },
        profile: {
          cuisine_types:        profile?.cuisine_types || [],
          opening_hours:        profile?.opening_hours || [],
          prep_time_minutes:    profile?.prep_time_minutes || 20,
          is_accepting_orders:  profile?.is_accepting_orders ?? true,
          open_status:          open_status || 'open',
          next_status_change_at,
          service_zones:        profile?.service_zones || [],
          delivery_available:   deliveryAvailable,
        },
        menu: mealsByCategory,
      },
    };

    await cache.set(cacheKey, response, DINE_CACHE_TTL_SECONDS);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOwnProfile,
  createProfile,
  updateProfile,
  getDinePage,
  getRestaurantMenu,
  computeOpenStatus, // exported for use in order checkout validation
};
