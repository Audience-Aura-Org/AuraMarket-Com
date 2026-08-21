/**
 * controllers/logistics.controller.js
 * Auradime — Logistics Module Controller
 * Full email notification on shipment creation and every status change.
 */

const LogisticsCompany  = require('../models/LogisticsCompany.model');
const Shipment          = require('../models/Shipment.model');
const Order             = require('../models/Order.model');
const Vendor            = require('../models/Vendor.model');
const Escrow            = require('../models/Escrow.model');
const User              = require('../models/User.model');
const Store             = require('../models/Store.model');
const Transaction       = require('../models/Transaction.model');
const PlatformSettings  = require('../models/PlatformSettings.model');
const LogisticZone      = require('../models/LogisticZone.model');
const mongoose          = require('mongoose');

const { sendNotification } = require('../utils/notifier');
const { escapeRegExp } = require('../middleware/security.middleware');
const { sendEmail }        = require('../utils/emailService');
const logisticsService     = require('../services/logistics.service');
const templates            = require('../utils/emailTemplates');
const { applyCommissionOverride, calculatePlatformFees } = require('../utils/platformFees');
const { creditBalance } = require('../services/wallet.service');
const { markEscrowDelivered } = require('./escrow.controller');

const generateTxRef = () => `AURA-COD-${Math.floor(100000 + Math.random() * 900000)}`;

const getEffectivePlatformSettings = async (vendorId, session) => {
  const platformSettings = await PlatformSettings.getSettings(session);
  const store = await Store.findOne({ vendor_id: vendorId }).select('commission_rate').session(session);
  return {
    platformSettings,
    effectiveSettings: applyCommissionOverride(platformSettings, store?.commission_rate),
  };
};

// ─────────────────────────────────────────────
// @route   POST /api/logistics/onboard
// @desc    Register a user account as a Logistics Firm
// ─────────────────────────────────────────────
const onboardLogistics = async (req, res, next) => {
  try {
    const { company_name, contact_email, contact_phone, service_regions, vehicle_types } = req.body;

    const existingFirm = await LogisticsCompany.findOne({ user_id: req.user._id });
    if (existingFirm) {
      existingFirm.company_name = company_name;
      existingFirm.contact_email = contact_email;
      existingFirm.contact_phone = contact_phone;
      existingFirm.service_regions = service_regions;
      existingFirm.vehicle_types = vehicle_types;
      await existingFirm.save();

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { onboarded: true },
        { returnDocument: 'after' }
      ).select('-password -password_hash -deletedAt -tokenVersion');

      return res.status(200).json({
        success: true,
        message: 'Logistics profile updated.',
        data: { company: existingFirm, user },
      });
    }

    const company = await LogisticsCompany.create({
      user_id: req.user._id,
      company_name,
      contact_email,
      contact_phone,
      service_regions,
      vehicle_types,
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { onboarded: true },
      { returnDocument: 'after' }
    ).select('-password -password_hash -deletedAt -tokenVersion');

    res.status(201).json({ success: true, message: 'Awaiting Admin verification.', data: { company, user } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/logistics/compatible-firms
// @desc    Search for firms compatible with cart vendors and delivery quartier
// ─────────────────────────────────────────────
// Lightweight intercity detection for the checkout UI.
// Walks zone ancestors to find the city node. Returns null on any failure.
const _resolveCityId = async (zoneId) => {
  if (!zoneId) return null;
  try {
    const zone = await LogisticZone.findById(zoneId).select('type ancestors').lean();
    if (!zone) return null;
    if (zone.type === 'city') return zone._id.toString();
    for (const ancestorId of (zone.ancestors || [])) {
      const anc = await LogisticZone.findById(ancestorId).select('type _id').lean();
      if (anc?.type === 'city') return anc._id.toString();
    }
  } catch (_) {}
  return null;
};

const getSearchCompatibleFirms = async (req, res, next) => {
  try {
    const { quartier, vendor_ids } = req.query;
    if (!vendor_ids) {
      return res.status(400).json({ success: false, message: 'vendor_ids required.' });
    }

    const vendorUserIds = Array.isArray(vendor_ids) ? vendor_ids : vendor_ids.split(',');

    let firms;
    let is_intercity = false;

    if (quartier) {
      firms = await logisticsService.getCompatibleFirms(quartier, vendorUserIds);

      // --- Intercity detection ---
      // Only run when INTERCITY_ENABLED=true to avoid extra DB round-trips in local deployments
      if (String(process.env.INTERCITY_ENABLED || '').toLowerCase() === 'true') {
        try {
          const deliveryZone = await LogisticZone.findOne({
            name: { $regex: new RegExp(`^${quartier.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
            type: 'quartier',
          }).select('_id ancestors type').lean();

          if (deliveryZone) {
            const destCityId = await _resolveCityId(deliveryZone._id);
            if (destCityId) {
              const vendorDocs = await Vendor.find({ user_id: { $in: vendorUserIds } })
                .select('pickup_address.zone_id')
                .lean();
              for (const vd of vendorDocs) {
                const originCityId = await _resolveCityId(vd.pickup_address?.zone_id);
                if (originCityId && originCityId !== destCityId) {
                  is_intercity = true;
                  break;
                }
              }
            }
          }
        } catch (_) {
          // Non-fatal — fall back to is_intercity: false
        }
      }
    } else {
      // No zone selected — return all eligible firms (verified OR active subscription)
      const UserSubscription = require('../models/UserSubscription.model');
      const activeSubUserIds = await UserSubscription.distinct('user_id', {
        role: 'logistics',
        status: 'active',
      });
      firms = await LogisticsCompany.find({
        $or: [
          { is_verified: true },
          { user_id: { $in: activeSubUserIds } },
        ],
      })
        .populate('user_id', 'name email avatar branding')
        .sort('company_name');
    }

    // Annotate fee_estimate (per shipment) and total_fee_estimate on each firm so the
    // cart and checkout pages can display a delivery estimate without a second request.
    const numVendors = vendorUserIds.length;
    const annotatedFirms = firms.map(f => {
      const raw = typeof f.toObject === 'function' ? f.toObject() : { ...f };
      const match = (f.quartier_prices || []).find(
        p => p.quartier && p.quartier.toLowerCase() === (quartier || '').toLowerCase()
      );
      const feeEstimate = match?.price ?? null;
      return {
        ...raw,
        fee_estimate: feeEstimate,
        total_fee_estimate: feeEstimate != null ? feeEstimate * numVendors : null,
      };
    });

    res.status(200).json({ success: true, count: annotatedFirms.length, data: { firms: annotatedFirms, is_intercity } });
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
    const { status, search, page = 1, limit = 50, sortBy = 'assignment' } = req.query;
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const pageNum = Math.max(Number(page) || 1, 1);
    const skip = (pageNum - 1) * lim;

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

    const query = { logistics_id: firm._id };

    if (status && status !== 'all') {
      if (status === 'active') {
        query.status = { $in: ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'] };
      } else if (status === 'open') {
        query.status = { $in: ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'] };
      } else {
        query.status = status;
      }
    }

    if (search) {
      query.tracking_code = { $regex: escapeRegExp(search), $options: 'i' };
    }

    const total = await Shipment.countDocuments(query);

    const populateOrder = {
      path: 'order_id',
      select: 'total_amount products tracking_number createdAt order_status shipping_fee subtotal shipping_method delivery_description shipping_address payment_status payment_method customer_id',
      populate: {
        path: 'customer_id',
        select: 'name email phone',
      },
    };

    let shipments;

    if (sortBy === 'order_placed') {
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: 'orders',
            localField: 'order_id',
            foreignField: '_id',
            as: 'ord',
          },
        },
        { $unwind: '$ord' },
        { $sort: { 'ord.createdAt': -1 } },
        { $skip: skip },
        { $limit: lim },
        { $project: { _id: 1 } },
      ];
      const idRows = await Shipment.aggregate(pipeline);
      const ids = idRows.map((r) => r._id);
      if (ids.length === 0) {
        shipments = [];
      } else {
        const unordered = await Shipment.find({ _id: { $in: ids } })
          .populate(populateOrder)
          .populate('vendor_id', 'store_name phone branding.logo user_id')
          .populate('order_id.products.product_id', 'name images');
        const map = new Map(unordered.map((s) => [s._id.toString(), s]));
        shipments = ids.map((id) => map.get(id.toString())).filter(Boolean);
      }
    } else {
      shipments = await Shipment.find(query)
        .populate(populateOrder)
        .populate('vendor_id', 'store_name phone branding.logo')
        .populate('order_id.products.product_id', 'name images')
        .sort('-createdAt')
        .skip(skip)
        .limit(lim);
    }

    const baseScope = { logistics_id: firm._id };
    const [countPending, countActive, countDelivered] = await Promise.all([
      Shipment.countDocuments({ ...baseScope, status: 'pending' }),
      Shipment.countDocuments({
        ...baseScope,
        status: { $in: ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'] },
      }),
      Shipment.countDocuments({ ...baseScope, status: 'delivered' }),
    ]);

    res.status(200).json({
      success: true,
      count: shipments.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / lim) || 1,
      data: { shipments },
      meta: {
        counts: {
          pending: countPending,
          active: countActive,
          delivered: countDelivered,
        },
        sortBy: sortBy === 'order_placed' ? 'order_placed' : 'assignment',
      },
    });
  } catch (error) {
    console.error('❌ getFirmShipments error:', error.message, error.stack);
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/logistics/shipments/:id
// @desc    Firm (or admin) loads one assigned shipment for detail / deep links
// ─────────────────────────────────────────────
const getFirmShipmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid shipment id.' });
    }

    const populateOrder = {
      path: 'order_id',
      select:
        'total_amount products tracking_number createdAt order_status shipping_fee subtotal shipping_method delivery_description shipping_address payment_status payment_method',
      populate: {
        path: 'products.product_id',
        select: 'name images',
      },
    };

    const shipment = await Shipment.findById(id)
      .populate(populateOrder)
      .populate('vendor_id', 'store_name phone branding.logo');

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }

    if (req.user.role !== 'admin') {
      const firm = await LogisticsCompany.findOne({ user_id: req.user._id });
      if (!firm || shipment.logistics_id?.toString() !== firm._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    res.status(200).json({ success: true, data: { shipment } });
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

    const order = await Order.findById(shipment.order_id).session(session);
    if (!order) throw new Error('Associated order not found.');

    // ── GUARD: Couriers can only update orders using the logistics_partner method ──
    if (order.shipping_method !== 'logistics_partner') {
      throw new Error('This order is vendor-managed. Logistics partners cannot intervene.');
    }

    if (['cancelled', 'refunded'].includes(order.order_status)) {
      throw new Error('Cannot update shipment for a cancelled or refunded order.');
    }

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
    let orderCompleted = false;

    if (status === 'delivered') {
      const otherShipments = await Shipment.find({
        order_id: order._id,
        _id: { $ne: shipment._id }
      }).session(session);

      const allDelivered = otherShipments.every(s => s.status === 'delivered');
      if (allDelivered) {
        order.order_status = 'delivered';

        const escrow = await Escrow.findOne({ order_id: order._id }).session(session);
        const isLogisticsOrder = !!(order.shipping_method === 'logistics_partner' && order.logistics_company_id);
        const isEscrowOrder = !!(escrow && escrow.status === 'held');

        // ── STEP 1: Pay logistics firm their shipping fee (always, for all paid orders) ──
        if (isLogisticsOrder && order.shipping_fee > 0) {
          const logisticsAlreadyPaid = isEscrowOrder ? escrow.logistics_settled : false;

          if (!logisticsAlreadyPaid) {
            // Check transaction log as additional guard for non-escrow orders
            const alreadyTxn = !isEscrowOrder
              ? await Transaction.findOne({
                  user_id: firm.user_id,
                  order_id: order._id,
                  type: 'payout',
                  description: { $regex: 'Delivery payout' }
                }).session(session)
              : null;

            if (!alreadyTxn) {
              const logisticsUser = await creditBalance(firm.user_id, order.shipping_fee, session);
              if (logisticsUser) {
                await Transaction.create([{
                  user_id:     firm.user_id,
                  type:        'payout',
                  amount:      order.shipping_fee,
                  reference:   `LOG-${generateTxRef()}`,
                  status:      'completed',
                  description: `Delivery payout for Order #${order._id.toString().slice(-6).toUpperCase()}`,
                  order_id:    order._id,
                  gateway:     'wallet'
                }], { session, ordered: true });

                if (isEscrowOrder) {
                  escrow.logistics_settled = true;
                  await escrow.save({ session });
                }

                console.log(`📦 Logistics firm credited ${order.shipping_fee} XAF for Order #${order._id.toString().slice(-6).toUpperCase()}.`);
              }
            }
          }
        }

        // ── STEP 2: Resolve vendor + order finalization based on payment type ──

        if (isEscrowOrder) {
          // ── ESCROW + LOGISTICS: Logistics fee settled above. Vendor funds remain held.
          // Order stays 'delivered'. Customer must confirm to release vendor escrow.
          escrow.vendor_confirmed = true; // logistics delivery acts as vendor confirmation
          markEscrowDelivered(escrow, shipment.proof_of_delivery?.timestamp || new Date());
          await escrow.save({ session });

          console.log(`🔒 Escrow order #${order._id} delivered by logistics. Vendor funds held. Awaiting customer confirmation.`);

          // Notify customer to confirm arrival
          setImmediate(async () => {
            const customer = await User.findById(order.customer_id).select('name email').lean();
            const deliveryTpl = templates.deliveryConfirmationRequest({
              order: order.toObject(),
              customer,
              webUrl: process.env.WEB_CLIENT_URL,
              dashboardLink: `${process.env.WEB_CLIENT_URL}/orders/${order._id}`,
              message: `Order #${order._id.toString().slice(-6).toUpperCase()} was delivered by the carrier. Please confirm receipt to release funds to the vendor.`,
            });

            sendNotification(req.app, order.customer_id, {
              title: 'Your order has been delivered',
              message: `Order #${order._id.toString().slice(-6).toUpperCase()} was delivered by the carrier. Please confirm receipt to release funds to the vendor.`,
              type: 'order_status',
              metadata: { order_id: order._id, link: `/orders/${order._id}`, status: 'delivered' },
              sendEmail: true,
              emailTemplate: deliveryTpl,
              orderDetails: order.toObject(),
              role: 'customer',
              emailLink: `${process.env.WEB_CLIENT_URL}/orders/${order._id}`,
            });
          });

        } else if (order.payment_method === 'pay_on_delivery') {
          // ── COD + LOGISTICS: Customer pays logistics in cash. Credit vendor subtotal immediately.
          const vendorAccount = await Vendor.findById(order.vendor_id).session(session);
          if (vendorAccount) {
            const vendorUser = await creditBalance(vendorAccount.user_id, isLogisticsOrder ? order.subtotal : order.total_amount, session);
            if (vendorUser) {
              const vendorBaseAmount = isLogisticsOrder ? order.subtotal : order.total_amount;
              await Transaction.create([{
                user_id:     vendorAccount.user_id,
                type:        'payout',
                amount:      vendorBaseAmount,
                reference:   generateTxRef(),
                status:      'completed',
                description: `COD payment settled via logistics (Order #${order._id.toString().slice(-6).toUpperCase()})`,
                order_id:    order._id,
              }], { session, ordered: true });

              order.payment_status = 'paid';
              order.order_status = 'completed';
              orderCompleted = true;
            }
          }

        } else {
          // ── NON-ESCROW DIGITAL PAYMENT + LOGISTICS: Pay vendor subtotal immediately.
          const vendorAccount = await Vendor.findById(order.vendor_id).session(session);
          if (vendorAccount) {
            if (vendorAccount) {
              const { platformSettings, effectiveSettings } = await getEffectivePlatformSettings(order.vendor_id, session);
              const { platformFee, vendorPayout } = calculatePlatformFees(order.subtotal, effectiveSettings);
              await creditBalance(vendorAccount.user_id, vendorPayout, session);

              if (platformFee > 0) {
                platformSettings.platform_wallet_balance = (platformSettings.platform_wallet_balance || 0) + platformFee;
                await platformSettings.save({ session });
              }

              await Transaction.create([{
                user_id:     vendorAccount.user_id,
                type:        'payout',
                amount:      vendorPayout,
                reference:   generateTxRef(),
                status:      'completed',
                description: `Vendor payout on logistics delivery (Order #${order._id.toString().slice(-6).toUpperCase()})`,
                order_id:    order._id,
                gateway:     'wallet'
              }], { session, ordered: true });

              order.order_status = 'completed';
              orderCompleted = true;
            }
          }
        }

        await order.save({ session });
      }
    } else if (['picked_up', 'assigned', 'in_transit', 'out_for_delivery'].includes(status)) {
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
        type: 'logistics_update',
        metadata: { order_id: order._id, shipment_id: shipment._id, link: `/logistics/manifests?shipmentId=${shipment._id}` },
        sendEmail: true,
        overrideEmail: firm.contact_email,
        emailLink: `${process.env.WEB_CLIENT_URL}/logistics/manifests?shipmentId=${shipment._id}`,
        orderDetails: {
          ...order.toObject(),
          shipment: shipment.toObject(),
          logistics_name: firm.company_name,
        },
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
      const webUrl = process.env.WEB_CLIENT_URL;
      const orderForEmail = {
        ...order.toObject(),
        shipment: shipment.toObject(),
        logistics_name: firm.company_name,
        customer_name: customer.name,
      };
      const statusTpl = templates.shipmentStatusChanged({
        shipment,
        order: orderForEmail,
        recipient: customer,
        status,
        webUrl,
        dashboardLink: `${webUrl}/orders/${order._id}`,
      });
      await sendNotification(req.app, order.customer_id, {
        title:         `Shipment Update: ${status.replace(/_/g, ' ')}`,
        message:       statusTpl.text,
        type:          'order_status',
        metadata:      { shipment_id: shipment._id, order_id: order._id, link: `/orders/${order._id}`, status },
        sendEmail:     true,
        emailTemplate: statusTpl,
        orderDetails:  orderForEmail,
        emailLink:     `${webUrl}/orders/${order._id}`,
        webUrl,
        role:          'customer'
      });
    }

    // If vendor is a separate entity, also notify them
    if (vendor?.user_id?._id) {
      const webUrl = process.env.WEB_CLIENT_URL;
      const orderForEmail = {
        ...order.toObject(),
        shipment: shipment.toObject(),
        logistics_name: firm.company_name,
      };
      const vendorStatusTpl = templates.shipmentStatusChanged({
        shipment,
        order: orderForEmail,
        recipient: vendor.user_id,
        status,
        webUrl,
        dashboardLink: `${webUrl}/vendor/orders?orderId=${order._id}`,
      });
      await sendNotification(req.app, vendor.user_id._id, {
        title:         `Shipment Update: ${status.replace(/_/g, ' ')}`,
        message:       vendorStatusTpl.text,
        type:          'order_status',
        metadata:      { shipment_id: shipment._id, order_id: order._id, link: '/vendor/orders', status },
        sendEmail:     true,
        emailTemplate: vendorStatusTpl,
        orderDetails:  orderForEmail,
        emailLink:     `${webUrl}/vendor/orders?orderId=${order._id}`,
        webUrl,
        role:          'vendor'
      });
    }

    // If escrow released → notify vendor payment
    if (orderCompleted && vendor?.user_id?._id) {
      const completedTpl = templates.orderCompleted({ order, vendor });
      await sendNotification(req.app, vendor.user_id._id, {
        title:         'Order Completed — Payment Released',
        message:       `Payment for Order #${order._id.toString().slice(-6).toUpperCase()} has been released to your wallet.`,
        type:          'payment_received',
        metadata:      { order_id: order._id, link: '/wallet' },
        sendEmail:     true,
        emailTemplate: completedTpl,
        role:          'vendor'
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
    let firm = await LogisticsCompany.findOne({ user_id: req.user._id });
    if (!firm) return res.status(404).json({ success: false, message: 'Logistics profile not found.' });

    // Auto-heal: if the company paid their subscription but is_verified was never set
    // (e.g. paid before the auto-verify fix), set it now so they appear at checkout.
    if (!firm.is_verified) {
      const UserSubscription = require('../models/UserSubscription.model');
      const activeSub = await UserSubscription.findOne({
        user_id: req.user._id,
        role: 'logistics',
        status: 'active',
      });
      if (activeSub) {
        firm = await LogisticsCompany.findByIdAndUpdate(
          firm._id,
          { $set: { is_verified: true } },
          { new: true }
        );
      }
    }

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
  getFirmShipmentById,
  getVendorShipments,
  modifyShipmentStatus,
  getSearchCompatibleFirms,
  getPublicLogisticsFirms,
  getZones,
  getProfile,
  updateProfile,
  updatePricing
};
