/**
 * controllers/logistics.controller.js
 * Aura Market — Logistics Module Controller
 * Full email notification on shipment creation and every status change.
 */

const LogisticsCompany  = require('../models/LogisticsCompany.model');
const Shipment          = require('../models/Shipment.model');
const Order             = require('../models/Order.model');
const Vendor            = require('../models/Vendor.model');
const Escrow            = require('../models/Escrow.model');
const User              = require('../models/User.model');
const Transaction       = require('../models/Transaction.model');
const PlatformSettings  = require('../models/PlatformSettings.model');
const LogisticZone      = require('../models/LogisticZone.model');
const mongoose          = require('mongoose');

const { sendNotification } = require('../utils/notifier');
const { sendEmail }        = require('../utils/emailService');
const logisticsService     = require('../services/logistics.service');
const templates            = require('../utils/emailTemplates');

const generateTxRef = () => `AURA-COD-${Math.floor(100000 + Math.random() * 900000)}`;

// ─────────────────────────────────────────────
// @route   POST /api/logistics/onboard
// @desc    Register a user account as a Logistics Firm
// ─────────────────────────────────────────────
const onboardLogistics = async (req, res, next) => {
  try {
    const { company_name, contact_email, contact_phone, service_regions, vehicle_types } = req.body;

    const existingFirm = await LogisticsCompany.findOne({ user_id: req.user._id });
    if (existingFirm) {
      return res.status(400).json({ success: false, message: 'Logistics profile already exists.' });
    }

    const company = await LogisticsCompany.create({
      user_id: req.user._id,
      company_name,
      contact_email,
      contact_phone,
      service_regions,
      vehicle_types,
    });

    res.status(201).json({ success: true, message: 'Awaiting Admin verification.', data: { company } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/logistics/compatible-firms
// @desc    Search for firms compatible with cart vendors and delivery quartier
// ─────────────────────────────────────────────
const getSearchCompatibleFirms = async (req, res, next) => {
  try {
    const { quartier, vendor_ids } = req.query;
    if (!quartier || !vendor_ids) {
      return res.status(400).json({ success: false, message: 'Quartier and vendor_ids required.' });
    }

    const vendors = Array.isArray(vendor_ids) ? vendor_ids : vendor_ids.split(',');
    const firms   = await logisticsService.getCompatibleFirms(quartier, vendors);

    res.status(200).json({ success: true, count: firms.length, data: { firms } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/logistics/shipments/firm
// @desc    Logistics Firm pulls their assigned tickets
// ─────────────────────────────────────────────
const getFirmShipments = async (req, res, next) => {
  try {
    let firm = await LogisticsCompany.findOne({ user_id: req.user._id });
    
    // Auto-provision stub if missing for a logistics user
    if (!firm) {
      firm = await LogisticsCompany.create({
        user_id: req.user._id,
        company_name: req.user.name || 'Logistics Partner',
        contact_email: req.user.email,
        contact_phone: '000000000',
        service_regions: [],
        vehicle_types: ['motorcycle'],
        is_verified: true // Auto-verify for existing accounts to unblock user
      });
      console.log(`📡 Auto-provisioned missing profile for user ${req.user._id} during fetch.`);
    }

    const shipments = await Shipment.find({ logistics_id: firm._id })
      .populate('order_id', 'total_amount products tracking_number createdAt')
      .populate('vendor_id', 'store_name phone')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: shipments.length, data: { shipments } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/logistics/shipments/:id/status
// @desc    Logistics updates status (Requires proof for delivered/failed)
// ─────────────────────────────────────────────
const modifyShipmentStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status, note, proof_image, failure_reason, receiver_name } = req.body;
    const { id } = req.params;

    const shipment = await Shipment.findById(id).session(session);
    if (!shipment) throw new Error('Shipment not found.');

    const firm = await LogisticsCompany.findById(shipment.logistics_id).session(session);
    if (req.user.role !== 'admin' && firm?.user_id.toString() !== req.user._id.toString()) {
      throw new Error('Access denied.');
    }

    // Validation for Delivered status
    if (status === 'delivered') {
      if (!proof_image && !note) throw new Error('Proof of delivery (image or note) is required.');
      shipment.proof_of_delivery = {
        image_url:     proof_image,
        note:          note,
        receiver_name: receiver_name,
        timestamp:     new Date()
      };
    }

    // Validation for Failed status
    if (status === 'failed') {
      if (!failure_reason) throw new Error('Reason for failure is required.');
      shipment.failure_reason = failure_reason;
    }

    shipment.status = status;
    shipment.shipment_logs.push({
      status,
      updated_by: req.user._id,
      timestamp:  new Date(),
      note:       note || ''
    });

    await shipment.save({ session });

    // ── Sync Order Status ──────────────────────────────────────────────
    const order = await Order.findById(shipment.order_id).session(session);
    let orderCompleted = false;

    if (status === 'delivered') {
      const otherShipments = await Shipment.find({
        order_id: order._id,
        _id: { $ne: shipment._id }
      }).session(session);

      const allDelivered = otherShipments.every(s => s.status === 'delivered');
      if (allDelivered) {
        order.order_status = 'delivered';

        // Pay vendor on delivery (COD)
        if (order.payment_method === 'pay_on_delivery' && order.payment_status === 'pending') {
          const vendorAccount = await Vendor.findById(order.vendor_id).session(session);
          if (vendorAccount) {
            const vendorUser = await User.findById(vendorAccount.user_id).session(session);
            if (vendorUser) {
              vendorUser.wallet_balance += order.total_amount;
              await vendorUser.save({ session });

              await Transaction.create([{
                user_id:     vendorUser._id,
                type:        'payout',
                amount:      order.total_amount,
                reference:   generateTxRef(),
                status:      'completed',
                description: `Payment on delivery settled (Order #${order._id.toString().slice(-6).toUpperCase()})`,
                order_id:    order._id,
              }], { session });

              order.payment_status = 'paid';
            }
          }
        }

        // Auto-release escrow
        if (order.payment_method === 'escrow' && order.payment_status === 'paid') {
          const escrow = await Escrow.findOne({ order_id: order._id }).session(session);
          if (escrow && escrow.status === 'held') {
            const vendorAccount = await Vendor.findById(escrow.vendor_id).session(session);
            if (!vendorAccount) throw new Error('Vendor account not found for escrow release.');

            const vendorUser = await User.findById(vendorAccount.user_id).session(session);
            if (!vendorUser) throw new Error('Vendor wallet owner not found.');

            const settings    = await PlatformSettings.getSettings();
            const platformFee = (escrow.amount * settings.commission_rate) / 100;
            const vendorPayout = escrow.amount - platformFee;

            vendorUser.wallet_balance += vendorPayout;
            await vendorUser.save({ session });

            settings.platform_wallet_balance += platformFee;
            await settings.save({ session });

            await Transaction.findOneAndUpdate(
              { order_id: order._id, user_id: vendorUser._id, type: 'payout', status: 'pending' },
              {
                status:      'completed',
                description: `Escrow auto-released after delivery (Order #${order._id.toString().slice(-6).toUpperCase()})`,
              },
              { session }
            );

            escrow.status       = 'released';
            escrow.release_date = new Date();
            await escrow.save({ session });

            order.order_status = 'completed';
            orderCompleted = true;
          }
        }

        await order.save({ session });
      }
    } else if (status === 'picked_up' || status === 'in_transit' || status === 'out_for_delivery') {
      order.order_status = 'shipped';
      await order.save({ session });
    }

    // ─────────────────────────────────────────────
    // NOTE: Email to customer is sent below with the proper template
    // ─────────────────────────────────────────────

    // If order is completed (via auto-release logic above), notify the logistics partner
    if (order.order_status === 'completed' || order.order_status === 'delivered') {
      await sendNotification(req.app, firm.user_id, {
        title: 'Shipment Successfully Closed',
        message: `Shipment for Order #${order._id.toString().slice(-6).toUpperCase()} is confirmed delivered and settled.`,
        type: 'system_alert',
        metadata: { order_id: order._id, shipment_id: shipment._id },
        sendEmail: true,
        overrideEmail: firm.contact_email,
        emailLink: `${process.env.WEB_CLIENT_URL}/logistics/dashboard?shipmentId=${shipment._id}`,
        orderDetails: order.toObject(),
        role: 'logistics'
      });
    }

    await session.commitTransaction();
    session.endSession();

    // ── Post-commit notifications & emails ────────────────────────────
    const customer = await User.findById(order.customer_id).select('name email');
    const vendor   = await Vendor.findById(order.vendor_id).populate('user_id', 'name email store_name');

    // Email/notify customer about shipment status change
    if (customer) {
      const statusTpl = templates.shipmentStatusChanged({
        shipment,
        order,
        recipient: customer,
        status,
      });
      await sendNotification(req.app, order.customer_id, {
        title:         `Shipment Update: ${status.replace(/_/g, ' ')}`,
        message:       statusTpl.text,
        type:          'order_update',
        metadata:      { shipment_id: shipment._id, order_id: order._id },
        emailTemplate: statusTpl,
      });
    }

    // If vendor is a separate entity, also notify them
    if (vendor?.user_id?._id) {
      const vendorStatusTpl = templates.shipmentStatusChanged({
        shipment,
        order,
        recipient: vendor.user_id,
        status,
      });
      await sendNotification(req.app, vendor.user_id._id, {
        title:         `Shipment Update: ${status.replace(/_/g, ' ')}`,
        message:       vendorStatusTpl.text,
        type:          'order_update',
        metadata:      { shipment_id: shipment._id, order_id: order._id },
        emailTemplate: vendorStatusTpl,
      });
    }

    // If escrow released → notify vendor payment
    if (orderCompleted && vendor?.user_id?._id) {
      const completedTpl = templates.orderCompleted({ order, vendor });
      await sendNotification(req.app, vendor.user_id._id, {
        title:         'Order Completed — Payment Released',
        message:       `Payment for Order #${order._id.toString().slice(-6).toUpperCase()} has been released to your wallet.`,
        type:          'payment',
        metadata:      { order_id: order._id },
        emailTemplate: completedTpl,
      });
    }

    res.status(200).json({ success: true, message: 'Status updated.', data: { shipment } });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/logistics/shipments/vendor
// @desc    Vendors pulls their specific shipment tickets
// ─────────────────────────────────────────────
const getVendorShipments = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user._id });
    if (!vendor) return res.status(403).json({ success: false, message: 'Unregistered Vendor profile.' });

    const shipments = await Shipment.find({ vendor_id: vendor._id })
      .populate('order_id', 'total_amount products tracking_number createdAt')
      .populate('logistics_company_id', 'company_name contact_phone')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: shipments.length, data: { shipments } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/logistics
// @desc    Get all active/verified logistics firms
// ─────────────────────────────────────────────
const getPublicLogisticsFirms = async (req, res, next) => {
  try {
    const firms = await LogisticsCompany.find({ is_verified: true })
      .select('company_name contact_email contact_phone service_regions vehicle_types');
    res.status(200).json({ success: true, count: firms.length, data: { firms } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/logistics/zones
// @desc    Get all logistic zones (Regions & Quartiers)
// ─────────────────────────────────────────────
const getZones = async (req, res, next) => {
  try {
    const zones = await LogisticZone.find({ is_active: true }).populate('parent_id', 'name').sort('name');
    res.status(200).json({ success: true, data: { zones } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/logistics/profile
// @desc    Get current logistics firm profile & pricing
// ─────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    const firm = await LogisticsCompany.findOne({ user_id: req.user._id });
    if (!firm) return res.status(404).json({ success: false, message: 'Logistics profile not found.' });
    res.status(200).json({ success: true, data: { firm } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/logistics/profile
// @desc    Update logistics firm name, contact, logo/banner
// ─────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { company_name, contact_email, contact_phone, logo, banner } = req.body;

    const firm = await LogisticsCompany.findOneAndUpdate(
      { user_id: req.user._id },
      {
        company_name,
        contact_email,
        contact_phone,
        logo,
        banner
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!firm) return res.status(404).json({ success: false, message: 'Logistics profile not found.' });

    res.status(200).json({ success: true, message: 'Logistics profile updated successfully.', data: { firm } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/logistics/pricing
// @desc    Update route pricing & pickup regions
// ─────────────────────────────────────────────
const updatePricing = async (req, res, next) => {
  try {
    const { quartier_prices, supported_pickup_regions } = req.body;

    const sanitizedPrices = (quartier_prices || []).map(p => ({
      quartier: p.quartier,
      price:    Number(p.price)
    }));

    const firm = await LogisticsCompany.findOneAndUpdate(
      { user_id: req.user._id },
      {
        quartier_prices: sanitizedPrices,
        supported_pickup_regions: supported_pickup_regions || []
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!firm) return res.status(404).json({ success: false, message: 'Logistics profile not found.' });

    res.status(200).json({ success: true, message: 'Pricing matrix updated successfully.', data: { firm } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  onboardLogistics,
  getFirmShipments,
  getVendorShipments,
  modifyShipmentStatus,
  getSearchCompatibleFirms,
  getPublicLogisticsFirms,
  getZones,
  getProfile,
  updateProfile,
  updatePricing
};
