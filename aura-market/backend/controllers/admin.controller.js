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
const EmailLog = require('../models/EmailLog.model');
const { sendNotification } = require('../utils/notifier');
const logisticsService = require('../services/logistics.service');

// ─────────────────────────────────────────────
// @route   GET /api/admin/notifications/email-logs
// @desc    Admin: get all email logs for audit and debugging
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const getEmailLogs = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { recipient_email: new RegExp(search, 'i') },
        { subject: new RegExp(search, 'i') }
      ];
    }

    const emailLogs = await EmailLog.find(query)
      .populate('recipient_user_id', 'name email role')
      .sort('-timestamp')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await EmailLog.countDocuments(query);

    res.status(200).json({
      success: true,
      count: emailLogs.length,
      total,
      data: { emailLogs }
    });
  } catch (error) {
    next(error);
  }
};

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

    if (!layout) {
      layout = await Homepage.create({ version: 'v1', hero_banners: [], featured_products: [] });
    }

    res.status(200).json({ success: true, data: { layout } });
  } catch (error) {
    next(error);
  }
};

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

const setFeaturedProducts = async (req, res, next) => {
  try {
    const { featured_products } = req.body;
    await Product.updateMany({}, { featured: false });
    const newFeaturedIds = featured_products.map((item) => item.product_id);
    await Product.updateMany({ _id: { $in: newFeaturedIds } }, { featured: true });
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

const toggleVendorVerified = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found mapping.' });
    vendor.verified = req.body.verified !== undefined ? req.body.verified : !vendor.verified;
    await vendor.save();
    res.status(200).json({ success: true, message: `Vendor verification shifted to ${vendor.verified}.`, data: { vendor } });
  } catch (error) {
    next(error);
  }
};

const getPlatformAnalytics = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalVendors = await Vendor.countDocuments();
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const pendingProducts = await Product.countDocuments({ status: 'pending' });
    const totalOrders = await Order.countDocuments();
    const revenueStats = await Order.aggregate([
      { $match: { order_status: { $ne: 'cancelled' } } },
      { $group: { _id: null, totalRevenue: { $sum: '$total_amount' } } }
    ]);
    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;
    const pendingKYC = await KYC.countDocuments({ status: 'pending' });
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

const getPendingKYC = async (req, res, next) => {
  try {
    const submissions = await KYC.find({ status: 'pending' }).populate('user_id', 'name email').populate('vendor_id', 'store_name');
    res.status(200).json({ success: true, count: submissions.length, data: { submissions } });
  } catch (error) {
    next(error);
  }
};

const reviewKYC = async (req, res, next) => {
  try {
    const { status, feedback } = req.body;
    const kyc = await KYC.findById(req.params.id);
    if (!kyc) return res.status(404).json({ success: false, message: 'KYC record not found.' });
    kyc.status = status;
    kyc.admin_feedback = feedback;
    kyc.reviewed_at = new Date();
    kyc.reviewed_by = req.user._id;
    await kyc.save();
    if (status === 'approved') {
      await Vendor.findByIdAndUpdate(kyc.vendor_id, { verified: true });
      await User.findByIdAndUpdate(kyc.user_id, { verification_status: 'verified' });
    } else {
      await User.findByIdAndUpdate(kyc.user_id, { verification_status: 'rejected' });
    }
    await sendNotification(req.app, kyc.user_id, {
      title: status === 'approved' ? 'Identity Verified' : 'KYC Rejected',
      message: status === 'approved' ? 'Congratulations! Identity verified.' : `KYC rejected: ${feedback}`,
      type: 'system_alert'
    });
    res.status(200).json({ success: true, message: `KYC submission ${status}.`, data: { kyc } });
  } catch (error) {
    next(error);
  }
};

const getPendingReports = async (req, res, next) => {
  try {
    const reports = await Report.find({ status: 'pending' }).populate('reporter_id', 'name email').sort('-createdAt');
    res.status(200).json({ success: true, count: reports.length, data: { reports } });
  } catch (error) {
    next(error);
  }
};

const resolveReport = async (req, res, next) => {
  try {
    const { status, admin_notes } = req.body;
    const report = await Report.findByIdAndUpdate(req.params.id, { status, admin_notes, resolved_by: req.user._id }, { new: true });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    res.status(200).json({ success: true, message: 'Report updated.', data: { report } });
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    const settings = await PlatformSettings.getSettings();
    res.status(200).json({ success: true, data: { settings } });
  } catch (error) {
    next(error);
  }
};

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

const getAllOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 30 } = req.query;
    const query = {};
    if (status && status !== 'all') query.order_status = status;
    const orders = await Order.find(query).populate('customer_id', 'name email phone avatar').populate('logistics_company_id', 'company_name contact_phone').populate({ path: 'vendor_id', select: 'store_name user_id', populate: { path: 'user_id', select: 'name email phone avatar' } }).populate('products.product_id', 'name price images').sort('-createdAt').skip((page - 1) * limit).limit(Number(limit));
    const total = await Order.countDocuments(query);
    res.status(200).json({ success: true, count: orders.length, total, data: { orders } });
  } catch (error) {
    next(error);
  }
};

const updateOrderAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { order_status, payment_status, shipping_method, logistics_company_id } = req.body;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order_status) order.order_status = order_status;
    if (payment_status) order.payment_status = payment_status;
    if (shipping_method) order.shipping_method = shipping_method;
    if (typeof logistics_company_id !== 'undefined') order.logistics_company_id = logistics_company_id || null;
    await order.save();
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

    // Notify Customer about overall status shift
    if (order_status) {
      await sendNotification(req.app, order.customer_id, {
        title: `Order Updated: ${order_status.toUpperCase()}`,
        message: `An administrator has shifted the status of your Order #${order._id.toString().slice(-6).toUpperCase()} to: ${order_status}.`,
        type: 'order_status',
        metadata: { order_id: order._id, link: '/orders' },
        sendEmail: true,
        emailLink: `${process.env.WEB_CLIENT_URL}/orders`
      });
    }

    res.status(200).json({ success: true, message: 'Order updated.', data: { order } });
  } catch (error) {
    next(error);
  }
};

const getPendingVendors = async (req, res, next) => {
  try {
    const submissions = await KYC.find({ status: 'pending' }).populate('user_id', 'name email avatar').populate('vendor_id', 'store_name description rating');
    res.status(200).json({ success: true, count: submissions.length, data: { submissions } });
  } catch (error) {
    next(error);
  }
};

const getPendingProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ status: 'pending' }).populate('vendor_id', 'store_name').sort('-createdAt');
    res.status(200).json({ success: true, count: products.length, data: { products } });
  } catch (error) {
    next(error);
  }
};

const reviewProduct = async (req, res, next) => {
  try {
    const { status } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    product.status = status === 'active' ? 'active' : 'archived';
    await product.save();
    res.status(200).json({ success: true, message: `Product outcome synced.`, data: { product } });
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
    const vendors = await Vendor.find(query).populate('user_id', 'name email avatar verification_status branding').sort('-createdAt');
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
    const products = await Product.find(query).populate('vendor_id', 'store_name').sort('-createdAt');
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
    res.status(200).json({ success: true, data: { firm } });
  } catch (error) {
    next(error);
  }
};

const fetchAdminShipments = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = status && status !== 'all' ? { status } : {};
    const shipments = await Shipment.find(query).populate('order_id', 'total_amount tracking_number createdAt').populate('vendor_id', 'store_name').populate('logistics_id', 'company_name').sort('-createdAt').skip((page - 1) * limit).limit(Number(limit));
    const total = await Shipment.countDocuments(query);
    res.status(200).json({ success: true, count: shipments.length, total, data: { shipments } });
  } catch (error) {
    next(error);
  }
};

const updateAdminShipment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, logistics_id, price, tracking_code, pickup_address, delivery_address, note, failure_reason, receiver_name, proof_image } = req.body;
    const shipment = await Shipment.findById(id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found.' });
    if (typeof logistics_id !== 'undefined') shipment.logistics_id = logistics_id || shipment.logistics_id;
    if (typeof price !== 'undefined') shipment.price = Number(price) || 0;
    if (status) shipment.status = status;
    await shipment.save();

    // Notify Customer about shipment update
    const order = await Order.findById(shipment.order_id);
    if (order) {
      await sendNotification(req.app, order.customer_id, {
        title: 'Shipment Coordination Update',
        message: `An administrator has updated the logistics mapping for your Order #${order._id.toString().slice(-6).toUpperCase()}. Status: ${status || shipment.status}`,
        type: 'order_status',
        metadata: { order_id: order._id, link: '/orders' },
        sendEmail: true,
        emailLink: `${process.env.WEB_CLIENT_URL}/orders`
      });
    }

    res.status(200).json({ success: true, data: { shipment } });
  } catch (error) {
    next(error);
  }
};

const getAdminLogisticsFirms = async (req, res, next) => {
  try {
    const firms = await LogisticsCompany.find().populate('user_id', 'name email avatar is_active').sort('-createdAt');
    res.status(200).json({ success: true, count: firms.length, data: { firms } });
  } catch (error) {
    next(error);
  }
};

const getLogisticsEarningsReport = async (req, res, next) => {
  try {
    const vendorTotals = await Order.aggregate([
      { $match: { payment_status: { $in: ['paid', 'pending'] }, order_status: { $ne: 'cancelled' } } },
      { $group: { _id: '$vendor_id', total_orders: { $sum: 1 }, gross_sales: { $sum: '$total_amount' } } },
      { $sort: { gross_sales: -1 } },
    ]);
    const logisticsTotals = await Shipment.aggregate([
      { $group: { _id: '$logistics_id', total_shipments: { $sum: 1 }, total_shipping_value: { $sum: '$price' } } },
      { $sort: { total_shipping_value: -1 } },
    ]);
    res.status(200).json({ success: true, data: { vendors: vendorTotals, logistics_partners: logisticsTotals } });
  } catch (error) {
    next(error);
  }
};

const updateLogisticsFirm = async (req, res, next) => {
  try {
    const { is_verified, quartier_prices, supported_pickup_regions, contact_email, company_name, contact_phone } = req.body;
    
    const firm = await LogisticsCompany.findById(req.params.id);
    if (!firm) return res.status(404).json({ success: false, message: 'Logistics firm not found.' });

    if (typeof is_verified !== 'undefined') firm.is_verified = is_verified;
    if (quartier_prices) firm.quartier_prices = quartier_prices;
    if (supported_pickup_regions) firm.supported_pickup_regions = supported_pickup_regions;
    if (company_name) firm.company_name = company_name;
    if (contact_phone) firm.contact_phone = contact_phone;

    // Sync email back to User account if changed here
    if (contact_email && contact_email !== firm.contact_email) {
      firm.contact_email = contact_email;
      const user = await User.findById(firm.user_id);
      if (user) {
        user.email = contact_email;
        await user.save({ validateBeforeSave: false });
      }
    }

    await firm.save();
    res.status(200).json({ success: true, data: { firm } });
  } catch (error) {
    next(error);
  }
};

const addLogisticZone = async (req, res, next) => {
  try {
    const { name, parent_id, type } = req.body;
    const zone = await LogisticZone.create({ name, parent_id, type });
    res.status(201).json({ success: true, data: { zone } });
  } catch (error) {
    next(error);
  }
};

const getAdvancedAnalytics = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const salesOverTime = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, order_status: { $ne: 'cancelled' } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, dailyRevenue: { $sum: "$total_amount" }, orderCount: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ]);
    res.status(200).json({ success: true, data: { sales_over_time: salesOverTime } });
  } catch (error) {
    next(error);
  }
};

const updateUserAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, verification_status, password } = req.body;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Track old email to check if it changed
    let emailChanged = false;
    if (email && email !== user.email) {
      emailChanged = true;
      user.email = email;
    }

    if (name) user.name = name;
    if (role) user.role = role;
    if (verification_status) user.verification_status = verification_status;
    if (password) user.password = password; // Hashing middleware attached to `User.save()`

    await user.save();

    // Cascading updates: sync associated business profiles so notifications always match the master User email
    if (emailChanged) {
      // Use the user's role from the DB (already saved above) — don't rely on req.body.role being present
      if (user.role === 'logistics') {
        const logisticsComp = await LogisticsCompany.findOne({ user_id: user._id });
        if (logisticsComp) {
          logisticsComp.contact_email = email;
          await logisticsComp.save();
          console.log(`✅ Synced LogisticsCompany contact_email → ${email} for user ${user._id}`);
        }
      }
    }

    res.status(200).json({ success: true, data: { user } });
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
  fetchAdminShipments,
  updateAdminShipment,
  getAdminLogisticsFirms,
  getLogisticsEarningsReport,
  toggleLogisticsVerified,
  updateLogisticsFirm,
  addLogisticZone,
  getAdvancedAnalytics,
  getEmailLogs,
};
