/**
 * controllers/homepage.controller.js
 * Auradime — Storefront & Homepage Management
 */

const HomepageSection = require('../models/HomepageSection.model');
const Homepage = require('../models/Homepage.model');
const Product = require('../models/Product.model');
const Vendor = require('../models/Vendor.model');
const { normalizeMediaUrl } = require('../utils/media');
const { clearApiCache } = require('../middleware/cache.middleware');

const homepageLogState = new Map();

const logHomepageDebug = (key, message, intervalMs = 60000) => {
  if (process.env.HOMEPAGE_DEBUG_LOGS !== 'true') return;
  const now = Date.now();
  const last = homepageLogState.get(key) || 0;
  if (now - last < intervalMs) return;
  homepageLogState.set(key, now);
  console.log(message);
};

const normalizeHomepageMedia = (value) => {
  if (typeof value === 'string') return normalizeMediaUrl(value);
  if (Array.isArray(value)) return value.map(normalizeHomepageMedia);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      value[key] = normalizeHomepageMedia(value[key]);
    }
  }
  return value;
};

const clearHomepageCache = async () => {
  try {
    await clearApiCache();
  } catch (error) {
    console.warn(`[homepage] cache invalidation skipped: ${error.message}`);
  }
};

const sanitizeSectionPayload = (payload = {}) => {
  const nextPayload = { ...payload };

  ['scheduled_start', 'scheduled_end'].forEach((field) => {
    if (nextPayload[field] === '' || nextPayload[field] === undefined) {
      nextPayload[field] = null;
    }
  });

  return nextPayload;
};

const populateHomepageSections = (query) => HomepageSection.find(query)
  .sort({ order: 1 })
  .populate({
    path: 'data.product_id',
    select: 'name price compare_at_price has_variants sku_variants images rating stock vendor_id view_count purchase_count',
    populate: {
      path: 'vendor_id',
      select: 'store_name user_id',
      populate: { path: 'user_id', select: 'avatar branding' }
    }
  })
  .populate({
    path: 'data.vendor_id',
    select: 'store_name description rating verified follower_count user_id',
    populate: { path: 'store user_id', select: 'logo banner branding avatar' }
  })
  .lean();

const getLegacyHomepageSections = async () => {
  const layout = await Homepage.findOne({ version: 'v1' }).populate({
    path: 'featured_products.product_id',
    select: 'name price compare_at_price has_variants sku_variants images rating stock vendor_id view_count purchase_count',
    populate: {
      path: 'vendor_id',
      select: 'store_name user_id',
      populate: { path: 'user_id', select: 'avatar branding' }
    },
  }).lean();

  if (!layout) return [];

  const sections = [];
  const heroItems = (layout.hero_banners || [])
    .filter((banner) => banner && banner.is_active !== false && banner.image_url)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map((banner, index) => ({
      image_url: banner.image_url,
      link_to: banner.link_to || '/shop',
      headline: banner.headline || '',
      subtext: banner.subtext || '',
      cta_text: banner.cta_text || 'Shop now',
      display_order: banner.display_order ?? index,
    }));

  if (heroItems.length) {
    sections.push({
      _id: `${layout._id}-legacy-hero`,
      title: 'Hero banners',
      subtitle: '',
      type: 'hero',
      order: 1,
      is_active: true,
      config: {},
      data: heroItems,
      source: 'legacy_homepage',
    });
  }

  const featuredItems = (layout.featured_products || [])
    .filter((item) => item && item.product_id)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map((item, index) => ({
      product_id: item.product_id,
      display_order: item.display_order ?? index,
    }));

  if (featuredItems.length) {
    sections.push({
      _id: `${layout._id}-legacy-featured`,
      title: 'Featured products',
      subtitle: '',
      type: 'featured_products',
      order: 2,
      is_active: true,
      config: {},
      data: featuredItems,
      source: 'legacy_homepage',
    });
  }

  return sections;
};

/**
 * @route   GET /api/v1/homepage
 * @desc    Get the current dynamic homepage layout
 * @access  Public
 */
const getHomepage = async (req, res, next) => {
  try {
    const now = new Date();
    logHomepageDebug('fetch', `[homepage] GET /api/v1/homepage - fetching sections at ${now.toISOString()}`);
    
    const baseVisibilityQuery = {
      is_active: { $ne: false },
      'data.0': { $exists: true }
    };
    const scheduleWindowQuery = {
      ...baseVisibilityQuery,
      $and: [
        { $or: [{ scheduled_start: { $lte: now } }, { scheduled_start: null }, { scheduled_start: { $exists: false } }] },
        { $or: [{ scheduled_end: { $gte: now } }, { scheduled_end: null }, { scheduled_end: { $exists: false } }] }
      ]
    };

    let sections = await populateHomepageSections(scheduleWindowQuery);

    if (!sections.length) {
      logHomepageDebug('fallback-active', '[homepage] no scheduled public sections found; retrying active CMS sections without schedule window');
      sections = await populateHomepageSections(baseVisibilityQuery);
    }

    if (!sections.length) {
      logHomepageDebug('fallback-legacy', '[homepage] no modular CMS sections found; retrying legacy homepage layout');
      sections = await getLegacyHomepageSections();
    }
    
    const normalizedSections = normalizeHomepageMedia(sections);
    logHomepageDebug('count', `[homepage] fetched sections count: ${normalizedSections.length}`);

    res.status(200).json({
      success: true,
      count: normalizedSections.length,
      data: { sections: normalizedSections }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/admin/homepage-section
 * @desc    Create a new homepage section
 * @access  Private (Admin)
 */
const createSection = async (req, res, next) => {
  try {
    const section = await HomepageSection.create(sanitizeSectionPayload(req.body));
    await clearHomepageCache();
    res.status(201).json({ success: true, data: { section } });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/homepage-section/:id
 * @desc    Update an existing homepage section
 * @access  Private (Admin)
 */
const updateSection = async (req, res, next) => {
  try {
    const updates = sanitizeSectionPayload(req.body);
    const section = await HomepageSection.findByIdAndUpdate(
      req.params.id,
      updates,
      { returnDocument: 'after', runValidators: true }
    );
    
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });

    await clearHomepageCache();
    res.status(200).json({ success: true, data: { section } });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/admin/homepage-section/:id
 * @desc    Delete a homepage section
 * @access  Private (Admin)
 */
const deleteSection = async (req, res, next) => {
  try {
    const section = await HomepageSection.findByIdAndDelete(req.params.id);
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });
    
    await clearHomepageCache();
    res.status(200).json({ success: true, message: 'Section removed' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/homepage-section/reorder
 * @desc    Reorder multiple sections at once
 * @access  Private (Admin)
 */
const reorderSections = async (req, res, next) => {
  try {
    const { orders } = req.body; // Array of { id, order }
    
    const updates = orders.map(item => 
      HomepageSection.findByIdAndUpdate(item.id, { order: item.order })
    );
    
    await Promise.all(updates);
    await clearHomepageCache();
    
    res.status(200).json({ success: true, message: 'Homepage reordered successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/homepage/admin/sections
 * @desc    Get all sections for admin (includes inactive/scheduled)
 * @access  Private (Admin)
 */
const getAdminSections = async (req, res, next) => {
  try {
    const sections = await HomepageSection.find()
      .sort({ order: 1 })
      .populate({
        path: 'data.product_id',
        select: 'name price compare_at_price has_variants sku_variants images rating stock vendor_id view_count purchase_count',
        populate: { 
          path: 'vendor_id', 
          select: 'store_name user_id',
          populate: { path: 'user_id', select: 'avatar branding' }
        }
      })
      .populate({
        path: 'data.vendor_id',
        select: 'store_name description rating verified user_id',
        populate: [
          { path: 'store', select: 'logo banner' },
          { path: 'user_id', select: 'avatar branding' }
        ]
      });

    const normalizedSections = normalizeHomepageMedia(sections.map((section) => section.toObject ? section.toObject() : section));

    res.status(200).json({
      success: true,
      count: normalizedSections.length,
      data: { sections: normalizedSections }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHomepage,
  getAdminSections,
  createSection,
  updateSection,
  deleteSection,
  reorderSections
};
