/**
 * controllers/admin.controller.js
 * Auradime — Supreme Administrative Commands
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
const { syncShipmentsToOrderStatus, notifyOrderStatusChange } = require('../services/orderSync.service');
const templates = require('../utils/emailTemplates');
const { escapeRegExp } = require('../middleware/security.middleware');
const cache = require('../utils/cache');
const { normalizeFeeType, toNonNegativeNumber } = require('../utils/platformFees');

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
      const safeSearch = escapeRegExp(search);
      query.$or = [
        { recipient_email: new RegExp(safeSearch, 'i') },
        { subject: new RegExp(safeSearch, 'i') }
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
      { returnDocument: 'after', upsert: true }
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
      { returnDocument: 'after', upsert: true }
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
    const escrowAgg = await Escrow.aggregate([
      { $group: { _id: '$status', total: { $sum: '$amount' } } }
    ]);
    const totalHeldFunds = escrowAgg.find(s => s._id === 'held')?.total || 0;
    const totalReleasedFunds = escrowAgg.find(s => s._id === 'released')?.total || 0;
    const totalDisputedFunds = escrowAgg.find(s => s._id === 'disputed')?.total || 0;

    // Presence Metrics
    const onlineUsers = await User.countDocuments({ is_online: true });
    const active24h = await User.countDocuments({ 
      last_seen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
    });

    res.status(200).json({
      success: true,
      data: {
        stats: {
          users: totalUsers,
          online_users: onlineUsers,
          active_users_24h: active24h,
          vendors: totalVendors,
          pending_vendors: pendingKYC,
          products: totalProducts,
          active_products: activeProducts,
          pending_products: pendingProducts,
          orders: totalOrders,
          revenue: totalRevenue,
          escrow_vault: totalHeldFunds,
          escrow_held: totalHeldFunds,
          escrow_released: totalReleasedFunds,
          escrow_disputed: totalDisputedFunds,
          failed_transactions: await Transaction.countDocuments({ status: 'failed' }),
          delivered_orders: await Order.countDocuments({ order_status: 'delivered' }),
          active_orders: await Order.countDocuments({ order_status: { $in: ['placed', 'processing', 'shipped'] } })
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPendingKYC = async (req, res, next) => {
  try {
    const submissions = await KYC.find({ status: 'pending' })
      .populate('user_id', 'name email avatar role verification_status')
      .populate('vendor_id', 'store_name')
      .sort('-createdAt');
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
    const report = await Report.findByIdAndUpdate(req.params.id, { status, admin_notes, resolved_by: req.user._id }, { returnDocument: 'after' });
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
    const {
      commission_rate,
      commission_type,
      commission_value,
      escrow_fee_type,
      escrow_fee_value,
      withdrawal_fee,
      min_withdrawal_amount
    } = req.body;
    const settings = await PlatformSettings.getSettings();

    if (commission_type !== undefined) settings.commission_type = normalizeFeeType(commission_type);
    if (commission_value !== undefined) {
      settings.commission_value = toNonNegativeNumber(commission_value);
      settings.commission_rate = settings.commission_type === 'percentage' ? settings.commission_value : 0;
    }
    if (commission_rate !== undefined) {
      settings.commission_rate = toNonNegativeNumber(commission_rate);
      if (commission_value === undefined) {
        settings.commission_type = 'percentage';
        settings.commission_value = settings.commission_rate;
      }
    }
    if (escrow_fee_type !== undefined) settings.escrow_fee_type = normalizeFeeType(escrow_fee_type);
    if (escrow_fee_value !== undefined) settings.escrow_fee_value = toNonNegativeNumber(escrow_fee_value);
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
    const query = { 
      $or: [
        { payment_status: 'paid' },
        { payment_method: 'pay_on_delivery' }
      ]
    }; 
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

    if (order_status) {
      await syncShipmentsToOrderStatus(order, order_status, {
        updatedBy: req.user._id,
        note: `Admin updated order status to ${order_status}.`,
      });
      notifyOrderStatusChange(req.app, order, order_status, {
        message: `An admin updated Order #${order._id.toString().slice(-6).toUpperCase()} to ${order_status.replace(/_/g, ' ')}.`,
      });
    }

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
      const customer = await User.findById(order.customer_id);
      const emailTemplate = templates.shipmentStatusChanged({
        shipment: { tracking_code: order._id.toString().slice(-6).toUpperCase() },
        order,
        recipient: customer,
        status: order_status
      });
      await sendNotification(req.app, order.customer_id, {
        title: `Order Updated: ${order_status.toUpperCase()}`,
        message: `An administrator has shifted the status of your Order #${order._id.toString().slice(-6).toUpperCase()} to: ${order_status}.`,
        type: 'order_status',
        metadata: { order_id: order._id, link: '/orders' },
        sendEmail: true,
        emailLink: `${process.env.WEB_CLIENT_URL}/orders`,
        emailTemplate
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
    const allowedStatuses = ['active', 'pending', 'archived', 'suspended', 'draft'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid product status.' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    product.status = status;
    await product.save();
    cache.clear();
    const populated = await Product.findById(product._id).populate('vendor_id', 'store_name');
    res.status(200).json({ success: true, message: `Product status updated to ${status}.`, data: { product: populated } });
  } catch (error) {
    next(error);
  }
};

const updateProductAdmin = async (req, res, next) => {
  try {
    const allowedUpdates = [
      'name',
      'description',
      'price',
      'stock',
      'category',
      'status',
      'featured',
      'specifications',
      'long_description',
    ];
    const updateData = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (updateData.status) {
      const allowedStatuses = ['active', 'pending', 'archived', 'suspended', 'draft'];
      if (!allowedStatuses.includes(updateData.status)) {
        return res.status(400).json({ success: false, message: 'Invalid product status.' });
      }
    }
    if (updateData.price !== undefined) updateData.price = Number(updateData.price);
    if (updateData.stock !== undefined) updateData.stock = Number(updateData.stock);
    if (updateData.featured !== undefined) updateData.featured = Boolean(updateData.featured);

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    ).populate('vendor_id', 'store_name');

    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    cache.clear();
    res.status(200).json({ success: true, message: 'Product updated.', data: { product } });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { role, search, status } = req.query;
    const query = {};
    if (role) query.role = role;
    if (search) {
      const safeSearch = escapeRegExp(search);
      query.$or = [{ name: new RegExp(safeSearch, 'i') }, { email: new RegExp(safeSearch, 'i') }];
    }
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
    if (search) query.name = new RegExp(escapeRegExp(search), 'i');
    const products = await Product.find(query).populate('vendor_id', 'store_name').sort('-createdAt');
    res.status(200).json({ success: true, count: products.length, data: { products } });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { verification_status: status }, { returnDocument: 'after' });
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

const updateVendorStatus = async (req, res, next) => {
  try {
    const { verified } = req.body;
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, { verified }, { returnDocument: 'after' });
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
      const customer = await User.findById(order.customer_id);
      const emailTemplate = templates.shipmentStatusChanged({
        shipment,
        order,
        recipient: customer,
        status: status || shipment.status
      });
      await sendNotification(req.app, order.customer_id, {
        title: 'Shipment Coordination Update',
        message: `An administrator has updated the logistics mapping for your Order #${order._id.toString().slice(-6).toUpperCase()}. Status: ${status || shipment.status}`,
        type: 'order_status',
        metadata: { order_id: order._id, link: '/orders' },
        sendEmail: true,
        emailLink: `${process.env.WEB_CLIENT_URL}/orders`,
        emailTemplate
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
      {
        $lookup: {
          from: 'vendors',
          localField: '_id',
          foreignField: '_id',
          as: 'vendor_info'
        }
      },
      { $unwind: { path: '$vendor_info', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, total_orders: 1, gross_sales: 1, store_name: '$vendor_info.store_name' } },
      { $sort: { gross_sales: -1 } },
    ]);

    const logisticsTotals = await Shipment.aggregate([
      { $group: { _id: '$logistics_id', total_shipments: { $sum: 1 }, total_shipping_value: { $sum: '$price' } } },
      {
        $lookup: {
          from: 'logisticscompanies',
          localField: '_id',
          foreignField: '_id',
          as: 'firm_info'
        }
      },
      { $unwind: { path: '$firm_info', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, total_shipments: 1, total_shipping_value: 1, company_name: '$firm_info.company_name' } },
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

    // 1. Sales Over Time (Existing)
    const salesOverTime = await Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, order_status: { $ne: 'cancelled' } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, dailyRevenue: { $sum: "$total_amount" }, orderCount: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ]);

    // 2. Top Vendors by Revenue
    const topVendors = await Order.aggregate([
      { $match: { order_status: { $ne: 'cancelled' } } },
      { $group: { _id: '$vendor_id', revenue: { $sum: '$total_amount' }, orders: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'vendors',
          localField: '_id',
          foreignField: '_id',
          as: 'vendor'
        }
      },
      { $unwind: '$vendor' },
      { $project: { _id: 1, revenue: 1, orders: 1, store_name: '$vendor.store_name' } }
    ]);

    // 3. Top Products
    const topProducts = await Product.find({ status: 'active' })
      .sort({ purchase_count: -1, view_count: -1 })
      .limit(10)
      .select('name price purchase_count view_count stock category images');

    // 4. Role-Based User Breakdown
    const roleBreakdown = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // 5. Product Category Distribution
    const categoryStats = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, totalValue: { $sum: '$price' } } }
    ]);

    // 6. Order Status Matrix
    const orderMatrix = await Order.aggregate([
      { $group: { _id: '$order_status', count: { $sum: 1 }, total_volume: { $sum: '$total_amount' } } }
    ]);

    // 7. Global Financial Integrity (Total platform flow)
    const totalRevenue = await Order.aggregate([
      { $match: { payment_status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } }
    ]);

    const totalEscrow = await Order.aggregate([
      { $match: { payment_status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } }
    ]);

    // 8. Platform Summary Additions
    const liveShipments = await Shipment.countDocuments({ status: { $in: ['pending', 'picked_up', 'in_transit'] } });
    const stockAlerts = await Product.countDocuments({ stock: { $lte: 5 }, status: 'active' });

    res.status(200).json({ 
      success: true, 
      data: { 
        sales_over_time: salesOverTime,
        top_vendors: topVendors,
        top_products: topProducts,
        role_breakdown: roleBreakdown,
        category_stats: categoryStats,
        order_matrix: orderMatrix,
        payout_intel: {
          total_revenue: totalRevenue[0]?.total || 0,
          total_escrow: totalEscrow[0]?.total || 0
        },
        platform_summary: {
          total_users: await User.countDocuments(),
          total_vendors: await Vendor.countDocuments(),
          live_shipments: liveShipments,
          stock_alerts: stockAlerts
        }
      } 
    });
  } catch (error) {
    next(error);
  }
};

const updateUserAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, verification_status, phone } = req.body;
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
    const previousVerificationStatus = user.verification_status;
    if (verification_status) user.verification_status = verification_status;
    if (typeof phone !== 'undefined') user.phone = phone;

    await user.save();

    if (verification_status === 'held' && previousVerificationStatus !== 'held') {
      await sendNotification(req.app, user._id, {
        title: 'Verification Required',
        message: 'An administrator has requested account verification. You can view your account, but actions are paused until verification is approved.',
        type: 'security',
        metadata: { link: '/profile?tab=kyc' },
      }).catch(() => {});
    }

    // Cascading business profile synchronization
    if (user.role === 'logistics') {
      const existingFirm = await LogisticsCompany.findOne({ user_id: user._id });
      if (!existingFirm) {
        await LogisticsCompany.create({
          user_id: user._id,
          company_name: user.name || 'New Logistics Partner',
          contact_email: user.email,
          contact_phone: '000000000', // Placeholder
          service_regions: [],
          vehicle_types: ['motorcycle']
        });
        console.log(`📡 Auto-provisioned LogisticsCompany profile for user ${user._id}`);
      } else if (emailChanged) {
        existingFirm.contact_email = email;
        await existingFirm.save();
        console.log(`✅ Synced LogisticsCompany contact_email → ${email} for user ${user._id}`);
      }
    }

    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Cascading deletion for business entities
    if (user.role === 'vendor') {
      const vendor = await Vendor.findOne({ user_id: user._id });
      if (vendor) {
        await Product.deleteMany({ vendor_id: vendor._id });
        await require('../models/Store.model').findOneAndDelete({ vendor_id: vendor._id });
        await Vendor.findByIdAndDelete(vendor._id);
      }
    } else if (user.role === 'logistics') {
      await LogisticsCompany.findOneAndDelete({ user_id: user._id });
    }

    req.app.get('io')?.to(user._id.toString()).emit('account_deleted', { reason: 'admin_deleted' });

    // Finally delete the user
    await User.findByIdAndDelete(id);

    res.status(200).json({ success: true, message: 'Account and associated metadata purged.' });
  } catch (error) {
    next(error);
  }
};

const bulkDeleteUsers = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No IDs provided for bulk deletion.' });
    }

    // Safety: prevent self-deletion
    const filteredIds = ids.filter(id => id.toString() !== req.user._id.toString());
    if (filteredIds.length === 0) {
      return res.status(403).json({ success: false, message: 'You cannot delete yourself via bulk operation.' });
    }

    const usersToDelete = await User.find({ _id: { $in: filteredIds } });

    for (const user of usersToDelete) {
      // Cascading deletion for business entities (reusing logic from single delete)
      if (user.role === 'vendor') {
        const vendor = await Vendor.findOne({ user_id: user._id });
        if (vendor) {
          await Product.deleteMany({ vendor_id: vendor._id });
          try {
            await require('../models/Store.model').findOneAndDelete({ vendor_id: vendor._id });
          } catch (e) { /* ignore if no store */ }
          await Vendor.findByIdAndDelete(vendor._id);
        }
      } else if (user.role === 'logistics') {
        await LogisticsCompany.findOneAndDelete({ user_id: user._id });
      }
    }

    const io = req.app.get('io');
    if (io) {
      filteredIds.forEach((userId) => {
        io.to(userId.toString()).emit('account_deleted', { reason: 'admin_deleted' });
      });
    }

    await User.deleteMany({ _id: { $in: filteredIds } });

    res.status(200).json({ 
      success: true, 
      message: `${filteredIds.length} users and associated metadata purged.`,
      deletedCount: filteredIds.length
    });
  } catch (error) {
    next(error);
  }
};

const bulkDeleteProducts = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No IDs provided for bulk deletion.' });
    }

    const result = await Product.deleteMany({ _id: { $in: ids } });

    res.status(200).json({ 
      success: true, 
      message: `${result.deletedCount} products purged from the global asset pool.`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
};

const getAllTransactions = async (req, res, next) => {
  try {
    const { status, type, gateway, search, page = 1, limit = 50 } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (type && type !== 'all') query.type = type;
    if (gateway && gateway !== 'all') query.gateway = gateway;
    
    if (search) {
      const safeSearch = escapeRegExp(search);
      query.$or = [
        { reference: new RegExp(safeSearch, 'i') },
        { gateway_transaction_id: new RegExp(safeSearch, 'i') },
        { description: new RegExp(safeSearch, 'i') }
      ];
    }

    const transactions = await Transaction.find(query)
      .populate('user_id', 'name email avatar role phone')
      .populate({
        path: 'order_id',
        select: 'vendor_id',
        populate: {
          path: 'vendor_id',
          select: 'store_name branding'
        }
      })
      .populate({
        path: 'order_ids',
        select: 'vendor_id',
        populate: {
          path: 'vendor_id',
          select: 'store_name branding'
        }
      })
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      data: { transactions }
    });
  } catch (error) {
    next(error);
  }
};

const fulfillOrderFromTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const transaction = await Transaction.findById(transactionId);
    
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    if (transaction.status !== 'completed') return res.status(400).json({ success: false, message: 'Only completed transactions can trigger order fulfillment.' });
    if (!transaction.order_ids || transaction.order_ids.length === 0) return res.status(400).json({ success: false, message: 'No orders linked to this transaction.' });

    const { settleOrdersInSession } = require('./payment.controller');
    await settleOrdersInSession(transaction.user_id, transaction.order_ids, req.app, null, true, '', 'manual');

    res.status(200).json({ 
      success: true, 
      message: 'Orders synchronized and fulfilled successfully.' 
    });
  } catch (error) {
    next(error);
  }
};

const syncWithEversend = async (req, res, next) => {
  try {
    const eversend = require('../services/eversend.service');
    
    // Fetch latest 20 transactions from Eversend using the service (handles auth & refresh)
    const result = await eversend.getTransactions({ limit: 20 });
    const remoteTxs = result?.data?.transactions || [];
    
    let importedCount = 0;
    for (const rt of remoteTxs) {
      // Only sync transactions that were initiated by our platform (identified by AURA or TEST prefix)
      const isPlatformTx = rt.transactionRef && (rt.transactionRef.startsWith('AURA') || rt.transactionRef.startsWith('TEST'));
      if (!isPlatformTx) continue;

      const exists = await Transaction.findOne({ 
        $or: [
          { gateway_transaction_id: rt.transactionId },
          { reference: rt.transactionRef }
        ]
      });
      
      if (!exists && rt.transactionId) {
        // Create an "Imported" transaction record
        await Transaction.create({
          user_id: req.user?._id, // Assign to current admin as importer
          type: rt.type === 'collection' ? 'deposit' : 'withdrawal',
          amount: parseFloat(rt.amount),
          currency: rt.currency,
          reference: rt.transactionRef || `IMP-${rt.transactionId}`,
          gateway_transaction_id: rt.transactionId,
          status: rt.status === 'successful' ? 'completed' : rt.status === 'failed' ? 'failed' : 'pending',
          gateway: 'eversend',
          description: `Imported via Gateway Sync: ${rt.type} (${rt.status})`,
          gateway_response: rt
        });
        importedCount++;
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `Gateway reconciliation complete. ${importedCount} new records discovered and imported.`,
      importedCount
    });
  } catch (error) {
    const errData = error.response?.data;
    const errStatus = error.response?.status;
    const errMessage = errData?.message || error.message;
    
    console.error('Sync With Eversend Error:', errStatus, errData || error.message);

    // Distinguish IP whitelist rejection from credential errors
    if (errStatus === 401 && errMessage?.toLowerCase().includes('invalid request origin')) {
      return res.status(503).json({
        success: false,
        message: 'Eversend API access denied: this server\'s IP address is not whitelisted in your Eversend developer settings. Please log into the Eversend dashboard, go to Settings → API Keys, and add this server\'s public IP to the allowed origins.',
        code: 'EVERSEND_IP_NOT_WHITELISTED',
      });
    }

    if (errStatus === 401) {
      return res.status(503).json({
        success: false,
        message: 'Eversend authentication failed. Please verify your EVERSEND_CLIENT_ID and EVERSEND_CLIENT_SECRET environment variables.',
        code: 'EVERSEND_AUTH_FAILED',
      });
    }

    next(error);
  }
};

const updateTransactionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    
    const transaction = await Transaction.findById(id);
    if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    // If marking as completed and it wasn't already completed
    if (status === 'completed' && transaction.status !== 'completed') {
      const user = await User.findById(transaction.user_id);
      if (!user) return res.status(404).json({ success: false, message: 'User mapping failed: recipient account not found.' });

      // Handle cascading effects based on transaction type
      if (transaction.type === 'deposit') {
        // A deposit is either a pure top-up OR a checkout funding source
        const isCheckout = transaction.order_ids && transaction.order_ids.length > 0;
        
        if (isCheckout) {
          // Checkout funding — settle the associated orders
          const { settleOrders } = require('../services/payment/settle.service');
          const mongoose = require('mongoose');
          const session = await mongoose.startSession();
          session.startTransaction();
          try {
            await settleOrders(user._id, transaction.order_ids, session, req.app, true, '', transaction.gateway || 'admin_manual');
            
            transaction.status = 'completed';
            if (admin_note) {
              transaction.metadata = { ...transaction.metadata, admin_confirm_note: admin_note, manually_confirmed_by: req.user._id };
            }
            await transaction.save({ session });
            await session.commitTransaction();
          } catch (e) {
            await session.abortTransaction();
            console.error('[updateTransactionStatus] Settlement Error:', e.message);
            return res.status(500).json({ success: false, message: `Status update failed during order settlement: ${e.message}` });
          } finally {
            session.endSession();
          }
        } else {
          // Pure wallet top-up
          user.wallet_balance += transaction.amount;
          await user.save();
          
          transaction.status = 'completed';
          if (admin_note) {
            transaction.metadata = { ...transaction.metadata, admin_confirm_note: admin_note, manually_confirmed_by: req.user._id };
          }
          await transaction.save();

          // Notify User
          await sendNotification(req.app, user._id, {
            title: '💰 Wallet Credited (Manual)',
            message: `An administrator has manually confirmed your deposit of ${transaction.amount.toLocaleString()} ${transaction.currency || 'XAF'}.`,
            type: 'wallet_update',
            sendEmail: true
          });
        }
      } else if (transaction.type === 'withdrawal') {
        // Withdrawal: status update only (funds were already deducted on request creation)
        transaction.status = 'completed';
        if (admin_note) {
          transaction.metadata = { ...transaction.metadata, admin_confirm_note: admin_note, manually_processed_by: req.user._id };
        }
        await transaction.save();
      } else {
        // Other types (refund, payment, payout)
        transaction.status = status;
        await transaction.save();
      }
    } else {
      // Just update status normally (e.g. marking as failed or pending)
      transaction.status = status;
      if (admin_note) {
        transaction.metadata = { ...transaction.metadata, admin_note, updated_by: req.user._id };
      }
      await transaction.save();
    }

    res.status(200).json({ success: true, message: `Transaction ${transaction.reference} shifted to ${status}.`, data: { transaction } });
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
  updateProductAdmin,
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
  deleteUser,
  bulkDeleteUsers,
  bulkDeleteProducts,
  getAllTransactions,
  updateTransactionStatus,
  fulfillOrderFromTransaction,
  syncWithEversend,
};
