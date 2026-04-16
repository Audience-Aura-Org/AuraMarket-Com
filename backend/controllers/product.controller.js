/**
 * controllers/product.controller.js
 * Aura Market — Product Management Controller
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
      try {
        productData.tags = JSON.parse(req.body.tags);
      } catch (e) {}
    }

    const product = await Product.create(productData);

    const { notifyFollowers } = require('../utils/notifier');
    notifyFollowers(req.app, vendor._id, {
      title: 'New Arrival Alert!',
      message: `${vendor.store_name} has just deployed a new item: ${product.name}`,
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
    const removeFields = ['select', 'sort', 'page', 'limit', 'search', 'minPrice', 'maxPrice'];
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

    if (parsedQuery.category && typeof parsedQuery.category === 'string') {
      const targetCategoryName = parsedQuery.category;
      const targetCategory = await Category.findOne({ name: targetCategoryName });
      
      if (targetCategory) {
        const allCategories = await Category.find();
        let validCategoryNames = [targetCategoryName];
        let toCheck = [targetCategory._id.toString()];
        let foundNew = true;
        while (foundNew) {
           foundNew = false;
           for(let i=0; i < allCategories.length; i++) {
              if (allCategories[i].parent_id && toCheck.includes(allCategories[i].parent_id.toString()) && !validCategoryNames.includes(allCategories[i].name)) {
                 validCategoryNames.push(allCategories[i].name);
                 toCheck.push(allCategories[i]._id.toString());
                 foundNew = true;
              }
           }
        }
        parsedQuery.category = { $in: validCategoryNames };
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

    if (!product || product.status !== 'active') {
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
      try {
        updateData.tags = JSON.parse(req.body.tags);
      } catch (e) {}
    }

    delete updateData.featured;
    delete updateData.existing_images;
    delete updateData.vendor_id;
    delete updateData._id;

    const oldStock = product.stock;
    const newStock = updateData.stock !== undefined ? Number(updateData.stock) : oldStock;

    product = await Product.findByIdAndUpdate(req.params.id, { $set: updateData }, { returnDocument: 'after', runValidators: true });

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

    const sort = req.query.sort || '-createdAt';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // 2. Prepare recommendation query
    let query = { status: 'active' };
    if (followedVendorIds.length > 0) {
      query.vendor_id = { $nin: followedVendorIds };
    }
    
    if (req.query.category) {
      const targetCategoryName = req.query.category;
      const targetCategory = await Category.findOne({ name: targetCategoryName }).lean();
      
      if (targetCategory) {
        // Optimized category search: just get immediate subcategories for performance
        const subCategories = await Category.find({ 
          $or: [{ _id: targetCategory._id }, { parent_id: targetCategory._id }] 
        }).select('name').lean();
        query.category = { $in: subCategories.map(c => c.name) };
      } else {
        query.category = targetCategoryName;
      }
    } else if (categoryIds.length > 0) {
      query.category = { $in: categoryIds };
    }

    // 3. Parallelize product fetching and counting
    const followedProductsPromise = (followedVendorIds.length > 0 && page === 1)
      ? Product.find({ status: 'active', vendor_id: { $in: followedVendorIds } })
          .populate({
            path: 'vendor_id',
            select: 'store_name rating verified pickup_address user_id average_response_time',
            populate: [
              { path: 'store', select: 'logo' },
              { path: 'user_id', select: 'avatar branding' }
            ]
          })
          .sort(sort)
          .limit(10)
          .lean()
      : Promise.resolve([]);

    const [followedProducts, productsRaw, total] = await Promise.all([
      followedProductsPromise,
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

    // 4. Fallback for sparse results (Page 1)
    if (products.length < 5 && page === 1) {
      const excludeIds = [...followedProducts, ...products].map(p => p._id);
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
        followedProducts,
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
