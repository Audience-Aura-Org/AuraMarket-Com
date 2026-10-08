/**
 * controllers/admin.controller.js
 * Auradime — Supreme Administrative Commands
 * Exclusively executes tasks reserved for native platform managers.
 * Includes layout mapping, user bans, and broad dispute settlements natively.
 */

const Homepage = require('../models/Homepage.model');
const Product = require('../models/Product.model');
const Vendor = require('../models/Vendor.model');
const Store = require('../models/Store.model');
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
const { recordAudit } = require('../utils/auditTrail');
const logisticsService = require('../services/logistics.service');
const { syncShipmentsToOrderStatus, notifyOrderStatusChange } = require('../services/orderSync.service');
const templates = require('../utils/emailTemplates');
const { escapeRegExp } = require('../middleware/security.middleware');
const Dispute = require('../models/Dispute.model');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const ManagerAssignment = require('../models/ManagerAssignment.model');
const { scoped, assertInScope, assertAccessLevel } = require('../utils/scopeFilter');
const cache = require('../utils/cache');
const { normalizeFeeType, toNonNegativeNumber } = require('../utils/platformFees');
const { creditBalance, debitBalance, adjustBalance, generateRef } = require('../services/wallet.service');
const eversend = require('../services/eversend.service');
const pawapay = require('../services/payment/gateways/pawapay.gateway');
const crypto = require('crypto');
const { calculatePlatformFees, applyCommissionOverride } = require('../utils/platformFees');
const mongoose = require('mongoose');
const { clearApiCache } = require('../middleware/cache.middleware');

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

    const scopedQuery = scoped('EmailLog', query, req.managerScope);
    const emailLogs = await EmailLog.find(scopedQuery)
      .populate('recipient_user_id', 'name email role')
      .sort('-timestamp')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await EmailLog.countDocuments(scopedQuery);

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
      select: 'name price compare_at_price images rating vendor_id',
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

const asMoney = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

// Financial reporting must only include money that has actually settled. A
// placed order can still be awaiting mobile-money approval, and a cancelled or
// refunded order must never inflate an admin revenue card.
const SETTLED_ORDER_MATCH = { payment_status: 'paid' };

const getFeeBreakdown = (tx = {}) => {
  const metadata = tx.metadata || {};
  const breakdown = metadata.platform_fee_breakdown || metadata.fee_breakdown || {};
  return {
    commission: asMoney(breakdown.commission_fee ?? breakdown.commission ?? metadata.commission_fee),
    escrow: asMoney(breakdown.escrow_fee ?? breakdown.escrow ?? metadata.escrow_fee),
    collection: asMoney(metadata.collection_fee ?? metadata.collectionFee),
    subscription: asMoney(metadata.subscription_fee ?? metadata.subscriptionFee),
  };
};

const buildAdminEarningsSummary = async () => {
  // Three parallel queries for comprehensive earnings:
  // 1. All payout transactions with fee breakdowns (commission + escrow from ALL order types)
  // 2. Payment transactions with collection fees (mobile money charges)
  // 3. Subscription payment totals
  const [payoutTxns, collectionTxns, subAgg] = await Promise.all([
    Transaction.find({
      type: 'payout',
      status: { $in: ['completed', 'pending'] },
      'metadata.platform_fee_breakdown': { $exists: true },
    })
      .select('metadata')
      .lean(),

    Transaction.find({
      status: 'completed',
      $or: [
        { 'metadata.collection_fee': { $exists: true } },
        { 'metadata.collectionFee': { $exists: true } },
      ],
    })
      .select('metadata')
      .lean(),

    Transaction.aggregate([
      { $match: { type: 'subscription', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const summary = {
    commission: 0,
    escrow: 0,
    collection: 0,
    subscription: 0,
    total: 0,
    currency: 'XAF',
    transaction_count: payoutTxns.length + collectionTxns.length,
    updated_at: new Date(),
  };

  // Extract commission and escrow fees from every payout transaction's breakdown
  payoutTxns.forEach((tx) => {
    const breakdown = tx.metadata?.platform_fee_breakdown || {};
    summary.commission += asMoney(breakdown.commission_fee);
    summary.escrow += asMoney(breakdown.escrow_fee);
  });

  // Extract collection fees from payment gateway transactions
  collectionTxns.forEach((tx) => {
    const meta = tx.metadata || {};
    summary.collection += asMoney(meta.collection_fee ?? meta.collectionFee);
  });

  // Subscription revenue from completed subscription payments
  summary.subscription = asMoney(subAgg[0]?.total);

  summary.total = summary.commission + summary.escrow + summary.collection + summary.subscription;
  return summary;
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
    assertAccessLevel(req.managerScope, vendor.user_id, 'standard');
    vendor.verified = req.body.verified !== undefined ? req.body.verified : !vendor.verified;
    await vendor.save();
    res.status(200).json({ success: true, message: `Vendor verification shifted to ${vendor.verified}.`, data: { vendor } });
  } catch (error) {
    next(error);
  }
};

const getPlatformAnalytics = async (req, res, next) => {
  try {
    const s = req.managerScope;
    const [
      totalUsers,
      totalVendors,
      totalProducts,
      activeProducts,
      pendingProducts,
      totalOrders,
      revenueStats,
      pendingKYC,
      escrowAgg,
      adminEarnings,
      onlineUsers,
      active24h,
      failedTransactions,
      deliveredOrders,
      activeOrders
    ] = await Promise.all([
      User.countDocuments(scoped('User', {}, s)),
      Vendor.countDocuments(scoped('Vendor', {}, s)),
      Product.countDocuments(scoped('Product', {}, s)),
      Product.countDocuments(scoped('Product', { status: 'active' }, s)),
      Product.countDocuments(scoped('Product', { status: 'pending' }, s)),
      Order.countDocuments(scoped('Order', {}, s)),
      Order.aggregate([
        { $match: scoped('Order', SETTLED_ORDER_MATCH, s) },
        { $group: { _id: null, totalRevenue: { $sum: '$total_amount' } } }
      ]),
      KYC.countDocuments(scoped('KYC', { status: 'pending' }, s)),
      Escrow.aggregate([
        { $match: scoped('Escrow', {}, s) },
        { $group: { _id: '$status', total: { $sum: '$amount' } } }
      ]),
      s ? Promise.resolve(null) : buildAdminEarningsSummary(),
      User.countDocuments(scoped('User', { is_online: true }, s)),
      User.countDocuments(scoped('User', {
        last_seen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }, s)),
      Transaction.countDocuments(scoped('Transaction', { status: 'failed' }, s)),
      Order.countDocuments(scoped('Order', { order_status: 'delivered' }, s)),
      Order.countDocuments(scoped('Order', { order_status: { $in: ['placed', 'processing', 'shipped'] } }, s))
    ]);

    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;
    const totalHeldFunds = escrowAgg.find(s => s._id === 'held')?.total || 0;
    const totalReleasedFunds = escrowAgg.find(s => s._id === 'released')?.total || 0;
    const totalDisputedFunds = escrowAgg.find(s => s._id === 'disputed')?.total || 0;

    // Platform Liquidity / Custody total is the sum of both locked 'held' funds and 'disputed' funds
    const activeEscrowCustody = totalHeldFunds + totalDisputedFunds;

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
          admin_earnings: adminEarnings,
          admin_revenue: adminEarnings.total,
          escrow_vault: activeEscrowCustody,
          escrow_held: totalHeldFunds,
          escrow_released: totalReleasedFunds,
          escrow_disputed: totalDisputedFunds,
          failed_transactions: failedTransactions,
          delivered_orders: deliveredOrders,
          active_orders: activeOrders
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getPendingKYC = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = scoped('KYC', status && status !== 'all' ? { status } : {}, req.managerScope);
    const submissions = await KYC.find(query)
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
    assertAccessLevel(req.managerScope, kyc.user_id, 'standard');
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
    const reports = await Report.find(scoped('Report', { status: 'pending' }, req.managerScope)).populate('reporter_id', 'name email').sort('-createdAt');
    res.status(200).json({ success: true, count: reports.length, data: { reports } });
  } catch (error) {
    next(error);
  }
};

const resolveReport = async (req, res, next) => {
  try {
    const { status, admin_notes } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found.' });
    assertAccessLevel(req.managerScope, report.reporter_id, 'standard');
    report.status = status;
    report.admin_notes = admin_notes;
    report.resolved_by = req.user._id;
    await report.save();
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
      min_withdrawal_amount,
      // Withdrawal maintenance mode
      withdrawals_maintenance_mode,
      // Restaurant-specific
      food_acceptance_timeout_minutes,
      new_restaurant_hold_order_count,
      restaurant_min_withdrawal_orders,
      restaurant_min_withdrawal_age_days,
      restaurant_cancel_rate_threshold,
      restaurant_cancel_rate_window_days,
      // P2P settings
      p2p_enabled,
      p2p_logistics_provider_ids,
      p2p_commission_percent,
      p2p_cancellation_fee,
      p2p_kyc_threshold,
      p2p_weight_multipliers,
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

    // Withdrawal maintenance mode
    if (withdrawals_maintenance_mode !== undefined) settings.withdrawals_maintenance_mode = !!withdrawals_maintenance_mode;

    // Restaurant-specific settings
    if (food_acceptance_timeout_minutes !== undefined) settings.food_acceptance_timeout_minutes = Number(food_acceptance_timeout_minutes);
    if (new_restaurant_hold_order_count !== undefined) settings.new_restaurant_hold_order_count = Number(new_restaurant_hold_order_count);
    if (restaurant_min_withdrawal_orders !== undefined) settings.restaurant_min_withdrawal_orders = Number(restaurant_min_withdrawal_orders);
    if (restaurant_min_withdrawal_age_days !== undefined) settings.restaurant_min_withdrawal_age_days = Number(restaurant_min_withdrawal_age_days);
    if (restaurant_cancel_rate_threshold !== undefined) settings.restaurant_cancel_rate_threshold = Number(restaurant_cancel_rate_threshold);
    if (restaurant_cancel_rate_window_days !== undefined) settings.restaurant_cancel_rate_window_days = Number(restaurant_cancel_rate_window_days);

    // P2P settings
    if (p2p_enabled !== undefined) settings.p2p_enabled = !!p2p_enabled;
    if (p2p_logistics_provider_ids !== undefined) {
      settings.p2p_logistics_provider_ids = Array.isArray(p2p_logistics_provider_ids)
        ? p2p_logistics_provider_ids
        : [];
    }
    if (p2p_commission_percent !== undefined) settings.p2p_commission_percent = Number(p2p_commission_percent);
    if (p2p_cancellation_fee !== undefined) settings.p2p_cancellation_fee = Number(p2p_cancellation_fee);
    if (p2p_kyc_threshold !== undefined) settings.p2p_kyc_threshold = Number(p2p_kyc_threshold);
    if (p2p_weight_multipliers !== undefined) {
      settings.p2p_weight_multipliers = {
        light: Number(p2p_weight_multipliers.light) || 1,
        medium: Number(p2p_weight_multipliers.medium) || 1.3,
        heavy: Number(p2p_weight_multipliers.heavy) || 1.8,
        extra_heavy: Number(p2p_weight_multipliers.extra_heavy) || 2.5,
      };
    }

    await settings.save();
    await clearApiCache();
    res.status(200).json({ success: true, message: 'Settings updated successfully.', data: { settings } });
  } catch (error) {
    next(error);
  }
};

const getAllOrders = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 30 } = req.query;
    const baseFilter = {
      $or: [
        { payment_status: { $in: ['paid', 'failed'] } },
        { payment_method: 'pay_on_delivery' }
      ]
    };
    const filter = { ...baseFilter };
    if (status && status !== 'all') {
      if (status === 'failed') filter.payment_status = 'failed';
      else filter.order_status = status;
    }
    const query = scoped('Order', filter, req.managerScope);
    const scopedBase = scoped('Order', baseFilter, req.managerScope);

    const [orders, total, statusCounts] = await Promise.all([
      Order.find(query)
        .populate('customer_id', 'name email phone avatar')
        .populate('logistics_company_id', 'company_name contact_phone')
        .populate({ path: 'vendor_id', select: 'store_name user_id', populate: { path: 'user_id', select: 'name email phone avatar' } })
        .populate('products.product_id', 'name price images')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Order.countDocuments(query),
      Order.aggregate([
        { $match: scopedBase },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $in: ['$order_status', ['placed', 'processing', 'shipped']] }, 1, 0] } },
            delivered: { $sum: { $cond: [{ $eq: ['$order_status', 'delivered'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$order_status', 'cancelled'] }, 1, 0] } },
            refund_pending: { $sum: { $cond: [{ $eq: ['$order_status', 'refund_pending'] }, 1, 0] } },
            refunded: { $sum: { $cond: [{ $eq: ['$order_status', 'refunded'] }, 1, 0] } },
            failed_payments: { $sum: { $cond: [{ $eq: ['$payment_status', 'failed'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const counts = statusCounts[0] || {};
    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      data: {
        orders,
        stats: {
          total: counts.total || 0,
          active: counts.active || 0,
          delivered: counts.delivered || 0,
          cancelled: counts.cancelled || 0,
          refund_pending: counts.refund_pending || 0,
          refunded: counts.refunded || 0,
          failed_payments: counts.failed_payments || 0,
          attention: (counts.refund_pending || 0) + (counts.failed_payments || 0),
        },
      },
    });
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
    assertAccessLevel(req.managerScope, order.customer_id, 'standard');
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

// ─────────────────────────────────────────────
// @route   POST /api/admin/orders/:id/impose-escrow
// @desc    Admin imposes escrow on a paid order — holds vendor funds
// @access  Private (Role: admin)
// ─────────────────────────────────────────────
const imposeEscrow = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) throw new Error('Order not found.');
    assertAccessLevel(req.managerScope, order.customer_id, 'full');
    if (order.payment_status !== 'paid') throw new Error('Order must be paid before escrow can be imposed.');

    // Check if escrow already exists
    const existing = await Escrow.findOne({ order_id: order._id }).session(session);
    if (existing) throw new Error(`Escrow already exists for this order (status: ${existing.status}).`);

    // Calculate vendor base amount and fees
    const vendorBaseAmount = (order.shipping_method === 'logistics_partner' && order.logistics_company_id)
      ? order.subtotal
      : order.subtotal + (order.shipping_fee || 0);

    const platformSettings = await PlatformSettings.getSettings(session);
    const store = await Store.findOne({ vendor_id: order.vendor_id }).select('commission_rate').session(session);
    const effectiveSettings = applyCommissionOverride(platformSettings, store?.commission_rate);
    const { commissionFee, escrowFee, platformFee, vendorPayout } = calculatePlatformFees(vendorBaseAmount, effectiveSettings, {
      includeEscrowFee: true,
    });

    // Claw back vendor payout if already credited
    const vendorRecord = await Vendor.findById(order.vendor_id).session(session);
    if (!vendorRecord) throw new Error('Vendor not found.');

    // Check if vendor was already paid (completed payout transaction exists)
    const completedPayout = await Transaction.findOne({
      order_id: order._id,
      user_id: vendorRecord.user_id,
      type: 'payout',
      status: 'completed',
    }).session(session);

    if (completedPayout) {
      // Debit vendor wallet to claw back the direct payout
      const debited = await debitBalance(vendorRecord.user_id, completedPayout.amount, session, { allowNegative: false });
      if (!debited) throw new Error('Vendor has insufficient balance to claw back the direct payout. Cannot impose escrow.');
      // Mark old payout as reversed
      completedPayout.status = 'reversed';
      completedPayout.metadata = { ...(completedPayout.metadata || {}), reversed_by: 'admin_escrow_impose', reversed_at: new Date() };
      await completedPayout.save({ session });
    } else {
      // Mark any pending payout as voided (food acceptance hold, new restaurant hold, etc.)
      await Transaction.updateMany(
        { order_id: order._id, user_id: vendorRecord.user_id, type: 'payout', status: 'pending' },
        { $set: { status: 'voided', 'metadata.voided_by': 'admin_escrow_impose', 'metadata.voided_at': new Date() } },
        { session }
      );
    }

    // Create escrow record
    await Escrow.create([{
      order_id: order._id,
      vendor_id: order.vendor_id,
      buyer_id: order.customer_id,
      amount: vendorBaseAmount,
      status: 'held',
    }], { session, ordered: true });

    // Create new pending payout transaction for the escrow
    const crypto = require('crypto');
    await Transaction.create([{
      user_id: vendorRecord.user_id,
      type: 'payout',
      amount: vendorBaseAmount,
      reference: `AURA-ESCROW-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      status: 'pending',
      description: `Admin-imposed escrow for Order #${order._id.toString().slice(-6).toUpperCase()} — funds held pending release`,
      order_id: order._id,
      gateway: 'escrow',
      metadata: {
        platform_fee_breakdown: {
          base_amount: vendorBaseAmount,
          commission_fee: commissionFee,
          escrow_fee: escrowFee,
          platform_fee: platformFee,
          vendor_payout: vendorPayout,
        },
        imposed_by: req.user._id,
      },
    }], { session, ordered: true });

    // Mark order as escrow-enabled
    order.escrow_enabled = true;
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Notify vendor
    await sendNotification(req.app, vendorRecord.user_id, {
      title: 'Escrow Imposed on Order',
      message: `An administrator has placed Order #${order._id.toString().slice(-6).toUpperCase()} under escrow protection. Funds will be released after delivery confirmation.`,
      type: 'system_alert',
      metadata: { order_id: order._id },
    });

    res.status(200).json({
      success: true,
      message: 'Escrow imposed successfully. Vendor funds are now held.',
      data: { order_id: order._id, escrow_amount: vendorBaseAmount },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (['Order not found.', 'Order must be paid', 'Escrow already exists', 'Vendor not found', 'Vendor has insufficient'].some(m => error.message?.startsWith(m))) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const getPendingVendors = async (req, res, next) => {
  try {
    const submissions = await KYC.find(scoped('KYC', { status: 'pending' }, req.managerScope)).populate('user_id', 'name email avatar').populate('vendor_id', 'store_name description rating');
    res.status(200).json({ success: true, count: submissions.length, data: { submissions } });
  } catch (error) {
    next(error);
  }
};

const getPendingProducts = async (req, res, next) => {
  try {
    const products = await Product.find(scoped('Product', { status: 'pending' }, req.managerScope)).populate('vendor_id', 'store_name').sort('-createdAt');
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

    const product = await Product.findById(req.params.id).populate('vendor_id', 'user_id');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (req.managerScope && product.vendor_id) {
      const vendorUserId = product.vendor_id.user_id || product.vendor_id;
      assertAccessLevel(req.managerScope, vendorUserId, 'standard');
    }
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
    const product = await Product.findById(req.params.id).populate('vendor_id', 'user_id');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (req.managerScope && product.vendor_id) {
      const vendorUserId = product.vendor_id.user_id || product.vendor_id;
      assertAccessLevel(req.managerScope, vendorUserId, 'standard');
    }

    const updateData = {};

    // ── Simple string / boolean fields ────────────────────────────────────────
    ['name', 'description', 'category', 'status', 'specifications', 'long_description'].forEach((f) => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });

    if (req.body.featured !== undefined) {
      updateData.featured = req.body.featured === 'true' || req.body.featured === true;
    }

    // ── Tags ──────────────────────────────────────────────────────────────────
    if (req.body.tags !== undefined) {
      try {
        updateData.tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
      } catch (_e) { updateData.tags = []; }
    }

    // ── Price ─────────────────────────────────────────────────────────────────
    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ success: false, message: 'Invalid product price.' });
      }
      updateData.price = price;
    }

    // ── Sale price ────────────────────────────────────────────────────────────
    if (req.body.sale_price === '' || req.body.sale_price === null || req.body.sale_price === undefined) {
      updateData.sale_price = null;
      updateData.on_sale = false;
    } else {
      const salePrice = Number(req.body.sale_price);
      const refPrice = updateData.price !== undefined ? updateData.price : Number(product.price);
      if (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= refPrice) {
        return res.status(400).json({ success: false, message: 'Sale price must be less than the regular price.' });
      }
      updateData.sale_price = salePrice;
      updateData.on_sale = true;
    }

    // ── Stock ─────────────────────────────────────────────────────────────────
    if (req.body.stock !== undefined) {
      const stock = Number(req.body.stock);
      if (!Number.isFinite(stock) || stock < 0) {
        return res.status(400).json({ success: false, message: 'Invalid product stock.' });
      }
      updateData.stock = stock;
    }

    // ── Images ────────────────────────────────────────────────────────────────
    if (req.body.existing_images !== undefined || (req.files && req.files.length > 0)) {
      const finalImages = [];
      if (req.body.existing_images) {
        const existing = Array.isArray(req.body.existing_images)
          ? req.body.existing_images
          : [req.body.existing_images];
        existing.forEach((url) => finalImages.push({ url }));
      }
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          finalImages.push({ url: file.location || `/uploads/${file.filename}` });
        });
      }
      updateData.images = finalImages;
    }

    // ── Variants ──────────────────────────────────────────────────────────────
    if (req.body.has_variants !== undefined) {
      const wantsVariants = req.body.has_variants === 'true' || req.body.has_variants === true;
      updateData.has_variants = wantsVariants;
      if (!wantsVariants) {
        updateData.variant_types = [];
        updateData.sku_variants = [];
      }
    }

    if (req.body.variant_types && typeof req.body.variant_types === 'string') {
      try { updateData.variant_types = JSON.parse(req.body.variant_types); } catch (e) {}
    }

    if (req.body.sku_variants && typeof req.body.sku_variants === 'string') {
      try {
        const variants = JSON.parse(req.body.sku_variants);
        variants.forEach((v) => {
          if (v.price !== undefined) v.price = Number(v.price);
          if (v.stock !== undefined) v.stock = Number(v.stock);
          if (v.sale_price === '' || v.sale_price === null || v.sale_price === undefined) {
            v.sale_price = null;
          } else {
            v.sale_price = Number(v.sale_price);
          }
        });
        updateData.sku_variants = variants;
      } catch (e) {}
    }

    // If price changed on a variable product with no explicit sku_variants update, propagate price
    if (
      updateData.price !== undefined &&
      product.has_variants &&
      Array.isArray(product.sku_variants) &&
      product.sku_variants.length > 0 &&
      req.body.sku_variants === undefined
    ) {
      updateData.sku_variants = product.sku_variants.map((v) => ({
        ...v.toObject(),
        price: updateData.price,
      }));
    }

    Object.assign(product, updateData);
    if (updateData.sku_variants !== undefined) product.markModified('sku_variants');
    if (updateData.variant_types !== undefined) product.markModified('variant_types');
    if (updateData.images !== undefined) product.markModified('images');

    await product.save();
    const populated = await Product.findById(product._id).populate('vendor_id', 'store_name');

    cache.clear();
    res.status(200).json({ success: true, message: 'Product updated.', data: { product: populated } });
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
    const users = await User.find(scoped('User', query, req.managerScope)).select('-password').sort('-createdAt').limit(500);

    // Attach active manager assignment info per user
    const userIds = users.map(u => u._id);
    const assignments = await ManagerAssignment.find({
      user_id: { $in: userIds },
      status: 'active',
    }).populate('manager_id', 'name email').lean();

    const assignmentMap = {};
    for (const a of assignments) {
      assignmentMap[String(a.user_id)] = {
        manager_name: a.manager_id?.name || a.manager_id?.email || null,
        manager_id: a.manager_id?._id || null,
        access_level: a.access_level,
      };
    }

    const enriched = users.map(u => {
      const obj = u.toObject ? u.toObject() : u;
      const mgr = assignmentMap[String(obj._id)];
      if (mgr) obj.managed_by = mgr;
      return obj;
    });

    res.status(200).json({ success: true, count: enriched.length, data: { users: enriched } });
  } catch (error) {
    next(error);
  }
};

const normalizeNullablePercentage = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    const error = new Error('Commission rate must be between 0 and 100.');
    error.statusCode = 400;
    throw error;
  }
  return num;
};

const normalizeNullableXafAmount = (value, fieldName = 'Amount') => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    const error = new Error(`${fieldName} must be a non-negative XAF amount.`);
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
const getAllVendors = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status === 'verified') query.verified = true;
    if (status === 'unverified') query.verified = false;
    if (status === 'deactivated') query.is_onboarded = false;

    const scopedQuery = scoped('Vendor', query, req.managerScope);
    const [vendors, totalVendors, vendorOrderStats] = await Promise.all([
      Vendor.find(scopedQuery)
        .populate('user_id', 'name email avatar verification_status branding')
        .populate('store', 'logo banner categories commission_rate delivery_time minimum_order_amount')
        .sort('-createdAt'),
      Vendor.countDocuments(scopedQuery),
      Order.aggregate([
        { $match: scoped('Order', { payment_status: 'paid' }, req.managerScope) },
        {
          $group: {
            _id: '$vendor_id',
            total_sales: { $sum: 1 },
            total_revenue: { $sum: '$total_amount' },
          },
        },
      ]),
    ]);

    // Build a lookup map for vendor order stats
    const statsMap = {};
    vendorOrderStats.forEach((s) => {
      statsMap[s._id?.toString()] = { total_sales: s.total_sales, total_revenue: s.total_revenue };
    });

    // Merge live order stats into each vendor
    const enriched = vendors.map((v) => {
      const plain = v.toObject();
      const live = statsMap[plain._id?.toString()] || {};
      plain.total_sales = live.total_sales || 0;
      plain.total_revenue = live.total_revenue || 0;
      return plain;
    });

    res.status(200).json({ success: true, count: enriched.length, total: totalVendors, data: { vendors: enriched } });
  } catch (error) {
    next(error);
  }
};

const updateVendorMedia = async (req, res, next) => {
  try {
    const { logo, banner } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    assertAccessLevel(req.managerScope, vendor.user_id, 'standard');

    const updates = {};
    if (typeof logo === 'string') updates.logo = logo.trim() || null;
    if (typeof banner === 'string') updates.banner = banner.trim() || null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Provide a logo or banner URL.' });
    }

    await Store.findOneAndUpdate(
      { vendor_id: vendor._id },
      { $set: updates },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    const brandingUpdates = {};
    if (Object.prototype.hasOwnProperty.call(updates, 'logo')) brandingUpdates['branding.logo'] = updates.logo;
    if (Object.prototype.hasOwnProperty.call(updates, 'banner')) brandingUpdates['branding.banner'] = updates.banner;
    if (Object.keys(brandingUpdates).length > 0) {
      await User.findByIdAndUpdate(vendor.user_id, { $set: brandingUpdates });
    }
    await clearApiCache();

    const populated = await Vendor.findById(vendor._id)
      .populate('user_id', 'name email avatar verification_status branding')
      .populate('store', 'logo banner categories commission_rate delivery_time minimum_order_amount');

    res.status(200).json({ success: true, message: 'Vendor media updated.', data: { vendor: populated } });
  } catch (error) {
    next(error);
  }
};

const updateVendorStoreSettings = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    assertAccessLevel(req.managerScope, vendor.user_id, 'standard');

    const storeUpdates = {};
    const commissionRate = normalizeNullablePercentage(req.body.commission_rate);
    const minimumOrderAmount = normalizeNullableXafAmount(req.body.minimum_order_amount, 'Minimum order amount');
    const deliveryTime = normalizeNullableText(req.body.delivery_time);

    if (commissionRate !== undefined) storeUpdates.commission_rate = commissionRate;
    if (minimumOrderAmount !== undefined) storeUpdates.minimum_order_amount = minimumOrderAmount;
    if (deliveryTime !== undefined) storeUpdates.delivery_time = deliveryTime;

    // vendor_type lives on the Vendor doc, not the Store sub-doc
    const ALLOWED_VENDOR_TYPES = ['retail', 'restaurant', 'digital'];
    const vendorDocUpdates = {};
    if (req.body.vendor_type && ALLOWED_VENDOR_TYPES.includes(req.body.vendor_type)) {
      vendorDocUpdates.vendor_type = req.body.vendor_type;
    }

    if (Object.keys(storeUpdates).length === 0 && Object.keys(vendorDocUpdates).length === 0) {
      return res.status(400).json({ success: false, message: 'Provide at least one store setting to update.' });
    }

    if (Object.keys(storeUpdates).length > 0) {
      await Store.findOneAndUpdate(
        { vendor_id: vendor._id },
        { $set: storeUpdates, $setOnInsert: { vendor_id: vendor._id } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true }
      );
    }

    if (Object.keys(vendorDocUpdates).length > 0) {
      await Vendor.findByIdAndUpdate(vendor._id, { $set: vendorDocUpdates });
    }

    await clearApiCache();

    const populated = await Vendor.findById(vendor._id)
      .populate('user_id', 'name email avatar verification_status branding')
      .populate('store', 'logo banner categories commission_rate delivery_time minimum_order_amount');

    res.status(200).json({ success: true, message: 'Vendor store settings updated.', data: { vendor: populated } });
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
    const products = await Product.find(scoped('Product', query, req.managerScope)).populate('vendor_id', 'store_name').sort('-createdAt').limit(500);
    res.status(200).json({ success: true, count: products.length, data: { products } });
  } catch (error) {
    next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    assertAccessLevel(req.managerScope, req.params.id, 'standard');
    const user = await User.findByIdAndUpdate(req.params.id, { verification_status: status }, { returnDocument: 'after' });
    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

const updateVendorStatus = async (req, res, next) => {
  try {
    const { verified, is_onboarded } = req.body;
    const update = {};
    if (typeof verified === 'boolean') update.verified = verified;
    if (typeof is_onboarded === 'boolean') update.is_onboarded = is_onboarded;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update.' });
    }

    const vendorCheck = await Vendor.findById(req.params.id).select('user_id').lean();
    if (!vendorCheck) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    assertAccessLevel(req.managerScope, vendorCheck.user_id, 'standard');
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    // If deactivating vendor, also deactivate their store
    if (is_onboarded === false) {
      await Store.findOneAndUpdate({ vendor_id: vendor._id }, { is_active: false });
    } else if (is_onboarded === true) {
      await Store.findOneAndUpdate({ vendor_id: vendor._id }, { is_active: true });
    }

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
    assertAccessLevel(req.managerScope, firm.user_id, 'standard');
    firm.is_verified = !firm.is_verified;
    await firm.save();
    res.status(200).json({ success: true, data: { firm } });
  } catch (error) {
    next(error);
  }
};

const fetchAdminShipments = async (req, res, next) => {
  try {
    const { status, firm_id, since, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (firm_id && firm_id !== 'all') filter.logistics_id = firm_id;
    if (since) filter.createdAt = { $gte: new Date(since) };
    const query = scoped('Shipment', filter, req.managerScope);

    const [shipments, total, statusCounts] = await Promise.all([
      Shipment.find(query)
        .populate('order_id', 'total_amount tracking_number createdAt')
        .populate('vendor_id', 'store_name')
        .populate('logistics_id', 'company_name')
        .populate('booked_by', 'name phone email')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Shipment.countDocuments(query),
      Shipment.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const counts = {};
    statusCounts.forEach((s) => { counts[s._id] = s.count; });

    res.status(200).json({
      success: true,
      count: shipments.length,
      total,
      data: {
        shipments,
        stats: {
          total,
          delivered: counts.delivered || 0,
          in_transit: counts.in_transit || 0,
          pending: counts.pending || 0,
          assigned: counts.assigned || 0,
          picked_up: counts.picked_up || 0,
          out_for_delivery: counts.out_for_delivery || 0,
          failed: (counts.failed || 0) + (counts.cancelled || 0),
        },
      },
    });
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
    // Resolve vendor user_id for scope check
    if (req.managerScope && shipment.vendor_id) {
      const userId = req.managerScope.resolveUserId('vendor', shipment.vendor_id);
      assertAccessLevel(req.managerScope, userId, 'standard');
    }
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
    const firms = await LogisticsCompany.find(scoped('LogisticsCompany', {}, req.managerScope)).populate('user_id', 'name email avatar is_active').sort('-createdAt');
    res.status(200).json({ success: true, count: firms.length, data: { firms } });
  } catch (error) {
    next(error);
  }
};

const getLogisticsEarningsReport = async (req, res, next) => {
  try {
    const vendorTotals = await Order.aggregate([
      { $match: scoped('Order', { payment_status: { $in: ['paid', 'pending'] }, order_status: { $ne: 'cancelled' } }, req.managerScope) },
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
      { $match: scoped('Shipment', {}, req.managerScope) },
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
    assertAccessLevel(req.managerScope, firm.user_id, 'standard');

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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1-D Step 9 — Full zone CRUD (city / district / quartier)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/zones?type=city|district|quartier&parent_id=<id>&city_id=<id>&is_active=true
const listZones = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.type)      filter.type      = req.query.type;
    if (req.query.parent_id) filter.parent_id = req.query.parent_id;
    if (req.query.city_id)   filter.ancestors = req.query.city_id;
    if (req.query.is_active !== undefined) filter.is_active = req.query.is_active !== 'false';

    const zones = await LogisticZone.find(filter)
      .populate('parent_id', 'name type code')
      .sort({ level: 1, name: 1 })
      .lean();

    res.json({ success: true, count: zones.length, data: zones });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/zones — auto-derives level + ancestors from parent
const createZone = async (req, res, next) => {
  try {
    const { name, type, parent_id, code, centroid } = req.body;
    if (!name || !type) {
      return res.status(400).json({ success: false, message: 'name and type are required.' });
    }
    if (!['city', 'district', 'quartier'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be city, district, or quartier.' });
    }

    let level = 1;
    let ancestors = [];

    if (parent_id) {
      const parent = await LogisticZone.findById(parent_id).lean();
      if (!parent) {
        return res.status(400).json({ success: false, message: 'parent_id not found.' });
      }
      level     = (parent.level || 1) + 1;
      ancestors = [...(parent.ancestors || []), parent._id];
    }

    const zoneData = { name: name.trim(), type, level, ancestors };
    if (parent_id) zoneData.parent_id = parent_id;
    if (code)      zoneData.code      = code.trim().toUpperCase();
    if (centroid?.coordinates) zoneData.centroid = centroid;

    const zone = await LogisticZone.create(zoneData);
    res.status(201).json({ success: true, data: zone });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/admin/zones/:id — allowed: name, is_active, code, centroid
const updateZone = async (req, res, next) => {
  try {
    const allowed = {};
    if (req.body.name      !== undefined) allowed.name      = req.body.name.trim();
    if (req.body.is_active !== undefined) allowed.is_active = !!req.body.is_active;
    if (req.body.code      !== undefined) allowed.code      = req.body.code.trim().toUpperCase();
    if (req.body.centroid?.coordinates)   allowed.centroid  = req.body.centroid;

    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ success: false, message: 'Provide at least one of: name, is_active, code, centroid.' });
    }

    const zone = await LogisticZone.findByIdAndUpdate(
      req.params.id,
      { $set: allowed },
      { returnDocument: "after", runValidators: true }
    );
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found.' });

    res.json({ success: true, data: zone });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/zones/:id — soft deactivate by default; ?hard=true for permanent
const deleteZone = async (req, res, next) => {
  try {
    const zone = await LogisticZone.findById(req.params.id).lean();
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found.' });

    if (req.query.hard === 'true') {
      const childCount = await LogisticZone.countDocuments({ parent_id: req.params.id });
      if (childCount > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot hard-delete: ${childCount} child zone(s) exist. Deactivate children first.`,
        });
      }
      await LogisticZone.findByIdAndDelete(req.params.id);
      return res.json({ success: true, message: 'Zone permanently deleted.' });
    }

    await LogisticZone.findByIdAndUpdate(req.params.id, { $set: { is_active: false } });
    res.json({ success: true, message: 'Zone deactivated.' });
  } catch (error) {
    next(error);
  }
};

// Legacy stub — kept so existing /api/admin/logistics/zones callers don't 404
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
    const s = req.managerScope;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Settled sales over time. Pending payment attempts are operational
    // orders, not revenue, so they are intentionally excluded.
    const salesOverTime = await Order.aggregate([
      { $match: scoped('Order', { ...SETTLED_ORDER_MATCH, createdAt: { $gte: thirtyDaysAgo } }, s) },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, dailyRevenue: { $sum: "$total_amount" }, orderCount: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ]);

    // 2. Top vendors by settled sales
    const topVendors = await Order.aggregate([
      { $match: scoped('Order', SETTLED_ORDER_MATCH, s) },
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
    const topProducts = await Product.find(scoped('Product', { status: 'active' }, s))
      .sort({ purchase_count: -1, view_count: -1 })
      .limit(10)
      .select('name price purchase_count view_count stock category images');

    // 4. Role-Based User Breakdown
    const roleBreakdown = await User.aggregate([
      { $match: scoped('User', {}, s) },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // 5. Product Category Distribution
    const categoryStats = await Product.aggregate([
      { $match: scoped('Product', {}, s) },
      { $group: { _id: '$category', count: { $sum: 1 }, totalValue: { $sum: '$price' } } }
    ]);

    // 6. Order Status Matrix
    const orderMatrix = await Order.aggregate([
      { $match: scoped('Order', {}, s) },
      { $group: { _id: '$order_status', count: { $sum: 1 }, total_volume: { $sum: '$total_amount' } } }
    ]);

    // 7. Global Financial Integrity (Total platform flow)
    const totalRevenue = await Order.aggregate([
      { $match: scoped('Order', { payment_status: 'paid' }, s) },
      { $group: { _id: null, total: { $sum: '$total_amount' } } }
    ]);

    // Custody is tracked by Escrow records, not by orders awaiting payment.
    // Pending mobile-money orders have not funded the platform yet.
    const totalEscrow = await Escrow.aggregate([
      { $match: scoped('Escrow', { status: { $in: ['held', 'disputed'] } }, s) },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // 8. Platform Summary Additions
    const liveShipments = await Shipment.countDocuments(scoped('Shipment', { status: { $in: ['pending', 'picked_up', 'in_transit'] } }, s));
    const stockAlerts = await Product.countDocuments(scoped('Product', { stock: { $lte: 5 }, status: 'active' }, s));

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
          total_users: await User.countDocuments(scoped('User', {}, s)),
          total_vendors: await Vendor.countDocuments(scoped('Vendor', {}, s)),
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
    assertAccessLevel(req.managerScope, user._id, 'standard');

    // Track old email to check if it changed
    let emailChanged = false;
    if (email && email !== user.email) {
      emailChanged = true;
      user.email = email;
    }

    if (name) user.name = name;
    const previousRole = user.role;
    if (role) user.role = role;
    const previousVerificationStatus = user.verification_status;
    if (verification_status) user.verification_status = verification_status;
    if (typeof phone !== 'undefined') user.phone = phone;

    await user.save();

    // Audit sensitive privilege changes
    if (role && role !== previousRole) {
      recordAudit({
        actorId: req.user._id,
        action: 'role_change',
        targetType: 'User',
        targetId: user._id,
        before: { role: previousRole },
        after: { role },
      }).catch(() => {});
    }
    if (verification_status && verification_status !== previousVerificationStatus) {
      recordAudit({
        actorId: req.user._id,
        action: 'verification_status_change',
        targetType: 'User',
        targetId: user._id,
        before: { verification_status: previousVerificationStatus },
        after: { verification_status },
      }).catch(() => {});
    }

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
    assertAccessLevel(req.managerScope, user._id, 'full');

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

    // Scope check: managers can only bulk-delete users in their portfolio
    if (req.managerScope) {
      for (const uid of filteredIds) {
        assertAccessLevel(req.managerScope, uid, 'full');
      }
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

    const orderContextPopulate = {
      path: 'order_id',
      select: 'customer_id vendor_id products subtotal shipping_fee total_amount payment_method payment_status shipping_method shipping_address tracking_number order_status logistics_company_id createdAt',
      populate: [
        {
          path: 'vendor_id',
          select: 'store_name user_id rating branding logo logo_url',
          populate: {
            path: 'user_id',
            select: 'name email avatar phone'
          }
        },
        {
          path: 'customer_id',
          select: 'name email avatar role phone'
        },
        {
          path: 'products.product_id',
          select: 'name price images'
        },
        {
          path: 'logistics_company_id',
          select: 'company_name contact_email contact_phone service_regions vehicle_types'
        }
      ]
    };

    const ordersContextPopulate = {
      ...orderContextPopulate,
      path: 'order_ids'
    };

    const scopedQuery = scoped('Transaction', query, req.managerScope);
    const transactions = await Transaction.find(scopedQuery)
      .populate('user_id', 'name email avatar role phone wallet_balance')
      .populate(orderContextPopulate)
      .populate(ordersContextPopulate)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Transaction.countDocuments(scopedQuery);

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
    assertAccessLevel(req.managerScope, transaction.user_id, 'full');
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

const importEversendTransactions = async (req) => {
  const eversend = require('../services/eversend.service');
  const result = await eversend.getTransactions({ limit: 20 });
  const remoteTxs = result?.data?.transactions || [];
  let importedCount = 0;

  for (const rt of remoteTxs) {
    const isPlatformTx = rt.transactionRef && (rt.transactionRef.startsWith('AURA') || rt.transactionRef.startsWith('TEST'));
    if (!isPlatformTx) continue;

    const exists = await Transaction.findOne({
      $or: [{ gateway_transaction_id: rt.transactionId }, { reference: rt.transactionRef }],
    });

    if (!exists && rt.transactionId) {
      await Transaction.create({
        user_id: req.user?._id,
        type: rt.type === 'collection' ? 'deposit' : 'withdrawal',
        amount: parseFloat(rt.amount),
        currency: rt.currency,
        reference: rt.transactionRef || `IMP-${rt.transactionId}`,
        gateway_transaction_id: rt.transactionId,
        status: rt.status === 'successful' ? 'completed' : rt.status === 'failed' ? 'failed' : 'pending',
        gateway: 'eversend',
        description: `Imported via Gateway Sync: ${rt.type} (${rt.status})`,
        gateway_response: rt,
      });
      importedCount++;
    }
  }

  return importedCount;
};

const reconcileEversendTransactions = async (app) => {
  const mongoose = require('mongoose');
  const eversend = require('../services/eversend.service');
  const { settleOrdersInSession } = require('./payment.controller');

  const pending = await Transaction.find({
    gateway: 'eversend',
    status: { $in: ['pending', 'processing'] },
  })
    .limit(40)
    .sort('-createdAt');

  let updated = 0;
  for (const transaction of pending) {
    const ageSeconds = (Date.now() - new Date(transaction.createdAt).getTime()) / 1000;
    if (ageSeconds < 40) continue;

    try {
      const lookupFn = transaction.gateway_transaction_id
        ? () => eversend.getTransactionStatus(transaction.gateway_transaction_id)
        : () => eversend.getCollectionByRef(transaction.reference);

      const raw = await lookupFn();
      const data = raw?.data || raw;
      const status = (data?.status || '').toUpperCase();

      if (status === 'SUCCESSFUL' || status === 'COMPLETED') {
        if (transaction.status === 'completed') continue;
        const user = await User.findById(transaction.user_id);
        if (!user) continue;

        const sess = await mongoose.startSession();
        sess.startTransaction();
        try {
          transaction.status = 'completed';
          transaction.gateway_response = data;
          if (data?.transactionId && !transaction.gateway_transaction_id) {
            transaction.gateway_transaction_id = data.transactionId;
          }
          await transaction.save({ session: sess });

          if (transaction.order_ids?.length > 0) {
            await settleOrdersInSession(
              transaction.user_id,
              transaction.order_ids,
              app,
              sess,
              true,
              process.env.WEB_CLIENT_URL || '',
              'eversend'
            );
          } else {
            await User.findByIdAndUpdate(
              transaction.user_id,
              { $inc: { wallet_balance: transaction.amount } },
              { session: sess }
            );
          }
          await sess.commitTransaction();
          updated++;
        } catch (e) {
          await sess.abortTransaction();
          console.error('[syncGateways] Eversend settlement error:', e.message);
        } finally {
          sess.endSession();
        }
      } else if (status === 'FAILED' && transaction.status !== 'failed') {
        transaction.status = 'failed';
        transaction.gateway_response = data;
        await transaction.save();
        updated++;
      }
    } catch (err) {
      console.error('[syncGateways] Eversend verify error:', transaction.reference, err.message);
    }
  }

  return updated;
};

const syncWithEversend = async (req, res, next) => {
  try {
    const importedCount = await importEversendTransactions(req);
    res.status(200).json({
      success: true,
      message: `Gateway reconciliation complete. ${importedCount} new records discovered and imported.`,
      importedCount,
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

const syncGatewayTransactions = async (req, res, next) => {
  try {
    const eversendImported = await importEversendTransactions(req);
    const eversendUpdated = await reconcileEversendTransactions(req.app);

    res.status(200).json({
      success: true,
      message: `Gateways synced — Eversend: ${eversendImported} imported, ${eversendUpdated} updated.`,
      eversendImported,
      eversendUpdated,
    });
  } catch (error) {
    const errData = error.response?.data;
    const errStatus = error.response?.status;
    const errMessage = errData?.message || error.message;

    console.error('Sync Gateways Error:', errStatus, errData || error.message);

    if (errStatus === 401 && errMessage?.toLowerCase().includes('invalid request origin')) {
      return res.status(503).json({
        success: false,
        message:
          'Eversend API access denied: whitelist this server IP in your Eversend developer settings.',
        code: 'EVERSEND_IP_NOT_WHITELISTED',
      });
    }

    if (errStatus === 401) {
      return res.status(503).json({
        success: false,
        message: 'Eversend authentication failed. Check EVERSEND_CLIENT_ID and EVERSEND_CLIENT_SECRET.',
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

    const allowedStatuses = new Set(['pending', 'processing', 'completed', 'failed', 'cancelled']);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction status.' });
    }

    // Scope check: look up the transaction's user_id first
    if (req.managerScope) {
      const txCheck = await Transaction.findById(id).select('user_id').lean();
      if (!txCheck) return res.status(404).json({ success: false, message: 'Transaction not found.' });
      assertAccessLevel(req.managerScope, txCheck.user_id, 'full');
    }

    let transaction;

    // Claim a financial completion before reading its balance/order data. Two
    // admins can otherwise both observe "pending" and credit the same deposit.
    if (status === 'completed') {
      transaction = await Transaction.findOneAndUpdate(
        { _id: id, status: { $in: ['pending', 'failed'] } },
        { $set: { status: 'processing' } },
        { returnDocument: "after" },
      );
      if (!transaction) {
        const existing = await Transaction.findById(id).select('status reference');
        if (!existing) return res.status(404).json({ success: false, message: 'Transaction not found.' });
        return res.status(409).json({
          success: false,
          message: `Transaction ${existing.reference} is already ${existing.status} and cannot be completed again.`,
        });
      }
    } else {
      transaction = await Transaction.findById(id);
      if (!transaction) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    // If marking as completed and it wasn't already completed
    if (status === 'completed') {
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
          // Pure wallet top-up — atomic credit
          await creditBalance(user._id, transaction.amount);
          
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

const getQueueStats = async (req, res, next) => {
  try {
    const { getQueueStats: readQueueStats } = require('../services/jobQueue.service');
    res.status(200).json({ success: true, data: { queues: readQueueStats() } });
  } catch (error) {
    next(error);
  }
};

// ── P2P Shipments Management ─────────────────────────────────────────────────
const fetchAdminP2PShipments = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const filter = { type: 'p2p' };
    if (status && status !== 'all') filter.status = status;
    if (search) {
      filter.tracking_code = { $regex: escapeRegExp(search), $options: 'i' };
    }
    const query = scoped('Shipment', filter, req.managerScope);

    const [shipments, total] = await Promise.all([
      Shipment.find(query)
        .populate('logistics_id', 'company_name contact_phone logo')
        .populate('booked_by', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      Shipment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: shipments.length,
      total,
      data: { shipments },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/backfill-user-names
 * Find vendors whose associated user has no name (or placeholder) and
 * set the user's name to the vendor's store_name.
 */
const backfillUserNames = async (req, res, next) => {
  try {
    const vendors = await Vendor.find({ store_name: { $exists: true, $ne: '' } })
      .populate('user_id', 'name')
      .lean();

    const updates = [];
    for (const v of vendors) {
      if (!v.user_id) continue;
      const userName = (v.user_id.name || '').trim();
      // Consider it missing if empty, single char, "user"/"unnamed", or looks like a phone/email
      const isPlaceholder = !userName || userName.length <= 1
        || /^(user|unnamed|test|customer|vendor)$/i.test(userName)
        || /^\+?\d{7,}$/.test(userName)
        || /^\S+@\S+\.\S+$/.test(userName);
      if (isPlaceholder) {
        updates.push({
          userId: v.user_id._id,
          oldName: userName || '(empty)',
          newName: v.store_name,
        });
        await User.findByIdAndUpdate(v.user_id._id, { name: v.store_name });
      }
    }

    res.status(200).json({
      success: true,
      message: `Updated ${updates.length} user name(s).`,
      data: { updated: updates },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Treasury & Vendor Balance Management
// ─────────────────────────────────────────────

const DIAL_CODES = { CM: '237', CI: '225', SN: '221', GA: '241', CD: '243', CG: '242', GQ: '240' };
const toE164 = (phone, countryIso = 'CM') => {
  if (!phone) return phone;
  let v = String(phone).replace(/[^\d+]/g, '');
  if (v.startsWith('00')) v = '+' + v.slice(2);
  if (v.startsWith('+')) return v;
  const dialCode = DIAL_CODES[String(countryIso).toUpperCase()] || '237';
  if (v.startsWith(dialCode)) v = v.slice(dialCode.length);
  if (v.startsWith('0')) v = v.slice(1);
  return `+${dialCode}${v}`;
};

const EVERSEND_MIN_XAF  = 1000;
const PAWAPAY_MIN_XAF   = 100;

/**
 * POST /api/admin/treasury/payout
 * Execute a direct payout via Eversend or PawaPay without a WithdrawalRequest.
 */
const adminDirectPayout = async (req, res, next) => {
  try {
    const { gateway, amount, phone, firstName, lastName, country = 'CM', currency = 'XAF', note } = req.body;

    if (!gateway || !['eversend', 'pawapay'].includes(gateway)) {
      return res.status(400).json({ success: false, message: 'Gateway must be eversend or pawapay.' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0.' });
    }
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Recipient phone number is required.' });
    }
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Recipient first and last name are required.' });
    }

    const amt = Math.round(Number(amount));
    const txRef = generateRef();

    if (gateway === 'eversend') {
      if (currency === 'XAF' && amt < EVERSEND_MIN_XAF) {
        return res.status(400).json({ success: false, message: `Eversend requires at least ${EVERSEND_MIN_XAF.toLocaleString()} XAF.` });
      }

      const quotation = await eversend.getPayoutQuotation(amt, currency, currency, country, 'momo');
      const balanceAfter = quotation?.data?.quotation?.sourceCurrencyBalanceAfter;
      if (balanceAfter !== undefined && balanceAfter < 0) {
        return res.status(400).json({ success: false, message: `Insufficient funds in Eversend ${currency} wallet.` });
      }

      const quotationToken = quotation?.data?.token || quotation?.token;
      if (!quotationToken) {
        return res.status(502).json({ success: false, message: 'No quotation token returned from Eversend.' });
      }

      const payoutResult = await eversend.executeMomoPayout(
        quotationToken,
        toE164(phone, country),
        firstName,
        lastName,
        country,
        txRef
      );

      const payoutTxId = payoutResult?.data?.transactionId || payoutResult?.transactionId;
      const rawStatus = (payoutResult?.data?.status || payoutResult?.status || '').toUpperCase();
      // Eversend returns SUCCESSFUL / FAILED / PENDING
      const mappedStatus = rawStatus === 'SUCCESSFUL' ? 'completed'
        : rawStatus === 'FAILED' ? 'failed' : 'pending';

      const transaction = await Transaction.create({
        user_id: req.user._id,
        type: 'withdrawal',
        amount: amt,
        reference: txRef,
        status: mappedStatus,
        description: `Admin direct payout via Eversend to ${phone}${note ? ` — ${note}` : ''}`,
        gateway: 'eversend',
        gateway_transaction_id: payoutTxId || txRef,
        gateway_response: payoutResult,
        currency,
        metadata: {
          admin_direct: true,
          admin_id: req.user._id,
          recipient: { phone, firstName, lastName, country },
          note: note || null,
          quotation_token: quotationToken,
        },
      });

      await recordAudit({
        actorId: req.user._id,
        action: 'admin_direct_payout',
        targetType: 'Transaction',
        targetId: transaction._id,
        after: { gateway: 'eversend', amount: amt, phone, reference: txRef },
      });

      return res.status(200).json({
        success: true,
        message: 'Payout sent via Eversend.',
        data: { transaction, payoutTransactionId: payoutTxId },
      });
    }

    // PawaPay
    if (currency === 'XAF' && amt < PAWAPAY_MIN_XAF) {
      return res.status(400).json({ success: false, message: `PawaPay requires at least ${PAWAPAY_MIN_XAF.toLocaleString()} XAF.` });
    }

    const correspondent = pawapay.detectProvider(phone);
    if (!pawapay.isSupportedCameroonProvider(correspondent)) {
      return res.status(400).json({
        success: false,
        message: 'PawaPay payouts currently support MTN Mobile Money only. Use Eversend for Orange Money.',
      });
    }

    const payoutId = crypto.randomUUID();
    const payoutResult = await pawapay.createPayout({
      payoutId,
      amount: amt,
      currency,
      correspondent,
      phone,
      description: 'Auradime admin payout',
      clientRef: txRef,
    });

    const ppStatus = (payoutResult?.status || '').toUpperCase();
    const finalStatus = ppStatus === 'REJECTED' ? 'failed' : 'pending';

    const transaction = await Transaction.create({
      user_id: req.user._id,
      type: 'withdrawal',
      amount: amt,
      reference: txRef,
      status: finalStatus,
      description: `Admin direct payout via PawaPay to ${phone}${note ? ` — ${note}` : ''}`,
      gateway: 'pawapay',
      gateway_transaction_id: payoutId,
      gateway_response: payoutResult,
      currency,
      metadata: {
        admin_direct: true,
        admin_id: req.user._id,
        recipient: { phone, firstName, lastName, country },
        note: note || null,
        pawapay_payout_id: payoutId,
      },
    });

    await recordAudit({
      actorId: req.user._id,
      action: 'admin_direct_payout',
      targetType: 'Transaction',
      targetId: transaction._id,
      after: { gateway: 'pawapay', amount: amt, phone, reference: txRef, status: finalStatus },
    });

    return res.status(200).json({
      success: true,
      message: finalStatus === 'failed' ? 'PawaPay rejected the payout.' : 'Payout initiated via PawaPay.',
      data: { transaction, payoutId },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/treasury/recheck
 * Recheck all pending admin direct payout transactions with their gateways
 * and update status to completed/failed accordingly.
 */
const recheckTreasuryPayouts = async (req, res, next) => {
  try {
    const pendingTxns = await Transaction.find({
      'metadata.admin_direct': true,
      status: 'pending',
    }).lean();

    if (!pendingTxns.length) {
      return res.status(200).json({ success: true, message: 'No pending payouts to recheck.', data: { updated: [] } });
    }

    const updated = [];

    for (const tx of pendingTxns) {
      try {
        if (tx.gateway === 'eversend') {
          const txId = tx.gateway_transaction_id;
          if (!txId) continue;
          const statusRes = await eversend.getTransactionStatus(txId);
          const gatewayStatus = (statusRes?.data?.status || statusRes?.status || '').toUpperCase();

          if (gatewayStatus === 'SUCCESSFUL') {
            await Transaction.findByIdAndUpdate(tx._id, { status: 'completed', gateway_response: statusRes });
            updated.push({ _id: tx._id, reference: tx.reference, oldStatus: 'pending', newStatus: 'completed' });
          } else if (gatewayStatus === 'FAILED') {
            await Transaction.findByIdAndUpdate(tx._id, { status: 'failed', gateway_response: statusRes });
            updated.push({ _id: tx._id, reference: tx.reference, oldStatus: 'pending', newStatus: 'failed' });
          }
        } else if (tx.gateway === 'pawapay') {
          const payoutId = tx.gateway_transaction_id || tx.metadata?.pawapay_payout_id;
          if (!payoutId) continue;
          const statusRes = await pawapay.getPayoutStatus(payoutId);
          const gatewayStatus = pawapay.normalizePawaPayoutStatus(statusRes?.status || '');

          if (gatewayStatus === 'SUCCESSFUL') {
            await Transaction.findByIdAndUpdate(tx._id, { status: 'completed', gateway_response: statusRes });
            updated.push({ _id: tx._id, reference: tx.reference, oldStatus: 'pending', newStatus: 'completed' });
          } else if (gatewayStatus === 'FAILED') {
            await Transaction.findByIdAndUpdate(tx._id, { status: 'failed', gateway_response: statusRes });
            updated.push({ _id: tx._id, reference: tx.reference, oldStatus: 'pending', newStatus: 'failed' });
          }
        }
      } catch (err) {
        console.warn(`[recheckTreasuryPayouts] Error checking ${tx.reference}:`, err.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Rechecked ${pendingTxns.length} pending payout(s). Updated ${updated.length}.`,
      data: { checked: pendingTxns.length, updated },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/treasury/history
 * List all admin-initiated direct payouts.
 */
const getAdminDirectPayoutHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, status, gateway, search } = req.query;
    const filter = { 'metadata.admin_direct': true };
    if (status && status !== 'all') filter.status = status;
    if (gateway && gateway !== 'all') filter.gateway = gateway;
    if (search) {
      const regex = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ reference: regex }, { description: regex }];
    }
    const query = scoped('Transaction', filter, req.managerScope);

    const [transactions, total, statsAgg] = await Promise.all([
      Transaction.find(query)
        .populate('user_id', 'name email')
        .sort('-createdAt')
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      Transaction.countDocuments(query),
      Transaction.aggregate([
        { $match: scoped('Transaction', { 'metadata.admin_direct': true }, req.managerScope) },
        {
          $group: {
            _id: null,
            total_count: { $sum: 1 },
            total_amount: { $sum: '$amount' },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            completed_amount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] } },
          },
        },
      ]),
    ]);

    const stats = statsAgg[0] || { total_count: 0, total_amount: 0, completed: 0, pending: 0, failed: 0, completed_amount: 0 };

    res.status(200).json({
      success: true,
      data: { transactions, total, stats },
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/treasury/gateway-balances
 * Return Eversend wallet balances.
 */
const getGatewayBalances = async (req, res, next) => {
  try {
    const wallets = await eversend.getWallets();
    res.status(200).json({ success: true, data: { wallets: wallets?.data || wallets || [] } });
  } catch (error) {
    console.warn('[getGatewayBalances] Could not fetch wallets:', error.message);
    res.status(200).json({ success: true, data: { wallets: [] }, warning: 'Could not fetch gateway wallets.' });
  }
};

/**
 * GET /api/admin/vendor-balance/search
 * Search vendors by name/phone/email for balance management.
 */
const searchVendorsForBalance = async (req, res, next) => {
  try {
    const { search } = req.query;
    if (!search || search.length < 2) {
      return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters.' });
    }

    const regex = new RegExp(escapeRegExp(search), 'i');

    // Find matching users first
    const matchingUsers = await User.find({
      $or: [{ name: regex }, { email: regex }, { phone: regex }],
    }).select('_id').lean();
    const matchingUserIds = matchingUsers.map(u => u._id);

    // Then find vendors by store_name OR user match
    const vendorQuery = scoped('Vendor', {
      $or: [
        { store_name: regex },
        ...(matchingUserIds.length ? [{ user_id: { $in: matchingUserIds } }] : []),
      ],
    }, req.managerScope);
    const vendors = await Vendor.find(vendorQuery)
      .populate('user_id', 'name email phone wallet_balance avatar')
      .limit(20)
      .lean();

    const results = vendors
      .filter(v => v.user_id)
      .map(v => ({
        vendor_id: v._id,
        store_name: v.store_name,
        user_id: v.user_id._id,
        user_name: v.user_id.name,
        email: v.user_id.email,
        phone: v.user_id.phone,
        wallet_balance: v.user_id.wallet_balance || 0,
        avatar: v.user_id.avatar,
      }));

    res.status(200).json({ success: true, data: { vendors: results } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/vendor-balance/adjust
 * Credit or debit a vendor's wallet balance with audit trail.
 */
const adminAdjustVendorBalance = async (req, res, next) => {
  try {
    const { userId, amount, operation, reason } = req.body;

    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be greater than 0.' });
    if (!['credit', 'debit'].includes(operation)) return res.status(400).json({ success: false, message: 'Operation must be credit or debit.' });
    if (!reason || reason.length < 5) return res.status(400).json({ success: false, message: 'Reason must be at least 5 characters.' });
    assertAccessLevel(req.managerScope, userId, 'full');

    const user = await User.findById(userId).select('name wallet_balance');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const signedDelta = operation === 'credit' ? Math.abs(Number(amount)) : -Math.abs(Number(amount));

    const result = await adjustBalance(userId, signedDelta, null, {
      type: 'payout',
      gateway: 'manual',
      description: `Admin ${operation}: ${reason}`,
      actorId: req.user._id,
      metadata: {
        admin_balance_adjustment: true,
        admin_id: req.user._id,
        admin_name: req.user.name,
        operation,
        reason,
      },
      allowNegative: true,
    });

    if (!result) {
      return res.status(400).json({ success: false, message: 'Balance adjustment failed.' });
    }

    res.status(200).json({
      success: true,
      message: `${operation === 'credit' ? 'Credited' : 'Debited'} ${Number(amount).toLocaleString()} XAF successfully.`,
      data: {
        user: { _id: result.user._id, wallet_balance: result.user.wallet_balance },
        transaction: result.transaction,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/vendor-balance/history
 * List all admin-initiated balance adjustments.
 */
const getAdminBalanceAdjustmentHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, search } = req.query;
    const query = scoped('Transaction', { 'metadata.admin_balance_adjustment': true }, req.managerScope);

    const [transactions, total, statsAgg] = await Promise.all([
      Transaction.find(query)
        .populate('user_id', 'name email phone')
        .sort('-createdAt')
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      Transaction.countDocuments(query),
      Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            total_count: { $sum: 1 },
            total_credited: { $sum: { $cond: [{ $eq: ['$metadata.operation', 'credit'] }, '$amount', 0] } },
            total_debited: { $sum: { $cond: [{ $eq: ['$metadata.operation', 'debit'] }, '$amount', 0] } },
          },
        },
      ]),
    ]);

    const stats = statsAgg[0] || { total_count: 0, total_credited: 0, total_debited: 0 };
    stats.net = (stats.total_credited || 0) - (stats.total_debited || 0);

    res.status(200).json({
      success: true,
      data: { transactions, total, stats },
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/vendor-balance/transactions/:userId
 * Get a specific vendor/user's transaction history.
 */
const getVendorTransactionHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    assertInScope(req.managerScope, userId);

    const [transactions, total] = await Promise.all([
      Transaction.find({ user_id: userId })
        .sort('-createdAt')
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .lean(),
      Transaction.countDocuments({ user_id: userId }),
    ]);

    res.status(200).json({
      success: true,
      data: { transactions, total },
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// Manager Promotion / Demotion
// ─────────────────────────────────────────────
const promoteToManager = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('+token_version');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot promote yourself.' });
    }
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot change an admin\'s role.' });
    if (user.role === 'manager') return res.status(400).json({ success: false, message: 'User is already a manager.' });

    const warnings = [];
    const previousRole = user.role;

    // Check for active vendor operations that will be paused while promoted
    if (previousRole === 'vendor') {
      const vendor = await Vendor.findOne({ user_id: user._id }).select('_id store_name').lean();
      if (vendor) {
        const pendingOrders = await Order.countDocuments({
          vendor_id: vendor._id,
          status: { $in: ['pending', 'processing', 'confirmed', 'preparing', 'ready'] },
        });
        const heldEscrow = await Escrow.countDocuments({
          vendor_id: vendor._id,
          status: { $in: ['held', 'pending_release'] },
        });
        if (pendingOrders > 0) warnings.push(`${pendingOrders} pending order(s) on store "${vendor.store_name}"`);
        if (heldEscrow > 0) warnings.push(`${heldEscrow} escrow record(s) still held`);
      }
    }

    // Check for active logistics operations
    if (previousRole === 'logistics') {
      const LogisticsFirm = require('../models/LogisticsFirm.model');
      const firm = await LogisticsFirm.findOne({ user_id: user._id }).select('_id company_name').lean();
      if (firm) {
        const Shipment = require('../models/Shipment.model');
        const activeShipments = await Shipment.countDocuments({
          logistics_firm_id: firm._id,
          status: { $in: ['pending', 'picked_up', 'in_transit', 'out_for_delivery'] },
        });
        if (activeShipments > 0) warnings.push(`${activeShipments} active shipment(s) under "${firm.company_name}"`);
      }
    }

    // If force flag not set and there are warnings, return them for confirmation
    if (warnings.length > 0 && !req.body.force) {
      return res.status(409).json({
        success: false,
        code: 'ACTIVE_OPERATIONS',
        message: `User has active operations: ${warnings.join('; ')}. Send { "force": true } to proceed anyway.`,
        warnings,
      });
    }

    // Atomic update with role condition guard to prevent TOCTOU race
    const oldVerification = user.verification_status;
    const updated = await User.findOneAndUpdate(
      { _id: user._id, role: previousRole },
      {
        $set: { role: 'manager', previous_role: previousRole, verification_status: 'verified' },
        $inc: { token_version: 1 },
      },
      { new: true },
    );

    if (!updated) {
      return res.status(409).json({ success: false, message: 'Role was changed by another request. Please retry.' });
    }

    await recordAudit({
      actorId: req.user._id,
      action: 'promote_to_manager',
      targetType: 'User',
      targetId: user._id,
      before: { role: previousRole, verification_status: oldVerification },
      after: { role: 'manager', previous_role: previousRole, verification_status: 'verified' },
    });

    res.json({
      success: true,
      message: `${updated.name || updated.email} promoted to manager.`,
      warnings: warnings.length > 0 ? warnings : undefined,
      data: { user: updated },
    });
  } catch (error) { next(error); }
};

const demoteManager = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot demote yourself.' });
    }
    if (user.role !== 'manager') return res.status(400).json({ success: false, message: 'User is not a manager.' });

    const restoredRole = user.previous_role || 'customer';
    const oldPreviousRole = user.previous_role;

    // Atomic update with role condition guard to prevent TOCTOU race
    const updated = await User.findOneAndUpdate(
      { _id: user._id, role: 'manager' },
      {
        $set: { role: restoredRole, previous_role: null },
        $inc: { token_version: 1 },
      },
      { new: true },
    );

    if (!updated) {
      return res.status(409).json({ success: false, message: 'Role was changed by another request. Please retry.' });
    }

    // Revoke all active/pending assignments (preserve history)
    await ManagerAssignment.updateMany(
      { manager_id: user._id, status: { $in: ['active', 'pending'] } },
      { $set: { status: 'revoked', revoked_at: new Date(), revoked_by: req.user._id } }
    );

    await recordAudit({
      actorId: req.user._id,
      action: 'demote_manager',
      targetType: 'User',
      targetId: user._id,
      before: { role: 'manager', previous_role: oldPreviousRole },
      after: { role: restoredRole, previous_role: null },
    });

    res.json({
      success: true,
      message: `${updated.name || updated.email} restored to ${restoredRole}.`,
      data: { user: updated },
    });
  } catch (error) { next(error); }
};

// ─────────────────────────────────────────────────────────────────────────────
// Manager Assignment System
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/admin/managers/:managerId/assign — Admin direct-assigns users
const assignUsersToManager = async (req, res, next) => {
  try {
    const { userIds, access_level = 'standard', note } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'userIds array is required.' });
    }
    if (userIds.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 user IDs per request.' });
    }
    if (!['read_only', 'standard', 'full'].includes(access_level)) {
      return res.status(400).json({ success: false, message: 'Invalid access_level.' });
    }

    const manager = await User.findById(req.params.managerId).select('name email role');
    if (!manager) return res.status(404).json({ success: false, message: 'Manager not found.' });
    if (manager.role !== 'manager') {
      return res.status(400).json({ success: false, message: 'Target user is not a manager.' });
    }

    const results = { assigned: [], skipped: [], rejected: [] };

    for (const uid of userIds) {
      try {
        // Validate the target user
        const target = await User.findById(uid).select('name email role');
        if (!target) {
          results.rejected.push({ id: uid, reason: 'User not found' });
          continue;
        }
        if (['admin', 'manager'].includes(target.role)) {
          results.rejected.push({ id: uid, reason: `Cannot assign ${target.role} accounts` });
          continue;
        }
        if (target._id.toString() === manager._id.toString()) {
          results.rejected.push({ id: uid, reason: 'Cannot assign manager to themselves' });
          continue;
        }

        // Check for existing active assignment
        const existing = await ManagerAssignment.findOne({
          manager_id: manager._id,
          user_id: target._id,
        });

        if (existing && existing.status === 'active') {
          results.skipped.push({ id: uid, name: target.name, reason: 'Already assigned' });
          continue;
        }

        if (existing) {
          // Reactivate revoked/declined assignment
          existing.status = 'active';
          existing.access_level = access_level;
          existing.assigned_by = req.user._id;
          existing.note = note || existing.note;
          existing.revoked_at = null;
          existing.revoked_by = null;
          await existing.save();
        } else {
          await ManagerAssignment.create({
            manager_id: manager._id,
            user_id: target._id,
            access_level,
            status: 'active',
            assigned_by: req.user._id,
            note,
          });
        }

        results.assigned.push({ id: uid, name: target.name });

        // Notify the user
        sendNotification(req.app, target._id, {
          title: 'Account Manager Assigned',
          message: `${manager.name || manager.email} has been assigned as your account manager.`,
          type: 'system_alert',
          metadata: { target_id: manager._id },
        });
      } catch (dupErr) {
        if (dupErr.code === 11000) {
          results.skipped.push({ id: uid, reason: 'Duplicate assignment' });
        } else {
          results.rejected.push({ id: uid, reason: dupErr.message });
        }
      }
    }

    await recordAudit({
      actorId: req.user._id,
      action: 'manager_assign',
      targetType: 'ManagerAssignment',
      targetId: manager._id,
      after: { assigned: results.assigned.length, access_level, managerId: manager._id },
    });

    res.json({ success: true, data: results });
  } catch (error) { next(error); }
};

// POST /api/admin/managers/:managerId/invite — Invite flow (pending until user accepts)
const inviteUsersToManager = async (req, res, next) => {
  try {
    const { userIds, access_level = 'standard', note } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'userIds array is required.' });
    }
    if (userIds.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 user IDs per request.' });
    }
    if (!['read_only', 'standard', 'full'].includes(access_level)) {
      return res.status(400).json({ success: false, message: 'Invalid access_level.' });
    }

    const managerId = req.params.managerId;
    // Manager can only invite to themselves; admin can invite to any manager
    if (req.user.role === 'manager' && req.user._id.toString() !== managerId) {
      return res.status(403).json({ success: false, message: 'Managers can only send invites for themselves.' });
    }

    const manager = await User.findById(managerId).select('name email role');
    if (!manager) return res.status(404).json({ success: false, message: 'Manager not found.' });
    if (manager.role !== 'manager') {
      return res.status(400).json({ success: false, message: 'Target user is not a manager.' });
    }

    const results = { invited: [], skipped: [], rejected: [] };

    for (const uid of userIds) {
      try {
        const target = await User.findById(uid).select('name email role');
        if (!target) {
          results.rejected.push({ id: uid, reason: 'User not found' });
          continue;
        }
        if (['admin', 'manager'].includes(target.role)) {
          results.rejected.push({ id: uid, reason: `Cannot invite ${target.role} accounts` });
          continue;
        }

        const existing = await ManagerAssignment.findOne({
          manager_id: manager._id,
          user_id: target._id,
        });

        if (existing && ['active', 'pending'].includes(existing.status)) {
          results.skipped.push({ id: uid, name: target.name, reason: `Already ${existing.status}` });
          continue;
        }

        if (existing) {
          existing.status = 'pending';
          existing.access_level = access_level;
          existing.assigned_by = req.user._id;
          existing.note = note || existing.note;
          existing.revoked_at = null;
          existing.revoked_by = null;
          await existing.save();
        } else {
          await ManagerAssignment.create({
            manager_id: manager._id,
            user_id: target._id,
            access_level,
            status: 'pending',
            assigned_by: req.user._id,
            note,
          });
        }

        results.invited.push({ id: uid, name: target.name });

        sendNotification(req.app, target._id, {
          title: 'Manager Access Request',
          message: `${manager.name || manager.email} has requested to manage your account. Please review and accept or decline.`,
          type: 'system_alert',
          metadata: { target_id: manager._id },
        });
      } catch (dupErr) {
        if (dupErr.code === 11000) {
          results.skipped.push({ id: uid, reason: 'Duplicate' });
        } else {
          results.rejected.push({ id: uid, reason: dupErr.message });
        }
      }
    }

    await recordAudit({
      actorId: req.user._id,
      action: 'manager_invite',
      targetType: 'ManagerAssignment',
      targetId: manager._id,
      after: { invited: results.invited.length, access_level },
    });

    res.json({ success: true, data: results });
  } catch (error) { next(error); }
};

// POST /api/manager-assignments/:assignmentId/respond — User accepts/declines invite
const respondToInvite = async (req, res, next) => {
  try {
    const { accept } = req.body;
    if (typeof accept !== 'boolean') {
      return res.status(400).json({ success: false, message: '"accept" (boolean) is required.' });
    }

    const assignment = await ManagerAssignment.findById(req.params.assignmentId)
      .populate('manager_id', 'name email');
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }
    // Only the target user can respond
    if (assignment.user_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }
    if (assignment.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Assignment is already ${assignment.status}.` });
    }

    const oldStatus = assignment.status;
    assignment.status = accept ? 'active' : 'declined';
    await assignment.save();

    // Notify the manager
    sendNotification(req.app, assignment.manager_id._id, {
      title: accept ? 'Invite Accepted' : 'Invite Declined',
      message: `${req.user.name || req.user.email} has ${accept ? 'accepted' : 'declined'} your management request.`,
      type: 'system_alert',
      metadata: { target_id: req.user._id },
    });

    await recordAudit({
      actorId: req.user._id,
      action: accept ? 'manager_accept' : 'manager_decline',
      targetType: 'ManagerAssignment',
      targetId: assignment._id,
      before: { status: oldStatus },
      after: { status: assignment.status },
    });

    res.json({
      success: true,
      message: accept ? 'Manager access granted.' : 'Manager invite declined.',
    });
  } catch (error) { next(error); }
};

// POST /api/admin/managers/:managerId/unassign — Admin revokes assignments
const unassignUsers = async (req, res, next) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'userIds array is required.' });
    }

    const manager = await User.findById(req.params.managerId).select('name email role');
    if (!manager) return res.status(404).json({ success: false, message: 'Manager not found.' });

    const result = await ManagerAssignment.updateMany(
      {
        manager_id: manager._id,
        user_id: { $in: userIds },
        status: { $in: ['active', 'pending'] },
      },
      {
        $set: {
          status: 'revoked',
          revoked_at: new Date(),
          revoked_by: req.user._id,
        },
      }
    );

    // Notify manager and users
    if (result.modifiedCount > 0) {
      sendNotification(req.app, manager._id, {
        title: 'Accounts Unassigned',
        message: `${result.modifiedCount} account(s) have been removed from your management.`,
        type: 'system_alert',
      });
      for (const uid of userIds) {
        sendNotification(req.app, uid, {
          title: 'Manager Removed',
          message: `${manager.name || manager.email} is no longer managing your account.`,
          type: 'system_alert',
        });
      }
    }

    await recordAudit({
      actorId: req.user._id,
      action: 'manager_revoke',
      targetType: 'ManagerAssignment',
      targetId: manager._id,
      after: { revokedCount: result.modifiedCount, userIds },
    });

    res.json({ success: true, message: `${result.modifiedCount} assignment(s) revoked.` });
  } catch (error) { next(error); }
};

// GET /api/admin/managers/:managerId/assignments — List assignments
const getManagerAssignments = async (req, res, next) => {
  try {
    const managerId = req.params.managerId;
    // Manager can only view own assignments
    if (req.user.role === 'manager' && req.user._id.toString() !== managerId) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    const { status, access_level, search, page = 1, limit = 100 } = req.query;
    const query = { manager_id: managerId };
    if (status && status !== 'all') query.status = status;
    else if (!status) query.status = 'active'; // default to active
    if (access_level && access_level !== 'all') query.access_level = access_level;

    let assignments = await ManagerAssignment.find(query)
      .populate('user_id', 'name email role avatar verification_status is_active')
      .populate('assigned_by', 'name email')
      .sort('-createdAt')
      .skip(((+page) - 1) * (+limit))
      .limit(+limit)
      .lean();

    // Client-side search on populated user name/email
    if (search) {
      const safeSearch = escapeRegExp(search);
      const re = new RegExp(safeSearch, 'i');
      assignments = assignments.filter(a =>
        a.user_id && (re.test(a.user_id.name) || re.test(a.user_id.email))
      );
    }

    const total = await ManagerAssignment.countDocuments(query);

    res.json({ success: true, data: assignments, total });
  } catch (error) { next(error); }
};

// PATCH /api/admin/managers/:managerId/assignments/:assignmentId — Change access level
const updateAssignmentLevel = async (req, res, next) => {
  try {
    const { access_level } = req.body;
    if (!['read_only', 'standard', 'full'].includes(access_level)) {
      return res.status(400).json({ success: false, message: 'Invalid access_level.' });
    }

    const assignment = await ManagerAssignment.findOne({
      _id: req.params.assignmentId,
      manager_id: req.params.managerId,
    }).populate('user_id', 'name email').populate('manager_id', 'name email');

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    const oldLevel = assignment.access_level;
    assignment.access_level = access_level;
    await assignment.save();

    // Notify both parties
    sendNotification(req.app, assignment.manager_id._id, {
      title: 'Access Level Changed',
      message: `Your access level for ${assignment.user_id.name || assignment.user_id.email} changed from ${oldLevel} to ${access_level}.`,
      type: 'system_alert',
    });
    sendNotification(req.app, assignment.user_id._id, {
      title: 'Manager Access Updated',
      message: `${assignment.manager_id.name || assignment.manager_id.email}'s access level changed to ${access_level}.`,
      type: 'system_alert',
    });

    await recordAudit({
      actorId: req.user._id,
      action: 'manager_access_level_change',
      targetType: 'ManagerAssignment',
      targetId: assignment._id,
      before: { access_level: oldLevel },
      after: { access_level },
    });

    res.json({ success: true, message: 'Access level updated.', data: assignment });
  } catch (error) { next(error); }
};

// POST /api/admin/managers/transfer — Transfer accounts between managers
const transferAssignments = async (req, res, next) => {
  try {
    const { fromManagerId, toManagerId, userIds } = req.body;
    if (!fromManagerId || !toManagerId) {
      return res.status(400).json({ success: false, message: 'fromManagerId and toManagerId are required.' });
    }
    if (fromManagerId === toManagerId) {
      return res.status(400).json({ success: false, message: 'Cannot transfer to the same manager.' });
    }

    const [fromMgr, toMgr] = await Promise.all([
      User.findById(fromManagerId).select('name email role'),
      User.findById(toManagerId).select('name email role'),
    ]);
    if (!fromMgr || fromMgr.role !== 'manager') {
      return res.status(400).json({ success: false, message: 'Source manager not found or not a manager.' });
    }
    if (!toMgr || toMgr.role !== 'manager') {
      return res.status(400).json({ success: false, message: 'Target manager not found or not a manager.' });
    }

    // Find assignments to transfer
    const filter = {
      manager_id: fromManagerId,
      status: 'active',
    };
    if (Array.isArray(userIds) && userIds.length > 0) {
      filter.user_id = { $in: userIds };
    }

    const toTransfer = await ManagerAssignment.find(filter).lean();
    if (toTransfer.length === 0) {
      return res.status(400).json({ success: false, message: 'No active assignments found to transfer.' });
    }

    let transferred = 0;

    for (const asgn of toTransfer) {
      // Revoke old assignment
      await ManagerAssignment.findByIdAndUpdate(asgn._id, {
        $set: { status: 'revoked', revoked_at: new Date(), revoked_by: req.user._id },
      });

      // Create or reactivate for the new manager
      const existing = await ManagerAssignment.findOne({
        manager_id: toManagerId,
        user_id: asgn.user_id,
      });

      if (existing) {
        existing.status = 'active';
        existing.access_level = asgn.access_level;
        existing.assigned_by = req.user._id;
        existing.note = `Transferred from ${fromMgr.name || fromMgr.email}`;
        existing.revoked_at = null;
        existing.revoked_by = null;
        await existing.save();
      } else {
        await ManagerAssignment.create({
          manager_id: toManagerId,
          user_id: asgn.user_id,
          access_level: asgn.access_level,
          status: 'active',
          assigned_by: req.user._id,
          note: `Transferred from ${fromMgr.name || fromMgr.email}`,
        });
      }
      transferred++;
    }

    // Notify both managers
    sendNotification(req.app, fromMgr._id, {
      title: 'Accounts Transferred',
      message: `${transferred} account(s) transferred to ${toMgr.name || toMgr.email}.`,
      type: 'system_alert',
    });
    sendNotification(req.app, toMgr._id, {
      title: 'Accounts Received',
      message: `${transferred} account(s) transferred from ${fromMgr.name || fromMgr.email}.`,
      type: 'system_alert',
    });

    await recordAudit({
      actorId: req.user._id,
      action: 'manager_transfer',
      targetType: 'ManagerAssignment',
      targetId: fromMgr._id,
      before: { manager: fromManagerId, count: transferred },
      after: { manager: toManagerId, count: transferred },
    });

    res.json({ success: true, message: `${transferred} assignment(s) transferred.` });
  } catch (error) { next(error); }
};

// GET /api/my-managers — User views their assigned managers
const getMyManagers = async (req, res, next) => {
  try {
    const assignments = await ManagerAssignment.find({
      user_id: req.user._id,
      status: { $in: ['active', 'pending'] },
    })
      .populate('manager_id', 'name email avatar')
      .sort('-createdAt')
      .lean();

    res.json({ success: true, data: assignments });
  } catch (error) { next(error); }
};

// POST /api/my-managers/:assignmentId/revoke — User removes a manager
const revokeMyManager = async (req, res, next) => {
  try {
    const assignment = await ManagerAssignment.findById(req.params.assignmentId)
      .populate('manager_id', 'name email');
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }
    // Only the target user can revoke their own manager
    if (assignment.user_id.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }
    if (assignment.status === 'revoked') {
      return res.status(400).json({ success: false, message: 'Already revoked.' });
    }

    const oldStatus = assignment.status;
    assignment.status = 'revoked';
    assignment.revoked_at = new Date();
    assignment.revoked_by = req.user._id;
    await assignment.save();

    // Notify manager
    sendNotification(req.app, assignment.manager_id._id, {
      title: 'Account Access Revoked',
      message: `${req.user.name || req.user.email} has removed you as their account manager.`,
      type: 'system_alert',
      metadata: { target_id: req.user._id },
    });

    await recordAudit({
      actorId: req.user._id,
      action: 'manager_revoke',
      targetType: 'ManagerAssignment',
      targetId: assignment._id,
      before: { status: oldStatus },
      after: { status: 'revoked' },
    });

    res.json({ success: true, message: 'Manager access revoked.' });
  } catch (error) { next(error); }
};

// GET /api/admin/portfolio — Manager's scoped dashboard summary
const getManagerPortfolio = async (req, res, next) => {
  try {
    const scope = req.managerScope;
    if (!scope) {
      return res.status(400).json({ success: false, message: 'Portfolio is only available for managers.' });
    }

    const [
      totalUsers,
      totalVendors,
      activeOrders,
      pendingKYC,
      openDisputes,
      escrowHeld,
      pendingWithdrawals,
      assignments,
    ] = await Promise.all([
      User.countDocuments(scoped('User', {}, scope)),
      Vendor.countDocuments(scoped('Vendor', {}, scope)),
      Order.countDocuments(scoped('Order', { order_status: { $in: ['placed', 'processing', 'shipped'] } }, scope)),
      KYC.countDocuments(scoped('KYC', { status: 'pending' }, scope)),
      Dispute.countDocuments(scoped('Dispute', { status: { $in: ['open', 'under_review'] } }, scope)),
      Escrow.aggregate([
        { $match: scoped('Escrow', { status: 'held' }, scope) },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      WithdrawalRequest.countDocuments(scoped('WithdrawalRequest', { status: 'pending' }, scope)),
      ManagerAssignment.find({ manager_id: req.user._id, status: 'active' })
        .populate('user_id', 'name email avatar role')
        .sort('-createdAt')
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          users: totalUsers,
          vendors: totalVendors,
          active_orders: activeOrders,
          pending_kyc: pendingKYC,
          open_disputes: openDisputes,
          escrow_held: escrowHeld[0]?.total || 0,
          pending_withdrawals: pendingWithdrawals,
        },
        assignments,
      },
    });
  } catch (error) { next(error); }
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
  imposeEscrow,
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
  updateVendorMedia,
  updateVendorStoreSettings,
  fetchAdminShipments,
  updateAdminShipment,
  getAdminLogisticsFirms,
  getLogisticsEarningsReport,
  toggleLogisticsVerified,
  updateLogisticsFirm,
  addLogisticZone,
  listZones,
  createZone,
  updateZone,
  deleteZone,
  getAdvancedAnalytics,
  getEmailLogs,
  deleteUser,
  bulkDeleteUsers,
  bulkDeleteProducts,
  getAllTransactions,
  updateTransactionStatus,
  getQueueStats,
  fulfillOrderFromTransaction,
  syncWithEversend,
  syncGatewayTransactions,
  setCancelRateHoldOverride,
  // P2P management
  fetchAdminP2PShipments,
  // Phase 4: intercity CRUD
  listIntercityRates,
  createIntercityRate,
  updateIntercityRate,
  deleteIntercityRate,
  listPickupPoints,
  createPickupPoint,
  updatePickupPoint,
  deletePickupPoint,
  backfillUserNames,
  // Treasury & Vendor Balance
  adminDirectPayout,
  recheckTreasuryPayouts,
  getAdminDirectPayoutHistory,
  getGatewayBalances,
  searchVendorsForBalance,
  adminAdjustVendorBalance,
  getAdminBalanceAdjustmentHistory,
  getVendorTransactionHistory,
  // Manager management
  promoteToManager,
  demoteManager,
  // Manager assignments
  assignUsersToManager,
  inviteUsersToManager,
  respondToInvite,
  unassignUsers,
  getManagerAssignments,
  updateAssignmentLevel,
  transferAssignments,
  getMyManagers,
  revokeMyManager,
  // Manager portfolio
  getManagerPortfolio,
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/vendors/:id/cancel-rate-hold
// @desc    Admin override for the cancel-rate hold on a restaurant vendor.
//          Body: { override: true|false }  — true = exempt from monitor, false = re-enable it.
//          Body: { clear_hold: true }      — manually release the current hold regardless of rate.
// @access  Private (admin only)
// ─────────────────────────────────────────────
async function setCancelRateHoldOverride(req, res, next) {
  try {
    const { override, clear_hold } = req.body;
    const vendor = await Vendor.findById(req.params.id).select('user_id vendor_type cancel_rate_hold cancel_rate_hold_since cancel_rate_hold_override');

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    assertAccessLevel(req.managerScope, vendor.user_id, 'standard');
    if (vendor.vendor_type !== 'restaurant') {
      return res.status(400).json({ success: false, message: 'Cancel-rate hold only applies to restaurant vendors.' });
    }

    const update = {};
    if (typeof override === 'boolean') {
      update.cancel_rate_hold_override = override;
    }
    if (clear_hold === true) {
      update.cancel_rate_hold       = false;
      update.cancel_rate_hold_since = null;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'Provide at least one of: override (boolean), clear_hold (true).' });
    }

    Object.assign(vendor, update);
    await vendor.save();

    res.status(200).json({
      success: true,
      data: {
        vendor_id:                  vendor._id,
        cancel_rate_hold:           vendor.cancel_rate_hold,
        cancel_rate_hold_since:     vendor.cancel_rate_hold_since,
        cancel_rate_hold_override:  vendor.cancel_rate_hold_override,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — IntercityRate + PickupPoint Admin CRUD
// Cache keys (Phase 4 Steps 1-2): bust on every write so the resolver sees fresh data.
// ─────────────────────────────────────────────────────────────────────────────

const IntercityRate = require('../models/IntercityRate.model');
const PickupPoint   = require('../models/PickupPoint.model');

const INTERCITY_RATES_PREFIX = 'intercity:rates:v1';
const INTERCITY_POINTS_KEY   = 'intercity:points:v1';

// GET  /api/admin/intercity/rates
async function listIntercityRates(req, res, next) {
  try {
    const rates = await IntercityRate.find()
      .populate('origin_city_zone_id destination_city_zone_id', 'name')
      .populate('default_pickup_point_id', 'branch_name street_address')
      .sort({ agency_name: 1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: rates });
  } catch (e) { next(e); }
}

// Bust all per-route cache entries for intercity rates.
// The resolver caches each origin+dest pair separately under `intercity:rates:v1:{o}:{d}`.
// On any write we bust all keys with this prefix so stale rates are never served.
function bustIntercityRateCache() {
  cache.deleteByPrefix(INTERCITY_RATES_PREFIX);
}

// POST /api/admin/intercity/rates
async function createIntercityRate(req, res, next) {
  try {
    const rate = await IntercityRate.create(req.body);
    await bustIntercityRateCache();
    res.status(201).json({ success: true, data: rate });
  } catch (e) { next(e); }
}

// PATCH /api/admin/intercity/rates/:id
async function updateIntercityRate(req, res, next) {
  try {
    const rate = await IntercityRate.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { returnDocument: "after", runValidators: true }
    );
    if (!rate) return res.status(404).json({ success: false, message: 'Rate not found.' });
    await bustIntercityRateCache();
    res.json({ success: true, data: rate });
  } catch (e) { next(e); }
}

// DELETE /api/admin/intercity/rates/:id
async function deleteIntercityRate(req, res, next) {
  try {
    const rate = await IntercityRate.findByIdAndDelete(req.params.id);
    if (!rate) return res.status(404).json({ success: false, message: 'Rate not found.' });
    await bustIntercityRateCache();
    res.json({ success: true, message: 'Rate deleted.' });
  } catch (e) { next(e); }
}

// GET  /api/admin/intercity/pickup-points
async function listPickupPoints(req, res, next) {
  try {
    const filter = {};
    if (req.query.agency_name) filter.agency_name = req.query.agency_name;
    if (req.query.city_zone_id) filter.city_zone_id = req.query.city_zone_id;
    const points = await PickupPoint.find(filter)
      .populate('city_zone_id district_zone_id', 'name')
      .sort({ agency_name: 1, branch_name: 1 })
      .lean();
    res.json({ success: true, data: points });
  } catch (e) { next(e); }
}

// POST /api/admin/intercity/pickup-points
async function createPickupPoint(req, res, next) {
  try {
    const point = await PickupPoint.create(req.body);
    await cache.delete(INTERCITY_POINTS_KEY);
    res.status(201).json({ success: true, data: point });
  } catch (e) { next(e); }
}

// PATCH /api/admin/intercity/pickup-points/:id
async function updatePickupPoint(req, res, next) {
  try {
    const point = await PickupPoint.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { returnDocument: "after", runValidators: true }
    );
    if (!point) return res.status(404).json({ success: false, message: 'Pickup point not found.' });
    await cache.delete(INTERCITY_POINTS_KEY);
    res.json({ success: true, data: point });
  } catch (e) { next(e); }
}

// DELETE /api/admin/intercity/pickup-points/:id
async function deletePickupPoint(req, res, next) {
  try {
    const point = await PickupPoint.findByIdAndDelete(req.params.id);
    if (!point) return res.status(404).json({ success: false, message: 'Pickup point not found.' });
    res.json({ success: true, message: 'Pickup point deleted.' });
  } catch (e) { next(e); }
}
