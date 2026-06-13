/**
 * controllers/product.controller.js
 * Auradime — Product Management Controller
 *
 * Handles CRUD operations for products + public discovery/search endpoints.
 */

const Product = require('../models/Product.model');
const Vendor = require('../models/Vendor.model');
const RecentlyViewed = require('../models/RecentlyViewed.model');
const StockWatch = require('../models/StockWatch.model');
const Category = require('../models/Category.model');
const { sendNotification } = require('../utils/notifier');
const cache = require('../utils/cache');
const { normalizeUserMedia, normalizeMediaUrl } = require('../utils/media');

const normalizeSalePricing = (data = {}, existingProduct = null) => {
  const nextPrice = data.price !== undefined ? Number(data.price) : Number(existingProduct?.price || 0);
  const rawSalePrice = data.sale_price;

  if (rawSalePrice === '' || rawSalePrice === null || rawSalePrice === undefined) {
    data.sale_price = null;
    data.on_sale = false;
    return;
  }

  const salePrice = Number(rawSalePrice);
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    const error = new Error('Sale price must be a valid positive amount.');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(nextPrice) || nextPrice <= 0 || salePrice >= nextPrice) {
    const error = new Error('Sale price must be lower than the regular price.');
    error.statusCode = 400;
    throw error;
  }

  data.sale_price = salePrice;
  data.on_sale = true;
};

const resolveCategoryNames = async ({ categoryId, categoryName, includeDescendants = true }) => {
  const hasCategoryId = categoryId && /^[a-f\d]{24}$/i.test(String(categoryId));
  const hasCategoryName = categoryName && typeof categoryName === 'string';
  if (!hasCategoryId && !hasCategoryName) return null;

  const targetCategory = hasCategoryId
    ? await Category.findById(categoryId).lean()
    : await Category.findOne({ name: categoryName }).lean();

  if (!targetCategory) {
    return hasCategoryName ? [categoryName] : [];
  }

  if (!includeDescendants) return [targetCategory.name];

  const allCategories = await Category.find({ is_active: { $ne: false } }).select('_id parent_id name').lean();
  const validCategoryNames = [targetCategory.name];
  const toCheck = [targetCategory._id.toString()];

  for (let index = 0; index < toCheck.length; index += 1) {
    const parentId = toCheck[index];
    allCategories.forEach((cat) => {
      if (
        cat.parent_id &&
        cat.parent_id.toString() === parentId &&
        !validCategoryNames.includes(cat.name)
      ) {
        validCategoryNames.push(cat.name);
        toCheck.push(cat._id.toString());
      }
    });
  }

  return validCategoryNames;
};

// ─────────────────────────────────────────────
// @route   POST /api/products
// @desc    Create a new product
// ─────────────────────────────────────────────
const createProduct = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      const protocol = req.protocol;
      const host = req.get('host');
      req.files.forEach(file => {
        const url = file.path || file.location || file.url || `${protocol}://${host}/uploads/${file.filename}`;
        imageUrls.push({ url });
      });
    }

    const productData = { 
      ...req.body, 
      vendor_id: vendor._id,
      images: imageUrls 
    };

    if (req.body.tags && typeof req.body.tags === 'string') {
      try { productData.tags = JSON.parse(req.body.tags); } catch (e) {}
    }
    if (req.body.variant_types && typeof req.body.variant_types === 'string') {
      try { productData.variant_types = JSON.parse(req.body.variant_types); } catch (e) {}
    }
    if (req.body.sku_variants && typeof req.body.sku_variants === 'string') {
      try { productData.sku_variants = JSON.parse(req.body.sku_variants); } catch (e) {}
    }
    if (req.body.has_variants === 'true') productData.has_variants = true;
    if (req.body.has_variants === 'false') productData.has_variants = false;
    normalizeSalePricing(productData);

    const product = await Product.create(productData);

    const { notifyFollowers } = require('../utils/notifier');

    // Notify vendor's followers about the new product
    notifyFollowers(req.app, vendor._id, {
      title: 'New Arrival Alert!',
      message: `${vendor.store_name} has just deployed a new item: ${product.name}`,
      metadata: { target_id: product._id, link: `/products/${product._id}` }
    });

    // Notify the vendor themselves with a confirmation
    await sendNotification(req.app, vendor.user_id, {
      title: '✅ Product Published',
      message: `"${product.name}" is now live in your store and visible to buyers.`,
      type: 'system_alert',
      metadata: { target_id: product._id, link: `/products/${product._id}` }
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────────
// @route   GET /api/products
// @desc    Get all products
// ─────────────────────────────────────────────
const getProducts = async (req, res, next) => {
  try {
    const cacheKey = `products_${JSON.stringify(req.query)}`;
    const cachedData = await cache.get(cacheKey);
    if (cachedData) return res.status(200).json(cachedData);

    let query;
    const reqQuery = { ...req.query };
    const removeFields = ['select', 'sort', 'page', 'limit', 'search', 'minPrice', 'maxPrice', 'categoryId'];
    removeFields.forEach((param) => delete reqQuery[param]);

    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, (match) => `$${match}`);

    const parsedQuery = JSON.parse(queryStr);
    parsedQuery.status = 'active';

    if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
      const priceQuery = {};
      if (req.query.minPrice !== undefined) priceQuery.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice !== undefined) priceQuery.$lte = parseFloat(req.query.maxPrice);
      parsedQuery.price = priceQuery;
    }

    const categoryNames = await resolveCategoryNames({
      categoryId: req.query.categoryId,
      categoryName: parsedQuery.category,
      includeDescendants: true,
    });
    if (categoryNames) {
      if (categoryNames.length) {
        parsedQuery.category = { $in: categoryNames };
      } else {
        parsedQuery.category = '__NO_MATCH__';
      }
    }

    if (req.query.search) parsedQuery.$text = { $search: req.query.search };

    query = Product.find(parsedQuery).populate({
      path: 'vendor_id',
      select: 'store_name rating verified user_id average_response_time',
      populate: [
        { path: 'store', select: 'logo' },
        { path: 'user_id', select: 'avatar branding' }
      ]
    });

    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;
    query = query.skip(startIndex).limit(limit);

    const products = await query;
    const total = await Product.countDocuments(parsedQuery);

    // Normalize nested media URLs for vendor users and store assets
    const productsPlain = products.map(p => {
      const obj = (p && typeof p.toObject === 'function') ? p.toObject() : p;
      try {
        if (obj.vendor_id && obj.vendor_id.user_id) normalizeUserMedia(obj.vendor_id.user_id);
        if (obj.vendor_id && obj.vendor_id.store) {
          if (obj.vendor_id.store.logo) obj.vendor_id.store.logo = normalizeMediaUrl(obj.vendor_id.store.logo);
          if (obj.vendor_id.store.banner) obj.vendor_id.store.banner = normalizeMediaUrl(obj.vendor_id.store.banner);
        }
      } catch (err) {}
      return obj;
    });

    const responseData = {
      success: true,
      count: productsPlain.length,
      pagination: { total, page, pages: Math.ceil(total / limit) },
      data: { products: productsPlain },
    };

    await cache.set(cacheKey, responseData, 60);
    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/products/:id
// ─────────────────────────────────────────────
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate({
      path: 'vendor_id',
      select: 'store_name description rating verified user_id average_response_time',
      populate: [
        { path: 'store', select: 'banner logo expected_shipping_time' },
        { path: 'user_id', select: 'avatar branding' }
      ]
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Allow the owning vendor to fetch their own product regardless of status
    // (needed so the edit form can load pending/archived products).
    const isOwningVendor =
      req.vendor &&
      product.vendor_id &&
      product.vendor_id._id.toString() === req.vendor._id.toString();

    if (product.status !== 'active' && !isOwningVendor) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const prodObj = (product && typeof product.toObject === 'function') ? product.toObject() : product;
    if (prodObj.vendor_id && prodObj.vendor_id.user_id) normalizeUserMedia(prodObj.vendor_id.user_id);
    if (prodObj.vendor_id && prodObj.vendor_id.store) {
      if (prodObj.vendor_id.store.logo) prodObj.vendor_id.store.logo = normalizeMediaUrl(prodObj.vendor_id.store.logo);
      if (prodObj.vendor_id.store.banner) prodObj.vendor_id.store.banner = normalizeMediaUrl(prodObj.vendor_id.store.banner);
    }

    res.status(200).json({ success: true, data: { product: prodObj } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/products/:id
// ─────────────────────────────────────────────
const updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    if (product.vendor_id.toString() !== req.vendor._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    let finalImages = [];
    if (req.body.existing_images) {
      const existing = Array.isArray(req.body.existing_images) ? req.body.existing_images : [req.body.existing_images];
      existing.forEach(url => finalImages.push({ url }));
    }

    if (req.files && req.files.length > 0) {
      const protocol = req.protocol;
      const host = req.get('host');
      req.files.forEach(file => {
        const url = file.path || file.location || file.url || `${protocol}://${host}/uploads/${file.filename}`;
        finalImages.push({ url });
      });
    }

    if (!req.body.existing_images && (!req.files || req.files.length === 0)) finalImages = product.images;

    const updateData = { ...req.body };
    updateData.images = finalImages;

    if (req.body.tags && typeof req.body.tags === 'string') {
      try { updateData.tags = JSON.parse(req.body.tags); } catch (e) {}
    }
    if (req.body.variant_types && typeof req.body.variant_types === 'string') {
      try { updateData.variant_types = JSON.parse(req.body.variant_types); } catch (e) {}
    }
    if (req.body.sku_variants && typeof req.body.sku_variants === 'string') {
      try { updateData.sku_variants = JSON.parse(req.body.sku_variants); } catch (e) {}
    }
    if (req.body.has_variants === 'true') updateData.has_variants = true;
    if (req.body.has_variants === 'false') updateData.has_variants = false;
    normalizeSalePricing(updateData, product);

    delete updateData.featured;
    delete updateData.existing_images;
    delete updateData.vendor_id;
    delete updateData._id;

    const oldStock = product.stock;
    const newStock = updateData.stock !== undefined ? Number(updateData.stock) : oldStock;

    product = await Product.findByIdAndUpdate(req.params.id, { $set: updateData }, { returnDocument: 'after', runValidators: true });

    // ── Invalidate server-side cache ───────────────────────────────────
    // The GET /products/:id and GET /products list routes cache with the
    // pattern `products_<query>`. Wipe all matching keys so the next
    // fetch returns fresh data with the updated sale_price / fields.
    try {
      // Delete the per-product cache key used by getProductById (if any)
      const specificKey = `products_${JSON.stringify({ id: req.params.id })}`;
      await cache.delete(specificKey);

      // Sweep all in-memory keys that belong to the products namespace
      for (const key of cache.keys()) {
        if (key.startsWith('products_')) {
          await cache.delete(key);
        }
      }
    } catch (_cacheErr) {
      // Non-fatal — stale data will expire on its own
    }

    const vendor = req.vendor;
    const { notifyFollowers } = require('../utils/notifier');
    notifyFollowers(req.app, vendor._id, {
      title: 'Product Inventory Update',
      message: `${vendor.store_name} has updated details for one of their top listings: ${product.name}`,
      metadata: { target_id: product._id, link: `/products/${product._id}` }
    });

    if (oldStock === 0 && newStock > 0) {
      const watchers = await StockWatch.find({ product_id: product._id });
      for (const watch of watchers) {
        await sendNotification(req.app, watch.user_id, {
          title: 'Restock Alert!',
          message: `The product "${product.name}" is back in stock!`,
          type: 'system_alert'
        });
        await StockWatch.findByIdAndDelete(watch._id);
      }
    }

    res.status(200).json({ success: true, data: { product } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   DELETE /api/products/:id
// ─────────────────────────────────────────────
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    if (product.vendor_id.toString() !== req.vendor._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    product.status = 'archived';
    await product.save();

    res.status(200).json({ success: true, message: 'Product archived successfully.' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/products/:id/feature
// ─────────────────────────────────────────────
const toggleFeaturedStatus = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    product.featured = req.body.featured !== undefined ? req.body.featured : !product.featured;
    await product.save();

    res.status(200).json({ success: true, message: `Product featured status updated to ${product.featured}.`, data: { product } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/products/:id/view
// ─────────────────────────────────────────────
const trackProductView = async (req, res, next) => {
  try {
    if (!req.user) return res.status(204).send();

    await RecentlyViewed.findOneAndUpdate(
      { user_id: req.user._id, product_id: req.params.id },
      { viewed_at: new Date() },
      { upsert: true, returnDocument: 'after' }
    );

    // 🚀 NEW: Pulse increment the actual product's view_count for real-time analytics
    await Product.findByIdAndUpdate(req.params.id, { $inc: { view_count: 1 } });

    const viewCount = await RecentlyViewed.countDocuments({ user_id: req.user._id });
    if (viewCount > 20) {
      const oldest = await RecentlyViewed.find({ user_id: req.user._id }).sort({ viewed_at: 1 }).limit(1);
      if (oldest.length > 0) await RecentlyViewed.findByIdAndDelete(oldest[0]._id);
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/products/recommendations
// ─────────────────────────────────────────────
const getRecommendedProducts = async (req, res, next) => {
  try {
    const history = await RecentlyViewed.find({ user_id: req.user._id }).sort('-viewed_at').limit(5).populate('product_id', 'category');
    const categories = [...new Set(history.map(h => h.product_id?.category).filter(Boolean))];
    const excludedIds = history.map(h => h.product_id ? h.product_id._id : null).filter(Boolean);
    
    let query = { status: 'active', _id: { $nin: excludedIds } };
    if (categories.length > 0) query.category = { $in: categories };

    const recommendations = await Product.find(query)
      .populate({
        path: 'vendor_id',
        select: 'store_name rating verified user_id average_response_time',
        populate: [
          { path: 'store', select: 'logo' },
          { path: 'user_id', select: 'avatar branding' }
        ]
      })
      .limit(8)
      .sort('-rating');

    res.status(200).json({ success: true, count: recommendations.length, data: { recommendations } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/products/history
// ─────────────────────────────────────────────
const getRecentlyViewed = async (req, res, next) => {
  try {
    const history = await RecentlyViewed.find({ user_id: req.user._id }).sort('-viewed_at').limit(20).populate('product_id');
    res.status(200).json({ success: true, count: history.length, data: { history } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
const watchProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    await StockWatch.findOneAndUpdate({ user_id: req.user._id, product_id: req.params.id }, {}, { upsert: true, returnDocument: 'after' });
    res.status(200).json({ success: true, message: 'You will be notified when this product is restocked.' });
  } catch (error) {
    next(error);
  }
};

const getVendorProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ vendor_id: req.vendor._id, status: { $ne: 'archived' } }).sort('-createdAt');
    res.status(200).json({ success: true, count: products.length, data: { products } });
  } catch (error) {
    next(error);
  }
};

const getRelatedProducts = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    const limit = parseInt(req.query.limit) || 6;
    const related = await Product.find({
      _id: { $ne: product._id },
      status: 'active',
      $or: [{ category: product.category }, { vendor_id: product.vendor_id }]
    })
      .populate({
        path: 'vendor_id',
        select: 'store_name rating verified user_id average_response_time',
        populate: [
          { path: 'store', select: 'logo' },
          { path: 'user_id', select: 'avatar branding' }
        ]
      })
      .limit(limit)
      .sort('-popularity_score -createdAt');

    res.status(200).json({ success: true, count: related.length, data: { products: related } });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/products/hub
 */
const getHubFeed = async (req, res, next) => {
  try {
    const User = require('../models/User.model');
    const Follow = require('../models/Follow.model');
    
    // 1. Parallelize initial user and follow lookups
    const [user, follows] = await Promise.all([
      User.findById(req.user._id).lean(),
      Follow.find({ user_id: req.user._id }).lean()
    ]);
    
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const followedVendorIds = follows.map(f => f.vendor_id);
    const categoryIds = user.liked_categories || [];
    const isFollowedOnly = req.query.followedOnly === 'true' || req.query.followedOnly === true;

    const sort = req.query.sort || '-createdAt';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // If requesting followed-only feed and user hasn't followed anyone, return empty
    if (isFollowedOnly && followedVendorIds.length === 0) {
      return res.status(200).json({ 
        success: true, 
        pagination: { total: 0, page: 1, pages: 1, limit },
        data: { products: [] } 
      });
    }

    // 2. Prepare query based on followedOnly parameter
    let query = { status: 'active' };
    
    if (isFollowedOnly) {
      // When showing followed-only feed, include ONLY followed vendors
      query.vendor_id = { $in: followedVendorIds };
    } else {
      // When showing discovery feed, exclude followed vendors to show new content
      if (followedVendorIds.length > 0) {
        query.vendor_id = { $nin: followedVendorIds };
      }
    }
    
    if (req.query.category || req.query.categoryId) {
      const categoryNames = await resolveCategoryNames({
        categoryId: req.query.categoryId,
        categoryName: req.query.category,
        includeDescendants: true,
      });
      query.category = categoryNames?.length ? { $in: categoryNames } : '__NO_MATCH__';
    } else if (categoryIds.length > 0 && !isFollowedOnly) {
      // Only apply generic liked_categories if NOT viewing followed-only feed
      query.category = { $in: categoryIds };
    }

    // Add search filter
    if (req.query.search) {
      query.$text = { $search: req.query.search };
    }

    // Add price filter
    if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
      const priceQuery = {};
      if (req.query.minPrice !== undefined) priceQuery.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice !== undefined) priceQuery.$lte = parseFloat(req.query.maxPrice);
      query.price = priceQuery;
    }

    // 3. Fetch products and count
    const [productsRaw, total] = await Promise.all([
      Product.find(query)
        .populate({
          path: 'vendor_id',
          select: 'store_name rating verified pickup_address user_id average_response_time',
          populate: [
            { path: 'store', select: 'logo' },
            { path: 'user_id', select: 'avatar branding' }
          ]
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query)
    ]);

    let products = productsRaw;

    // 4. Fallback for sparse results (Page 1) - only for discovery feed, not followed-only
    if (!isFollowedOnly && products.length < 5 && page === 1) {
      const excludeIds = products.map(p => p._id);
      const recommended = await Product.find({ 
        status: 'active', 
        _id: { $nin: excludeIds } 
      })
      .populate({
        path: 'vendor_id',
        select: 'store_name rating verified pickup_address user_id average_response_time',
        populate: [
          { path: 'store', select: 'logo' },
          { path: 'user_id', select: 'avatar branding' }
        ]
      })
      .sort({ popularity_score: -1, createdAt: -1 })
      .limit(10)
      .lean();
      products = [...products, ...recommended];
    }

    res.status(200).json({ 
      success: true, 
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: { 
        products 
      } 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  toggleFeaturedStatus,
  trackProductView,
  getRecommendedProducts,
  getRecentlyViewed,
  watchProduct,
  getHubFeed,
  getVendorProducts,
  getRelatedProducts,
};
