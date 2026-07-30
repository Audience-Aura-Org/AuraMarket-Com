/**
 * controllers/vendor.controller.js
 * Auradime — Vendor & Store Management Controller
 *
 * Provides endpoints for users with 'vendor' roles to manage their profile
 * and their specialized shop representation (Store).
 */

const Vendor = require('../models/Vendor.model');
const Store = require('../models/Store.model');
const KYC = require('../models/KYC.model');
const Escrow = require('../models/Escrow.model');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const User = require('../models/User.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const mongoose = require('mongoose');
const Follow = require('../models/Follow.model');
const { escapeRegExp } = require('../middleware/security.middleware');

const normalizeNullableXafAmount = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    const error = new Error('Minimum order amount must be a non-negative XAF amount.');
    error.statusCode = 400;
    throw error;
  }
  return Math.round(num);
};

const normalizeNullableText = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
};
const normalizePickupAddress = (incoming = {}, previous = {}) => {
  const description =
    incoming.address_description ??
    incoming.street ??
    previous.address_description ??
    previous.street ??
    '';

  return {
    city: incoming.city ?? previous.city ?? '',
    quartier: incoming.quartier ?? previous.quartier ?? '',
    street: description,
    address_description: description,
    region: incoming.region ?? previous.region ?? '',
  };
};

// ─────────────────────────────────────────────
// @route   POST /api/vendors/onboard
// @desc    Register a logged-in User as a Vendor (Creates both Vendor & Store)
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const onboardVendor = async (req, res, next) => {
  console.log(`🚀 [ONBOARD] Starting onboarding for user: ${req.user?._id} (${req.user?.role})`);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { store_name, description, categories, phone, location } = req.body;
    console.log(`📦 [ONBOARD] Payload:`, { store_name, phone, location_city: location?.city });

    // 1. Check if vendor profile already exists for this user (WITHIN SESSION)
    let vendor = await Vendor.findOne({ user_id: req.user._id }).session(session);
    let store;

    if (vendor) {
      console.log(`[ONBOARD] Updating existing vendor: ${vendor._id}`);
      // Update existing profile (idempotent onboarding)
      vendor.store_name = store_name || vendor.store_name;
      vendor.description = description || vendor.description;
      vendor.phone = phone || req.user.phone || vendor.phone || '000000000';
      
      if (location) {
        vendor.pickup_address = normalizePickupAddress(location, vendor.pickup_address);
      }
      
      vendor.is_onboarded = true;
      vendor.onboarding_step = 'complete';
      await vendor.save({ session });

      store = await Store.findOne({ vendor_id: vendor._id }).session(session);
      if (store) {
        store.categories = categories || store.categories;
        await store.save({ session });
      } else {
        const storeArray = await Store.create(
          [{ vendor_id: vendor._id, categories: categories || [] }],
          { session }
        );
        store = storeArray[0];
      }
    } else {
      console.log(`[ONBOARD] Creating new vendor for user: ${req.user._id}`);
      // 2. Create the Vendor profile (new)
      const vendorArray = await Vendor.create(
        [
          {
            user_id: req.user._id,
            store_name,
            description,
            phone: phone || req.user.phone || '000000000',
            pickup_address: location ? normalizePickupAddress(location) : {},
            is_onboarded: true,
            onboarding_step: 'complete'
          },
        ],
        { session }
      );
      vendor = vendorArray[0];

      // 3. Create the Store associated with the new Vendor
      const storeArray = await Store.create(
        [
          {
            vendor_id: vendor._id,
            categories: categories || [],
          },
        ],
        { session }
      );
      store = storeArray[0];
    }

    // 4. Force mark user as onboarded and sync initial branding (if any)
    const User = require('../models/User.model');
    const brandingUpdates = {};
    if (store_name) brandingUpdates['branding.store_name'] = store_name; // and more if needed
    
    console.log(`✅ [ONBOARD] Successfully synchronized vendor/store for user: ${req.user._id}`);
    
    await User.findByIdAndUpdate(req.user._id, { 
      onboarded: true,
      phone: phone || req.user.phone || '',
      onboarding_location: location ? {
        city: location.city || '',
        quartier: location.quartier || '',
        address_description: location.address_description || ''
      } : req.user.onboarding_location,
      ...(brandingUpdates)
    }, { session });

    // Commit Transaction
    await session.commitTransaction();
    session.endSession();

    // Fetch updated user to return
    const updatedUser = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Vendor and Store synchronized successfully.',
      data: {
        vendor,
        store,
        user: updatedUser
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    console.error('[ONBOARD_ERROR]', error);
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/vendors/me
// @desc    Get the current logged-in vendor & their store details
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const getVendorProfile = async (req, res, next) => {
  try {
    // Populate store and specific user fields
    const vendor = await Vendor.findById(req.vendor._id)
      .populate('store')
      .populate('user_id', 'branding avatar');

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    // Calculate pending escrow balance and real follower count in parallel
    const [escrowStats, realFollowerCount] = await Promise.all([
      Escrow.aggregate([
        { $match: { vendor_id: vendor._id, status: 'held' } },
        { $group: { _id: null, totalHeld: { $sum: '$amount' } } }
      ]),
      Follow.countDocuments({ vendor_id: vendor._id }),
    ]);
    const escrowBalance = escrowStats.length > 0 ? escrowStats[0].totalHeld : 0;
    const platformSettings = await PlatformSettings.getSettings();
    const storeCommissionRate = vendor.store?.commission_rate;
    const effectiveCommissionRate = storeCommissionRate !== undefined && storeCommissionRate !== null
      ? Number(storeCommissionRate)
      : Number(platformSettings.commission_value ?? platformSettings.commission_rate ?? 0);

    // Sync stored counter if it has drifted from the actual Follow collection
    if (vendor.follower_count !== realFollowerCount) {
      vendor.follower_count = realFollowerCount;
      Vendor.findByIdAndUpdate(vendor._id, { follower_count: realFollowerCount }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      data: {
        vendor,
        escrow_balance: escrowBalance,
        effective_commission_rate: effectiveCommissionRate,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/vendors/store
// @desc    Update store visuals (logo, banner, categories)
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const updateStore = async (req, res, next) => {
  try {
    const vendor = req.vendor;

    const allowedUpdates = ['banner', 'logo', 'categories', 'delivery_time', 'minimum_order_amount'];
    const updateData = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'minimum_order_amount') {
          updateData[field] = normalizeNullableXafAmount(req.body[field]);
        } else if (field === 'delivery_time') {
          updateData[field] = normalizeNullableText(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    const store = await Store.findOneAndUpdate(
      { vendor_id: vendor._id },
      { $set: updateData, $setOnInsert: { vendor_id: vendor._id } },
      {
        returnDocument: 'after',
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    // 🚀 SYNC: Mirror branding assets to the core User model for Chat/Notifications consistency
    const User = require('../models/User.model');
    const brandingUpdates = {};
    if (updateData.logo) brandingUpdates['branding.logo'] = updateData.logo;
    if (updateData.banner) brandingUpdates['branding.banner'] = updateData.banner;
    
    if (Object.keys(brandingUpdates).length > 0) {
      await User.findByIdAndUpdate(req.user._id, { $set: brandingUpdates });
    }

    res.status(200).json({
      success: true,
      message: 'Store updated successfully.',
      data: { store },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/vendors/profile
// @desc    Update vendor profile (store_name, description)
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const updateVendorProfile = async (req, res, next) => {
    try {
    const { store_name, description, pickup_address } = req.body;
    const updates = {};
    if (store_name !== undefined) updates.store_name = store_name;
    if (description !== undefined) updates.description = description;
    if (pickup_address !== undefined) {
      updates.pickup_address = normalizePickupAddress(pickup_address, req.vendor.pickup_address);
    }

    const vendor = await Vendor.findByIdAndUpdate(
      req.vendor._id,
      updates,
      { returnDocument: 'after', runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Vendor profile updated successfully.',
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/vendors
// @desc    Get all public Vendor Stores (Discovery Feed base endpoint)
// @access  Public
// ─────────────────────────────────────────────
const getPublicStores = async (req, res, next) => {
  try {
    const { search } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    let query = { is_onboarded: true };

    if (search) {
      query.store_name = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const sort = req.query.sort || '-createdAt';

    const total = await Vendor.countDocuments(query);

    // We fetch base Vendors and populate their Stores
    // Used for store directories and discovery feeds
    const stores = await Vendor.find(query)
      .select('store_name rating verified description user_id follower_count createdAt')
      .populate('store', 'logo banner categories delivery_time minimum_order_amount') // only fetch visible assets
      .populate('user_id', 'branding avatar is_online last_seen') // fetch user-level branding for fallbacks
      .skip(startIndex)
      .limit(limit)
      .sort(sort)
      .lean(); 

    res.status(200).json({
      success: true,
      count: stores.length,
      pagination: { total, page, pages: Math.ceil(total / limit) },
      data: { stores },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/vendors/stores/:id
// @desc    Get a single Store's public profile by its Vendor ID
// @access  Public
// ─────────────────────────────────────────────
const getStore = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Store not found.',
      });
    }

    let vendorId = req.params.id;
    let store = await Store.findById(req.params.id)
      .populate({
        path: 'vendor_id',
        select: 'store_name description rating verified user_id follower_count',
        populate: { path: 'user_id', select: 'branding avatar is_online last_seen' }
      });

    if (!store) {
      store = await Store.findOne({ vendor_id: vendorId })
      .populate({
        path: 'vendor_id',
        select: 'store_name description rating verified user_id follower_count',
        populate: { path: 'user_id', select: 'branding avatar is_online last_seen' }
      });
    }

    if (!store) {
      const vendor = await Vendor.findOne({
        $or: [{ _id: req.params.id }, { user_id: req.params.id }],
      });

      if (!vendor) {
        return res.status(404).json({
          success: false,
          message: 'Store not found.',
        });
      }

      vendorId = vendor._id;
      store = await Store.findOneAndUpdate(
        { vendor_id: vendorId },
        { $setOnInsert: { vendor_id: vendorId, categories: [] } },
        { returnDocument: 'after', upsert: true, runValidators: true }
      ).populate({
        path: 'vendor_id',
        select: 'store_name description rating verified user_id follower_count',
        populate: { path: 'user_id', select: 'branding avatar is_online last_seen' }
      });
    }

    // Ensure follower_count on the populated vendor reflects the real Follow count
    if (store?.vendor_id?._id) {
      const realFollowerCount = await Follow.countDocuments({ vendor_id: store.vendor_id._id });
      if (store.vendor_id.follower_count !== realFollowerCount) {
        store.vendor_id.follower_count = realFollowerCount;
        Vendor.findByIdAndUpdate(store.vendor_id._id, { follower_count: realFollowerCount }).catch(() => {});
      }
    }

    res.status(200).json({
      success: true,
      data: { store },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/vendors/kyc
// @desc    Submit KYC documents for identity verification
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const submitKYC = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user._id });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found.' });
    }

    const { 
      document_type, 
      document_number, 
      document_front_url, 
      document_back_url, 
      selfie_url 
    } = req.body;

    // Check if KYC already submitted
    let kyc = await KYC.findOne({ user_id: req.user._id });

    if (kyc && kyc.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Your identity is already verified.' });
    }

    if (kyc) {
      // Update existing if pending or rejected
      kyc.document_type = document_type;
      kyc.document_number = document_number;
      kyc.document_front_url = document_front_url;
      kyc.document_back_url = document_back_url;
      kyc.selfie_url = selfie_url;
      kyc.status = 'pending'; // Reset to pending if it was rejected
      await kyc.save();
    } else {
      kyc = await KYC.create({
        user_id: req.user._id,
        vendor_id: vendor._id,
        document_type,
        document_number,
        document_front_url,
        document_back_url,
        selfie_url
      });
    }

    res.status(200).json({
      success: true,
      message: 'KYC documents submitted successfully. Admin review pending.',
      data: { kyc }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/vendors/:id/follow
// @desc    Follow a vendor
// @access  Private (Authenticated)
// ─────────────────────────────────────────────
const followVendor = async (req, res, next) => {
  try {
    const vendorId = req.params.id;
    const userId = req.user._id;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor node not found.' });

    // Check if already following
    const existing = await Follow.findOne({ user_id: userId, vendor_id: vendorId });
    if (existing) return res.status(400).json({ success: false, message: 'Already connected to this node.' });

    await Follow.create({ user_id: userId, vendor_id: vendorId });

    // Use $inc so concurrent follow requests don't overwrite each other
    const updated = await Vendor.findByIdAndUpdate(
      vendorId,
      { $inc: { follower_count: 1 } },
      { new: true, select: 'store_name follower_count' }
    );

    res.status(201).json({ success: true, message: `Now following ${updated.store_name}.`, follower_count: updated.follower_count });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   DELETE /api/vendors/:id/follow
// @desc    Unfollow a vendor
// @access  Private (Authenticated)
// ─────────────────────────────────────────────
const unfollowVendor = async (req, res, next) => {
  try {
    const vendorId = req.params.id;
    const userId = req.user._id;

    const follow = await Follow.findOneAndDelete({ user_id: userId, vendor_id: vendorId });
    if (!follow) return res.status(400).json({ success: false, message: 'Relation not found mapping.' });

    // Decrement atomically; the $max aggregate expression floors the result at 0
    const updated = await Vendor.findByIdAndUpdate(
      vendorId,
      [{ $set: { follower_count: { $max: [0, { $subtract: ['$follower_count', 1] }] } } }],
      { new: true, select: 'follower_count' }
    );

    res.status(200).json({ success: true, message: 'Unfollowed successfully.', follower_count: updated?.follower_count ?? 0 });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/vendors/:id/followers
// @desc    Get all followers for a specific vendor
// @access  Private (Role: vendor - only own followers, or admin)
// ─────────────────────────────────────────────
const getFollowers = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });

    // Ensure vendor only sees their own followers (unless admin)
    if (req.user.role !== 'admin' && vendor.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to node manifest.' });
    }

    const followers = await Follow.find({ vendor_id: vendor._id })
      .populate('user_id', 'name email avatar branding')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: followers.length, data: { followers } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/vendors/:id/follow-status
// @desc    Check if current user follows a vendor
// @access  Private (Authenticated)
// ─────────────────────────────────────────────
const checkFollowStatus = async (req, res, next) => {
  try {
    const follow = await Follow.findOne({ user_id: req.user._id, vendor_id: req.params.id });
    res.status(200).json({ success: true, is_following: !!follow });
  } catch (error) {
    next(error);
  }
};

const getFollowing = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const following = await Follow.find({ user_id: userId })
      .populate({
        path: 'vendor_id',
        select: 'store_name rating verified user_id average_response_time',
        populate: [
          { path: 'user_id', select: 'name avatar role branding is_online last_seen' }
        ]
      })
      .sort('-createdAt');

    res.status(200).json({ success: true, count: following.length, data: { following } });
  } catch (error) {
    next(error);
  }
};

const getVendorAnalytics = async (req, res, next) => {
  try {
    const vendorId = req.vendor._id;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Run all DB calls concurrently using aggregations for stats (no large doc fetches)
    // and small find() calls for display data only.
    const [productStats, orderStats, topProducts, recentOrders, escrowStats, followCount, vendorUser, salesOverTime] = await Promise.all([
      // Aggregate product counters — no need to pull 200 full product docs
      Product.aggregate([
        { $match: { vendor_id: vendorId, status: { $ne: 'archived' } } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalViews: { $sum: { $ifNull: ['$view_count', 0] } },
            inStockProducts: { $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] } },
            outOfStockProducts: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
            lowStockProducts: { $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', 5] }] }, 1, 0] } },
          }
        }
      ]),
      // Aggregate order counters — no need to pull 100 full order docs
      Order.aggregate([
        { $match: { vendor_id: vendorId } },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $cond: [
                  { $and: [{ $not: { $in: ['$order_status', ['cancelled', 'refunded']] } }, { $in: ['$payment_status', ['paid', 'completed']] }] },
                  '$total_amount', 0
                ]
              }
            },
            totalSales: { $sum: { $cond: [{ $in: ['$order_status', ['delivered', 'completed']] }, 1, 0] } },
            openOrders: { $sum: { $cond: [{ $not: { $in: ['$order_status', ['delivered', 'completed', 'cancelled', 'refunded']] } }, 1, 0] } },
            processingOrders: { $sum: { $cond: [{ $eq: ['$order_status', 'processing'] }, 1, 0] } },
          }
        }
      ]),
      // Top 5 products for display — not 200
      Product.find({ vendor_id: vendorId, status: { $ne: 'archived' } })
        .select('name price images stock view_count purchase_count status')
        .sort('-purchase_count')
        .limit(5)
        .lean(),
      // Last 20 orders for display — not 100
      Order.find({ vendor_id: vendorId })
        .select('order_status payment_status total_amount createdAt customer_id products')
        .populate('customer_id', 'name avatar')
        .populate('products.product_id', 'name price images')
        .sort('-createdAt')
        .limit(20)
        .lean(),
      Escrow.aggregate([
        { $match: { vendor_id: vendorId, status: 'held' } },
        { $group: { _id: null, totalHeld: { $sum: '$amount' } } }
      ]),
      Follow.countDocuments({ vendor_id: vendorId }),
      User.findById(req.vendor.user_id).select('wallet_balance').lean(),
      Order.aggregate([
        {
          $match: {
            vendor_id: vendorId,
            createdAt: { $gte: sixMonthsAgo },
            order_status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            revenue: { $sum: '$total_amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const ps = productStats[0] || {};
    const os = orderStats[0] || {};
    const totalViews = ps.totalViews || 0;
    const totalSales = os.totalSales || 0;
    const conversionRate = totalViews > 0 ? (totalSales / totalViews) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        stats: {
          total_revenue: os.totalRevenue || 0,
          total_sales: totalSales,
          total_products: ps.totalProducts || 0,
          open_orders: os.openOrders || 0,
          processing_orders: os.processingOrders || 0,
          in_stock_products: ps.inStockProducts || 0,
          out_of_stock_products: ps.outOfStockProducts || 0,
          low_stock_count: ps.lowStockProducts || 0,
          total_views: totalViews,
          pending_escrow: escrowStats[0]?.totalHeld || 0,
          wallet_balance: vendorUser?.wallet_balance || 0,
          follower_count: followCount,
          conversion_rate: parseFloat(conversionRate.toFixed(2))
        },
        top_products: topProducts,
        recent_orders: recentOrders,
        sales_history: salesOverTime
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  onboardVendor,
  getVendorProfile,
  updateStore,
  updateVendorProfile,
  getPublicStores,
  getStore,
  submitKYC,
  followVendor,
  unfollowVendor,
  getFollowers,
  getFollowing,
  checkFollowStatus,
  getVendorAnalytics
};
