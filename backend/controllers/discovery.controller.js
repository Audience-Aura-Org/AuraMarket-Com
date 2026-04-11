const Product = require('../models/Product.model');
const UserActivity = require('../models/UserActivity.model');
const Vendor = require('../models/Vendor.model');
const Store = require('../models/Store.model');

/**
 * GET /api/discovery/new
 */
const getNewArrivals = async (req, res, next) => {
  try {
    const products = await Product.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(12)
      .populate({
        path: 'vendor_id',
        select: 'store_name rating verified average_response_time user_id',
        populate: { path: 'store', select: 'logo' }
      });

    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/discovery/trending
 */
const getTrending = async (req, res, next) => {
  try {
    const products = await Product.find({ status: 'active' })
      .sort({ view_count: -1, wishlist_count: -1 })
      .limit(12)
      .populate({
        path: 'vendor_id',
        select: 'store_name rating verified average_response_time user_id',
        populate: { path: 'store', select: 'logo' }
      });

    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/discovery/popular
 */
const getPopular = async (req, res, next) => {
  try {
    const products = await Product.find({ status: 'active' })
      .sort({ purchase_count: -1, rating: -1 })
      .limit(12)
      .populate({
        path: 'vendor_id',
        select: 'store_name rating verified average_response_time user_id',
        populate: { path: 'store', select: 'logo' }
      });

    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/discovery/recommended
 */
const getRecommended = async (req, res, next) => {
  try {
    const userId = req.user ? req.user._id : null;
    
    if (!userId) {
      const products = await Product.find({ status: 'active' })
        .sort({ view_count: -1, rating: -1 })
        .limit(12)
        .populate({
          path: 'vendor_id',
          select: 'store_name rating verified average_response_time user_id',
          populate: { path: 'store', select: 'logo' }
        });
      return res.status(200).json({ success: true, data: products });
    }

    const recentActivities = await UserActivity.find({ user_id: userId })
      .sort({ timestamp: -1 })
      .limit(50);

    const categories = recentActivities.map(a => a.category).filter(c => !!c);
    const favCategory = categories.length > 0 
      ? categories.reduce((a, b) => (categories.filter(v => v === a).length >= categories.filter(v => v === b).length ? a : b))
      : null;

    let query = { status: 'active' };
    if (favCategory) query.category = favCategory;

    const products = await Product.find(query)
      .sort({ view_count: -1, rating: -1 })
      .limit(12)
      .populate({
        path: 'vendor_id',
        select: 'store_name rating verified average_response_time user_id',
        populate: { path: 'store', select: 'logo' }
      });

    res.status(200).json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/discovery/vendors
 */
const getTopVendors = async (req, res, next) => {
  try {
    const vendors = await Vendor.find()
      .select('store_name rating verified description average_response_time')
      .populate('store', 'logo banner categories')
      .sort({ rating: -1 })
      .limit(10);

    res.status(200).json({ success: true, data: vendors });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/discovery/feed
 */
const getDiscoveryFeed = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const userId = req.user ? req.user._id : null;

    let userInterestCategories = [];
    if (userId) {
      const recentActions = await UserActivity.find({ user_id: userId }).sort({ timestamp: -1 }).limit(20);
      userInterestCategories = [...new Set(recentActions.map(a => a.category).filter(c => !!c))];
    }

    const products = await Product.aggregate([
      { $match: { status: 'active' } },
      {
        $addFields: {
          popularity_score: { $add: ["$purchase_count", { $divide: ["$view_count", 10] }] },
          user_interest_match: { $cond: { if: { $in: ["$category", userInterestCategories] }, then: 10, else: 0 } },
          recency_score: { $divide: [{ $toLong: "$createdAt" }, 1000000000] },
          rating_score: "$rating"
        }
      },
      {
        $addFields: {
          discovery_score: {
            $add: [
              { $multiply: ["$popularity_score", 0.3] },
              { $multiply: ["$user_interest_match", 0.4] },
              { $multiply: ["$rating_score", 0.1] },
              { $multiply: ["$recency_score", 0.2] }
            ]
          }
        }
      },
      { $sort: { discovery_score: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendor_id',
          foreignField: '_id',
          as: 'vendor_data'
        }
      },
      { $unwind: "$vendor_data" },
      {
        $lookup: {
          from: 'stores',
          localField: 'vendor_data._id',
          foreignField: 'vendor_id',
          as: 'store_data'
        }
      },
      { $unwind: { path: "$store_data", preserveNullAndEmptyArrays: true } }
    ]);

    const formattedProducts = products.map(p => ({
      ...p,
      vendor_id: {
        _id: p.vendor_data._id,
        user_id: p.vendor_data.user_id,
        store_name: p.vendor_data.store_name,
        rating: p.vendor_data.rating,
        verified: p.vendor_data.verified,
        average_response_time: p.vendor_data.average_response_time,
        store: p.store_data ? { logo: p.store_data.logo } : null
      }
    }));

    res.status(200).json({ success: true, page, count: products.length, data: formattedProducts });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNewArrivals,
  getTrending,
  getPopular,
  getRecommended,
  getTopVendors,
  getDiscoveryFeed
};
