/**
 * controllers/admin.controller.js
 * Aura Market — Supreme Administrative Commands
 *
 * Exclusively executes tasks reserved for native platform managers.
 * Includes layout mapping, user bans, and broad dispute settlements natively.
 */

const Homepage = require('../models/Homepage.model');
const Product = require('../models/Product.model');
const Vendor = require('../models/Vendor.model');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Escrow = require('../models/Escrow.model');
const Shipment = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const LogisticZone = require('../models/LogisticZone.model');
const KYC = require('../models/KYC.model');
const Report = require('../models/Report.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const Transaction = require('../models/Transaction.model');
const { sendNotification } = require('../utils/notifier');
const logisticsService = require('../services/logistics.service');

// ─────────────────────────────────────────────
// @route   GET /api/admin/homepage
// @desc    Retrieve the current homepage layout natively (Public route for App load)
// @access  Public
// ─────────────────────────────────────────────
const getHomepageLayout = async (req, res, next) => {
  try {
    let layout = await Homepage.findOne({ version: 'v1' }).populate({
      path: 'featured_products.product_id',
      select: 'name price images rating vendor_id',
      populate: { path: 'vendor_id', select: 'store_name' },
    });

    // If no layout was ever created, spin up a default blank canvas
    if (!layout) {
      layout = await Homepage.create({ version: 'v1', hero_banners: [], featured_products: [] });
    }

    res.status(200).json({ success: true, data: { layout } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/homepage/banners
// @desc    Add, remove, or modify active hero banners specifically
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const updateBanners = async (req, res, next) => {
  try {
    const { hero_banners } = req.body;

    const layout = await Homepage.findOneAndUpdate(
      { version: 'v1' },
      { hero_banners },
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, message: 'Hero Banners synchronized.', data: { layout } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/homepage/featured
// @desc    Admin explicitly hand-picks Products to map into the "Featured" slots
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const setFeaturedProducts = async (req, res, next) => {
  try {
    // Expected structure: [{ product_id: '...', display_order: 1 }, ...]
    const { featured_products } = req.body;

    // We can also flip the "featured" flag on the product level itself via mapping.
    // 1. Unset ALL previous globally
    await Product.updateMany({}, { featured: false });

    // 2. Map new explicitly
    const newFeaturedIds = featured_products.map((item) => item.product_id);
    await Product.updateMany({ _id: { $in: newFeaturedIds } }, { featured: true });

    // 3. Update the exact visual ordering in the Layout mapping Document
    const layout = await Homepage.findOneAndUpdate(
      { version: 'v1' },
      { featured_products },
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, message: 'Featured map synchronized.', data: { layout } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/vendors/:id/verify
// @desc    Admin toggles a Vendor's "verified" blue-check status globally
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const toggleVendorVerified = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found mapping.' });
    }

    vendor.verified = req.body.verified !== undefined ? req.body.verified : !vendor.verified;
    await vendor.save();

    res.status(200).json({
      success: true,
      message: `Vendor verification shifted to ${vendor.verified}.`,
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/analytics
// @desc    Get platform-wide statistics for the admin dashboard
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getPlatformAnalytics = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalVendors = await Vendor.countDocuments();
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const pendingProducts = await Product.countDocuments({ status: 'pending' });
    const totalOrders = await Order.countDocuments();
    
    // Revenue calculation
    const revenueStats = await Order.aggregate([
      { $match: { order_status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalRevenue: { $sum: '$total_amount' } } }
    ]);
    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;

    // Pending KYC count
    const pendingKYC = await KYC.countDocuments({ status: 'pending' });

    // Sum up funds in escrow
    const escrowStats = await Escrow.aggregate([
      { $match: { status: 'held' } },
      { $group: { _id: null, totalHeldFunds: { $sum: '$amount' } } }
    ]);

    const totalHeldFunds = escrowStats.length > 0 ? escrowStats[0].totalHeldFunds : 0;

    res.status(200).json({
      success: true,
      data: {
        stats: {
          users: totalUsers,
          vendors: totalVendors,
          pending_vendors: pendingKYC,
          products: totalProducts,
          active_products: activeProducts,
          pending_products: pendingProducts,
          orders: totalOrders,
          revenue: totalRevenue,
          escrow_vault: totalHeldFunds
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/kyc/pending
// @desc    Get all pending KYC submissions
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getPendingKYC = async (req, res, next) => {
  try {
    const submissions = await KYC.find({ status: 'pending' })
      .populate('user_id', 'name email')
      .populate('vendor_id', 'store_name');

    res.status(200).json({ success: true, count: submissions.length, data: { submissions } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/kyc/:id/review
// @desc    Approve or Reject a KYC submission
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const reviewKYC = async (req, res, next) => {
  try {
    const { status, feedback } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid review status.' });
    }

    const kyc = await KYC.findById(req.params.id);
    if (!kyc) return res.status(404).json({ success: false, message: 'KYC record not found.' });

    kyc.status = status;
    kyc.admin_feedback = feedback;
    kyc.reviewed_at = new Date();
    kyc.reviewed_by = req.user._id;
    await kyc.save();

    // If approved, update Vendor's 'verified' status and User's 'verification_status'
    if (status === 'approved') {
      await Vendor.findByIdAndUpdate(kyc.vendor_id, { verified: true });
      await User.findByIdAndUpdate(kyc.user_id, { verification_status: 'verified' });
    } else {
      await User.findByIdAndUpdate(kyc.user_id, { verification_status: 'rejected' });
    }

    // Notify the Vendor
    await sendNotification(req.app, kyc.user_id, {
      title: status === 'approved' ? 'Identity Verified' : 'KYC Rejected',
      message: status === 'approved' 
        ? 'Congratulations! Your identity has been verified and your blue check is active.'
        : `Your KYC submission was rejected. Reason: ${feedback}`,
      type: 'system_alert'
    });

    res.status(200).json({ success: true, message: `KYC submission ${status}.`, data: { kyc } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/reports
// @desc    Get all pending reports
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getPendingReports = async (req, res, next) => {
  try {
    const reports = await Report.find({ status: 'pending' })
      .populate('reporter_id', 'name email')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: reports.length, data: { reports } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/reports/:id/resolve
// @desc    Mark a report as reviewed or actioned
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const resolveReport = async (req, res, next) => {
  try {
    const { status, admin_notes } = req.body;
    
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status, admin_notes, resolved_by: req.user._id },
      { new: true }
    );

    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });

    res.status(200).json({ success: true, message: 'Report updated.', data: { report } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/settings
// @desc    Get global platform settings
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getSettings = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();
    res.status(200).json({ success: true, data: { settings } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/settings
// @desc    Update global platform settings
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const updateSettings = async (req, res, next) => {
  try {
    const { commission_rate, withdrawal_fee, min_withdrawal_amount } = req.body;
    
    const settings = await PlatformSettings.getSettings();
    
    if (commission_rate !== undefined) settings.commission_rate = commission_rate;
    if (withdrawal_fee !== undefined) settings.withdrawal_fee = withdrawal_fee;
    if (min_withdrawal_amount !== undefined) settings.min_withdrawal_amount = min_withdrawal_amount;
    
    await settings.save();

    res.status(200).json({ success: true, message: 'Settings updated successfully.', data: { settings } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/orders
// @desc    Admin: Get all platform orders with full customer, vendor, product details
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getAllOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 30 } = req.query;
    const query = {};
    if (status && status !== 'all') query.order_status = status;

    const orders = await Order.find(query)
      .populate('customer_id', 'name email phone avatar')
      .populate({
        path: 'vendor_id',
        select: 'store_name user_id',
        populate: { path: 'user_id', select: 'name email phone avatar' }
      })
      .populate('products.product_id', 'name price images')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      data: { orders },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/orders/:id
// @desc    Admin: full order control (status/payment/logistics)
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const updateOrderAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { order_status, payment_status, shipping_method, logistics_company_id } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order_status) order.order_status = order_status;
    if (payment_status) order.payment_status = payment_status;
    if (shipping_method) order.shipping_method = shipping_method;
    if (typeof logistics_company_id !== 'undefined') {
      order.logistics_company_id = logistics_company_id || null;
    }

    await order.save();

    // Keep shipment assignment in sync when admin updates logistics routing
    if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
      let shipment = await Shipment.findOne({ order_id: order._id });
      if (!shipment) {
        const quartier = order.shipping_address?.quartier;
        if (quartier) {
          const created = await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id);
          shipment = created?.[0];
        }
      } else {
        shipment.logistics_id = order.logistics_company_id;
        await shipment.save();
      }

      const logisticsFirm = await LogisticsCompany.findById(order.logistics_company_id);
      if (logisticsFirm) {
        await sendNotification(req.app, logisticsFirm.user_id, {
          title: 'Shipment Assignment Updated',
          message: `Admin updated routing for order #${order._id.toString().slice(-6).toUpperCase()}.`,
          type: 'system_alert',
          metadata: { order_id: order._id, shipment_id: shipment?._id || null }
        });
      }
    }

    res.status(200).json({ success: true, message: 'Order updated.', data: { order } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/vendors/pending
// @desc    Get all vendors with pending KYC/Verification
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getPendingVendors = async (req, res, next) => {
  try {
    const submissions = await KYC.find({ status: 'pending' })
      .populate('user_id', 'name email avatar')
      .populate('vendor_id', 'store_name description rating');

    res.status(200).json({ success: true, count: submissions.length, data: { submissions } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/products/pending
// @desc    Get all products awaiting approval
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getPendingProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ status: 'pending' })
      .populate('vendor_id', 'store_name')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: products.length, data: { products } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/logistics/firms/:id
// @desc    Update logistics firm (verify, update prices/regions)
// ─────────────────────────────────────────────
const updateLogisticsFirm = async (req, res, next) => {
  try {
    const { is_verified, quartier_prices, supported_pickup_regions } = req.body;
    const firm = await LogisticsCompany.findByIdAndUpdate(
      req.params.id,
      { is_verified, quartier_prices, supported_pickup_regions },
      { new: true }
    );
    res.status(200).json({ success: true, data: { firm } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/admin/logistics/zones
// @desc    Add a new geographic zone/quartier
// ─────────────────────────────────────────────
const addLogisticZone = async (req, res, next) => {
  try {
    const { name, parent_id, type } = req.body;
    const zone = await LogisticZone.create({ name, parent_id, type });
    res.status(201).json({ success: true, data: { zone } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/products/:id/review
// @desc    Approve or Reject a pending product
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const reviewProduct = async (req, res, next) => {
  try {
    const { status } = req.body; // 'active' or 'rejected' (archived)
    if (!['active', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status for review.' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    product.status = status === 'active' ? 'active' : 'archived';
    await product.save();

    res.status(200).json({ 
      success: true, 
      message: `Product ${status === 'active' ? 'approved' : 'rejected'} successfully.`, 
      data: { product } 
    });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { role, search, status } = req.query;
    const query = {};
    if (role) query.role = role;
    if (search) query.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
    if (status) query.verification_status = status;

    const users = await User.find(query).select('-password').sort('-createdAt');
    res.status(200).json({ success: true, count: users.length, data: { users } });
  } catch (error) {
    next(error);
  }
};

const getAllVendors = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status === 'verified') query.verified = true;
    if (status === 'unverified') query.verified = false;
    
    const vendors = await Vendor.find(query)
      .populate('user_id', 'name email avatar verification_status branding')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: vendors.length, data: { vendors } });
  } catch (error) {
    next(error);
  }
};

const getAllProducts = async (req, res, next) => {
  try {
    const { status, search, vendor } = req.query;
    const query = {};
    if (status) query.status = status;
    if (vendor) query.vendor_id = vendor;
    if (search) query.name = new RegExp(search, 'i');

    const products = await Product.find(query)
      .populate('vendor_id', 'store_name')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: products.length, data: { products } });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { verification_status: status }, { new: true });
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

const updateVendorStatus = async (req, res, next) => {
  try {
    const { verified } = req.body;
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { verified }, { new: true });
    res.status(200).json({ success: true, data: { vendor } });
  } catch (error) {
    next(error);
  }
};

const toggleLogisticsVerified = async (req, res, next) => {
  try {
    const { id } = req.params;
    const firm = await LogisticsCompany.findById(id);
    if (!firm) return res.status(404).json({ success: false, message: 'Logistics firm not found' });

    firm.is_verified = !firm.is_verified;
    await firm.save();

    res.status(200).json({ 
      success: true, 
      message: `Logistics firm ${firm.is_verified ? 'verified' : 'unverified'} successfully.`,
      data: { firm } 
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/logistics/shipments
// @desc    Admin: Monitor all active and historical shipments platform-wide
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getAdminShipments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = status && status !== 'all' ? { status } : {};

    const shipments = await Shipment.find(query)
      .populate('order_id', 'total_amount tracking_number createdAt')
      .populate('vendor_id', 'store_name')
      .populate('logistics_id', 'company_name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Shipment.countDocuments(query);

    res.status(200).json({ success: true, count: shipments.length, total, data: { shipments } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/logistics/firms
// @desc    Admin: Manage logistics partner registration and verification
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getAdminLogisticsFirms = async (req, res, next) => {
  try {
    const firms = await LogisticsCompany.find()
      .populate('user_id', 'name email avatar is_active')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: firms.length, data: { firms } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/analytics/advanced
// @desc    Admin: Get time-series data for growth monitoring
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getAdvancedAnalytics = async (req, res, next) => {
  try {
    // Last 30 days of sales
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesOverTime = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, order_status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          dailyRevenue: { $sum: "$total_amount" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    const topVendors = await Vendor.find().sort('-total_revenue').limit(5).select('store_name total_revenue rating');
    const topProducts = await Order.aggregate([
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product_id",
          salesCount: { $sum: "$products.quantity" },
          revenueGenerated: { $sum: { $multiply: ["$products.price", "$products.quantity"] } }
        }
      },
      { $sort: { salesCount: -1 } },
      { $limit: 10 }
    ]);

    // Hydrate top products
    const Product = require('../models/Product.model');
    const populatedProducts = await Product.populate(topProducts, { path: '_id', select: 'name images' });

    res.status(200).json({
      success: true,
      data: {
        sales_over_time: salesOverTime,
        top_vendors: topVendors,
        top_products: populatedProducts
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/users/:id
// @desc    Admin comprehensively updates a user (name, email, role, password, etc)
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const updateUserAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, verification_status, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (verification_status) user.verification_status = verification_status;
    
    // If password provided, it will be hashed by the User completely via pre('save') hook
    if (password) {
      user.password = password;
    }

    await user.save(); // triggers hooks securely

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          verification_status: user.verification_status,
          avatar: user.avatar
        }
      }
    });

  } catch (error) {
    next(error);
  }
};



module.exports = {
  getHomepageLayout,
  updateBanners,
  setFeaturedProducts,
  toggleVendorVerified,
  getPlatformAnalytics,
  getPendingKYC,
  reviewKYC,
  getPendingReports,
  resolveReport,
  getSettings,
  updateSettings,
  getAllOrders,
  updateOrderAdmin,
  getPendingVendors,
  getPendingProducts,
  reviewProduct,
  getAllUsers,
  getAllVendors,
  getAllProducts,
  updateUserStatus,
  updateUserAdmin,
  updateVendorStatus,
  getAdminShipments,
  getAdminLogisticsFirms,
  toggleLogisticsVerified,
  updateLogisticsFirm,
  addLogisticZone,
  getAdvancedAnalytics,
};
