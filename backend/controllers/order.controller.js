/**
 * controllers/order.controller.js
 * Auradime — Order Controller
 *
 * Handling the creation of orders, reducing product stock natively, 
 * and routing payment status updates.
 * Full email notification support via Titan SMTP.
 */

const Order          = require('../models/Order.model');
const Product        = require('../models/Product.model');
const Vendor         = require('../models/Vendor.model');
const Store          = require('../models/Store.model');
const RefundRequest  = require('../models/RefundRequest.model');
const Escrow         = require('../models/Escrow.model');
const User           = require('../models/User.model');
const Shipment       = require('../models/Shipment.model');
const Cart           = require('../models/Cart.model');
const Transaction    = require('../models/Transaction.model');
const Coupon         = require('../models/Coupon.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const mongoose       = require('mongoose');
const qrcode         = require('qrcode');

const { sendNotification, notifyAdmins } = require('../utils/notifier');
const { sendEmail }           = require('../utils/emailService');
const { generateInvoice }     = require('../utils/invoiceGenerator');
const { getWebUrl }           = require('../utils/url');
const logisticsService        = require('../services/logistics.service');
const { handleVendorPayout }  = require('../services/payment/settle.service');
const { resolveDelivery, isIntercityEnabled } = require('../services/intercityResolver.service');
const {
  syncShipmentsToOrderStatus,
  getOrderFulfillmentSnapshot,
  notifyOrderStatusChange,
} = require('../services/orderSync.service');
const templates               = require('../utils/emailTemplates');
const { markEscrowDelivered } = require('./escrow.controller');
const { toXAF, assertOrderTotal } = require('../utils/platformFees');

const MOBILE_MONEY_COLLECTION_FEE_XAF = 50;

const normalizeNullableAmount = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const assertMinimumOrderAmount = async (vendorId, subtotal, session) => {
  const store = await Store.findOne({ vendor_id: vendorId }).select('minimum_order_amount').session(session);
  const minimum = normalizeNullableAmount(store?.minimum_order_amount);
  if (minimum !== null && Number(subtotal || 0) < minimum) {
    const vendor = await Vendor.findById(vendorId).select('store_name').session(session);
    throw new Error(`Your order from ${vendor?.store_name || 'this store'} must be at least ${minimum.toLocaleString()} XAF. Please add more items from this store or remove their products to continue.`);
  }
};
const generateTxRef = () => `AURA-COD-${Math.floor(100000 + Math.random() * 900000)}`;
const isVendorManagedShipping = (method) => method === 'vendor_managed' || method === 'self_managed';
const normalizePaymentMethod = (method) => {
  if (method === 'mesomb' || method === 'mobile_money') return 'eversend';
  return method;
};

const variantEntries = (variant) =>
  Object.entries(variant || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');

const variantLabel = (variant) =>
  variantEntries(variant).map(([key, value]) => `${key}: ${value}`).join(' / ');

const findSelectedVariant = (product, selectedVariant) => {
  const entries = variantEntries(selectedVariant);
  if (!product?.has_variants || entries.length === 0) return null;
  return product.sku_variants?.find((variant) =>
    entries.every(([key, value]) => String(variant.combination?.[key] ?? '') === String(value))
  ) || null;
};

const resolveOrderLine = (product, item) => {
  const quantity = Number(item.quantity || 1);
  const regularPrice = Number(product.price || 0);
  
  let itemPrice;
  let salePrice = null;
  let compare_at_price = null;
  let itemImage = product.images?.[0]?.url || null;

  if (product.has_variants) {
    const variantMatch = findSelectedVariant(product, item.variant);
    if (!variantMatch) {
      throw new Error(`Please select a valid variant for ${product.name}.`);
    }
    if (variantMatch.stock < quantity) {
      throw new Error(`Insufficient stock for ${product.name} (${variantLabel(item.variant)}). Available: ${variantMatch.stock}`);
    }
    const variantRegularPrice = Number(variantMatch.price || regularPrice);
    const variantSalePrice = variantMatch.sale_price !== undefined && variantMatch.sale_price !== null 
      ? Number(variantMatch.sale_price) 
      : null;
    
    if (variantSalePrice && variantSalePrice > 0 && variantSalePrice < variantRegularPrice) {
      itemPrice = variantSalePrice;
      salePrice = variantSalePrice;
      compare_at_price = variantRegularPrice;
    } else {
      itemPrice = variantRegularPrice;
    }
    
    if (variantMatch.image) itemImage = variantMatch.image;
  } else {
    const productSalePrice = product.sale_price !== undefined && product.sale_price !== null 
      ? Number(product.sale_price) 
      : null;
    
    if (productSalePrice && productSalePrice > 0 && productSalePrice < regularPrice) {
      itemPrice = productSalePrice;
      salePrice = productSalePrice;
      compare_at_price = regularPrice;
    } else {
      itemPrice = regularPrice;
    }
    
    if (product.stock < quantity) {
      throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
    }
  }

  // Meal option customisation deltas — added to effective price only, not to regularPrice.
  const optionDelta = (item.selected_options || []).reduce(
    (sum, o) => sum + (Number(o.price_delta) || 0), 0
  );
  itemPrice += optionDelta;

  return { quantity, itemPrice, regularPrice, salePrice, compare_at_price, itemImage };
};

const restoreOrderInventory = async (order, session) => {
  for (const item of order.products || []) {
    const product = await Product.findById(item.product_id).session(session);
    if (!product) continue;

    const quantity = Number(item.quantity || 1);
    product.stock = Number(product.stock || 0) + quantity;
    product.purchase_count = Math.max(0, Number(product.purchase_count || 0) - quantity);

    if (product.has_variants && item.variant) {
      const variantMatch = findSelectedVariant(product, item.variant);
      if (variantMatch) {
        variantMatch.stock = Number(variantMatch.stock || 0) + quantity;
        product.markModified('sku_variants');
      }
    }

    await product.save({ session });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/orders
// @desc    Create a new order
// @access  Private (Role: customer)
// ─────────────────────────────────────────────
const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { vendor_id, products, shipping_address, shipping_method, buyer_zone_id } = req.body;
    const payment_method = normalizePaymentMethod(req.body.payment_method);

    if (!products || products.length === 0) {
      return res.status(400).json({ success: false, message: 'No order items provided.' });
    }

    // 1. Verify vendor exists
    const vendor = await Vendor.findById(vendor_id).populate('user_id', 'name email');
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    // Prevent vendors from purchasing from their own store
    if (req.user.role === 'vendor' && vendor.user_id?._id?.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot place an order from your own store. You can only purchase from other vendors.',
      });
    }

    // 2. Calculate Subtotal & Verify Stock atomically
    let subtotal = 0;
    const validatedProducts = [];
    const itemParcelClasses = []; // for intercity oversize check

    for (const item of products) {
      const product = await Product.findById(item.product_id).session(session);
      
      if (!product || product.status !== 'active') {
        throw new Error(`Product ${item.product_id} is unavailable.`);
      }

      const { quantity, itemPrice, regularPrice, salePrice, compare_at_price, itemImage } = resolveOrderLine(product, item);

      if (product.has_variants) {
        const variantMatch = findSelectedVariant(product, item.variant);
        if (variantMatch) {
          variantMatch.stock -= quantity;
        }
      }

      product.stock -= quantity;
      product.purchase_count = (product.purchase_count || 0) + quantity;
      product.markModified('sku_variants');
      await product.save({ session });

      // Low stock alert (in-app only) — suppressed for meal products (stock field unused for food)
      if (!product.meal && product.stock < 5) {
        await sendNotification(req.app, vendor.user_id, {
          title: 'Low Stock Alert',
          message: `Your product "${product.name}" is running low on stock (${product.stock} items left).`,
          type: 'system_alert'
        });
      }

      validatedProducts.push({
        product_id: product._id,
        name:       product.name,
        quantity,
        price:      itemPrice,
        regular_price: regularPrice,
        sale_price: salePrice,
        compare_at_price: compare_at_price,
        image:      itemImage,
        variant:    item.variant,
        selected_options: Array.isArray(item.selected_options) ? item.selected_options : [],
      });
      itemParcelClasses.push({ parcel_class: product.parcel_class || 'small' });

      subtotal += itemPrice * quantity;
    }

    // 3. Handle Coupon Logic
    let discount = 0;
    const { coupon_code } = req.body;
    if (coupon_code) {
      const coupon = await Coupon.findOne({ code: coupon_code.toUpperCase(), is_active: true }).session(session);
      if (coupon && coupon.isValid(subtotal)) {
        if (coupon.discount_type === 'fixed') {
          discount = coupon.discount_value;
        } else {
          discount = (subtotal * coupon.discount_value) / 100;
          if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
            discount = coupon.max_discount_amount;
          }
        }
        coupon.used_count += 1;
        await coupon.save({ session });
      }
    }

    // 4. Assemble full Order
    const {
      logistics_company_id,
      delivery_quartier,
      delivery_description,
      escrow_enabled,
      fulfilment_type,   // 'delivery' | 'pickup' — required for food orders
    } = req.body;

    // Food orders: set escrow_enabled = false (commission taken at capture, not at release)
    // and initialise the kitchen status pipeline.
    const isFoodOrder = vendor.vendor_type === 'restaurant';

    // Validate fulfilment_type for food orders
    const VALID_FULFILMENT_TYPES = ['delivery', 'pickup', 'dine_in', 'pre_order'];
    if (isFoodOrder && fulfilment_type && !VALID_FULFILMENT_TYPES.includes(fulfilment_type)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Invalid fulfilment_type. Must be one of: ${VALID_FULFILMENT_TYPES.join(', ')}`,
      });
    }

    // Step 5b — new-restaurant hold detection.
    // Hold applies if:
    //   a) Restaurant has fewer completed orders than the threshold (initial hold), OR
    //   b) Cancellation-rate monitor auto-flipped cancel_rate_hold (and not admin-overridden)
    let newRestaurantHold = false;
    let ACCEPTANCE_TIMEOUT_MINUTES = 30;
    if (isFoodOrder) {
      const PlatformSettings = require('../models/PlatformSettings.model');
      const platformSettings = await PlatformSettings.getSettings();
      ACCEPTANCE_TIMEOUT_MINUTES = platformSettings.food_acceptance_timeout_minutes ?? 30;
      const holdThreshold = platformSettings.new_restaurant_hold_order_count ?? 5;
      const completedCount = await Order.countDocuments({
        vendor_id: vendor_id,
        food_status: 'delivered',
        payment_status: 'paid',
      }).session(session);
      const belowInitialThreshold = completedCount < holdThreshold;
      const cancelRateHold = vendor.cancel_rate_hold === true && !vendor.cancel_rate_hold_override;
      newRestaurantHold = belowInitialThreshold || cancelRateHold;
    }

    const normalizedShippingMethod = isVendorManagedShipping(shipping_method)
      ? 'vendor_managed'
      : shipping_method === 'intercity_agency'
        ? 'intercity_agency'
        : 'logistics_partner';
    const deliveryZone = delivery_quartier || shipping_address?.quartier;

    if (!deliveryZone) {
      return res.status(400).json({
        success: false,
        message: 'A delivery zone must be selected for this order.'
      });
    }

    if (normalizedShippingMethod === 'logistics_partner' && !logistics_company_id) {
      return res.status(400).json({
        success: false,
        message: 'Select a logistics partner or choose vendor-managed delivery.',
      });
    }

    let shipping_fee = 0;
    if (normalizedShippingMethod === 'logistics_partner' && logistics_company_id && deliveryZone) {
      // Step 9: For food orders, pass the restaurant's city_zone_id so only same-city firms qualify.
      let firmFilterOptions = {};
      if (isFoodOrder) {
        const RestaurantProfile = require('../models/RestaurantProfile.model');
        const rp = await RestaurantProfile.findOne({ vendor_id: vendor_id }).select('city_zone_id').lean();
        if (rp?.city_zone_id) firmFilterOptions.city_zone_id = rp.city_zone_id;
      }

      const firms = await logisticsService.getCompatibleFirms(deliveryZone, [vendor_id], firmFilterOptions);
      const isCompatible = firms.some(f => f._id.toString() === logistics_company_id);
      if (!isCompatible) {
        throw new Error('Selected logistics company does not support this delivery route.');
      }

      const fees = await logisticsService.calculateShipmentFees([vendor_id], deliveryZone, logistics_company_id);
      shipping_fee = fees.totalFee;
    }

    // ── Phase 4: Intercity resolver ──────────────────────────────────────────
    let transit_fee = 0;
    let intercityOrderFields = {};
    if (normalizedShippingMethod === 'intercity_agency') {
      if (!isIntercityEnabled()) {
        return res.status(400).json({ success: false, message: 'Intercity shipping is not currently available.' });
      }
      const [vendorDoc, vendorStore] = await Promise.all([
        Vendor.findById(vendor_id).select('pickup_address').lean().session(session),
        Store.findOne({ vendor_id }).select('free_shipping_threshold').lean(),
      ]);
      const intercityResult = await resolveDelivery({
        vendorZoneId:          vendorDoc?.pickup_address?.zone_id,
        buyerZoneId:           buyer_zone_id,
        buyerQuartier:         deliveryZone,
        vendorId:              vendor_id,
        subtotal,
        freeShippingThreshold: vendorStore?.free_shipping_threshold ?? null,
        items:                 itemParcelClasses,
      });

      if (intercityResult.blocked) {
        const MSG = {
          oversize:         'One or more items cannot be shipped intercity (oversized parcel).',
          route_not_served: 'Intercity delivery is not available for this origin-destination route.',
          origin_unknown:   'Vendor location could not be resolved for intercity shipping.',
          dest_unknown:     'Your delivery location could not be resolved for intercity shipping.',
        };
        throw new Error(MSG[intercityResult.blocked_reason] || 'Intercity shipping is unavailable for this order.');
      }

      // Exposure cap: max 3 concurrent advanced intercity orders per vendor.
      // Prevents a vendor from accumulating more transit advances than they can honour.
      if (!intercityResult.transit_fee_waived && intercityResult.transit_fee > 0) {
        const INTERCITY_ADVANCE_CAP = 3;
        const activeAdvances = await Order.countDocuments({
          vendor_id:       vendor_id,
          shipping_method: 'intercity_agency',
          transit_status:  { $in: ['awaiting_dispatch', 'dispatched'] },
          payment_status:  'paid',
        }).session(session);
        if (activeAdvances >= INTERCITY_ADVANCE_CAP) {
          throw new Error(`This vendor has reached the maximum of ${INTERCITY_ADVANCE_CAP} concurrent intercity shipments. Please wait for existing orders to be delivered before placing another.`);
        }
      }

      transit_fee = intercityResult.transit_fee;
      intercityOrderFields = {
        transit_fee:         transit_fee,
        transit_fee_waived:  intercityResult.transit_fee_waived,
        transit_rate_id:     intercityResult.transit_rate_id,
        transit_carrier:     intercityResult.agency_name,
        pickup_point_id:     intercityResult.pickup_point?._id || null,
        transit_status:      'awaiting_dispatch',
        expected_arrival_at: intercityResult.estimated_transit_hours
          ? new Date(Date.now() + intercityResult.estimated_transit_hours.max * 3600 * 1000)
          : null,
      };
    }
    // ─────────────────────────────────────────────────────────────────────────

    await assertMinimumOrderAmount(vendor_id, subtotal, session);

    const collection_fee = (payment_method === 'payunit' || payment_method === 'eversend') ? MOBILE_MONEY_COLLECTION_FEE_XAF : 0;
    const total_amount = toXAF(subtotal + shipping_fee + transit_fee + collection_fee - discount);
    assertOrderTotal({ subtotal, shipping_fee, collection_fee, discount, total_amount });

    const orderData = {
      customer_id:     req.user._id,
      vendor_id,
      products:        validatedProducts,
      subtotal:        toXAF(subtotal),
      shipping_fee:    toXAF(shipping_fee),
      collection_fee,
      total_amount:    total_amount > 0 ? total_amount : 0,
      payment_method,
      shipping_method: normalizedShippingMethod,
      shipping_address: {
         ...(shipping_address || {}),
         quartier: deliveryZone,
         email:    req.user.email,
         phone:    req.user.phone
      },
      delivery_description,
      logistics_company_id: normalizedShippingMethod === 'logistics_partner' ? logistics_company_id : null,
      payment_status:  'pending',
      order_status:    'placed',
      // Food orders never use escrow — commission is taken at capture via handleVendorPayout direct path
      escrow_enabled:  isFoodOrder ? false : (escrow_enabled !== undefined ? escrow_enabled : false),
      // Intercity fields (spread is empty object for non-intercity orders)
      ...intercityOrderFields,
      // Restaurant-specific fields
      ...(isFoodOrder && {
        fulfilment_type:           fulfilment_type || 'delivery',
        food_status:               'pending_acceptance',
        acceptance_deadline:       new Date(Date.now() + ACCEPTANCE_TIMEOUT_MINUTES * 60 * 1000),
        new_restaurant_hold:       newRestaurantHold,
        dispute_window_closes_at:  new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h from placement
        status_logs: [{
          status:    'pending_acceptance',
          actor_id:  req.user._id,
          timestamp: new Date(),
          note:      'Order placed by customer.',
        }],
      }),
    };

    const [createdOrder] = await Order.create([orderData], { session, ordered: true });

    // For wallet-paid food orders: capture payment immediately at placement
    if (isFoodOrder && payment_method === 'wallet') {
      const buyer = await User.findById(req.user._id).session(session);
      if ((buyer.wallet_balance || 0) < total_amount) {
        throw new Error('Insufficient wallet balance to place this food order.');
      }
      buyer.wallet_balance -= total_amount;
      await buyer.save({ session });

      await Transaction.create([{
        user_id:     buyer._id,
        type:        'payment',
        amount:      total_amount,
        reference:   `FOOD-${Date.now()}`,
        status:      'completed',
        description: `Food order payment — Order #${createdOrder._id.toString().slice(-6).toUpperCase()}`,
        order_id:    createdOrder._id,
      }], { session, ordered: true });

      createdOrder.payment_status = 'paid';
      createdOrder.order_status   = 'processing';
      await createdOrder.save({ session });

      await handleVendorPayout(createdOrder, session);
    }

    // 5. Create shipment for logistics_partner orders (POD or wallet)
    let logisticsCompForNotify = null;
    if (
      normalizedShippingMethod === 'logistics_partner' &&
      logistics_company_id &&
      ['pay_on_delivery', 'wallet'].includes(payment_method)
    ) {
      await logisticsService.createShipmentsForOrder(createdOrder, deliveryZone, logistics_company_id, session);
      logisticsCompForNotify = await LogisticsCompany.findById(logistics_company_id).session(session);
    }

    // 6. Prune from Cart if it exists
    const cart = await Cart.findOne({ user_id: req.user._id }).session(session);
    if (cart) {
      const boughtIds = products.map(p => p.product_id.toString());
      cart.items = cart.items.filter(item => !boughtIds.includes(item.product.toString()));
      await cart.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // 7. Background Notifications (non-blocking)
    if (payment_method === 'pay_on_delivery') {
      setImmediate(async () => {
        try {
          const orderWithVendor = createdOrder.toObject();
          orderWithVendor.vendor_id = vendor;

          // 1. Notify Vendor
          sendNotification(req.app, vendor.user_id, {
            title: 'New Order Received (POD)',
            message: `New Pay-on-Delivery order (#${createdOrder._id.toString().slice(-6).toUpperCase()}) from ${req.user.name}.`,
            type: 'order_status',
            metadata: { order_id: createdOrder._id, link: '/vendor/orders' },
            sendEmail: true,
            emailLink: `${process.env.WEB_CLIENT_URL}/vendor/orders`,
            orderDetails: orderWithVendor,
            role: 'vendor'
          });

          // 2. Notify Customer
          const trackingLink = `${process.env.WEB_CLIENT_URL}/orders/${createdOrder._id}`;
          const qrCodeDataUrl = await qrcode.toDataURL(trackingLink);
          
          const customerEmailTemplate = templates.orderPlaced({ 
            order: createdOrder, 
            customer: req.user,
            qrCode: qrCodeDataUrl 
          });

          sendNotification(req.app, req.user._id, {
            title: customerEmailTemplate.subject,
            message: `Your Order #${createdOrder._id.toString().slice(-6).toUpperCase()} has been successfully recorded.`,
            type: 'order_status',
            metadata: { order_id: createdOrder._id, link: `/orders/${createdOrder._id}` },
            sendEmail: true,
            emailLink: trackingLink,
            emailTemplate: customerEmailTemplate,
            orderDetails: orderWithVendor,
            qrCode: qrCodeDataUrl,
            role: 'customer'
          });

          // 3. Notify Logistics Partner if applicable
          if (logisticsCompForNotify) {
            sendNotification(req.app, logisticsCompForNotify.user_id, {
              title: 'New Shipment Assigned (POD)',
              message: `You have new delivery work for Order #${createdOrder._id.toString().slice(-6).toUpperCase()}.`,
              type: 'logistics_update',
              metadata: { order_id: createdOrder._id, link: '/logistics/manifests' },
              sendEmail: true,
              overrideEmail: logisticsCompForNotify.contact_email,
              emailLink: `${process.env.WEB_CLIENT_URL}/logistics/manifests`,
              orderDetails: orderWithVendor,
              role: 'logistics'
            });
          }

          // 4. Notify Admins — POD orders don't go through settle.service.js so admins
          //    would otherwise never hear about them until the dashboard is refreshed.
          notifyAdmins(req.app, {
            title:   'New POD Order',
            message: `Order #${createdOrder._id.toString().slice(-6).toUpperCase()} — Pay-on-Delivery — placed by ${req.user.name} (${Number(createdOrder.total_amount || 0).toLocaleString()} XAF) at ${vendor.store_name || 'unknown store'}.`,
            type:    'order_status',
            metadata: { order_id: createdOrder._id, link: `/admin/orders/${createdOrder._id}` },
            orderDetails: orderWithVendor,
          }).catch(console.error);
        } catch (bgErr) {
          console.error('Order notification bg error:', bgErr);
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully.',
      data:    { order: createdOrder },
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// ... Rest of the controllers (Customer/Vendor pulls, Invoice, Status update, Refund logic)

const payDirectly = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const order = await Order.findById(id).session(session);
    if (!order) throw new Error('Order not found.');
    if (order.customer_id.toString() !== req.user._id.toString()) throw new Error('Not authorized.');
    if (order.payment_status !== 'pending') throw new Error('Payment already received.');

    const user = await User.findById(req.user._id).session(session);
    if (user.wallet_balance < order.total_amount) throw new Error('Insufficient wallet balance.');

    // Deduct from buyer
    user.wallet_balance -= order.total_amount;
    await user.save({ session });

    // Log buyer payment transaction
    await Transaction.create([{
      user_id:     user._id,
      type:        'payment',
      amount:      order.total_amount,
      reference:   `DIRECT-${Date.now()}`,
      status:      'completed',
      description: `Direct Payment for Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order_id:    order._id
    }], { session, ordered: true });

    order.payment_status = 'paid';
    order.order_status   = 'processing';
    await order.save({ session });

    // Route through settle.service so commission, platform balance, and escrow path
    // are handled identically to every other payment method (BUG-02 fix).
    await handleVendorPayout(order, session);

    // Clear cart upon successful direct payment
    const cart = await Cart.findOne({ user_id: req.user._id }).session(session);
    if (cart) {
      cart.items = [];
      await cart.save({ session });
    }

    // ── AUTOMATIC LOGISTICS SHIPMENT TRIGGER ──
    let logisticsNotification = null;
    if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
        const quartier = order.shipping_address?.quartier;
        // BREAK-02/05 fix: guard against duplicate shipment on payment retry
        const existingShipment = await Shipment.findOne({ order_id: order._id }).session(session);
        if (!existingShipment && quartier) {
          await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
        }

        const logisticsComp = await LogisticsCompany.findById(order.logistics_company_id).session(session);
        if (logisticsComp) {
          const v = await Vendor.findById(order.vendor_id).session(session);
          logisticsNotification = {
            recipientId: logisticsComp.user_id,
            data: {
              title: 'New Shipment Assigned',
              message: `You have new delivery work for Order #${order._id.toString().slice(-6).toUpperCase()}.`,
              type: 'logistics_update',
              metadata: { order_id: order._id, link: '/logistics/manifests' },
              sendEmail: true,
              overrideEmail: logisticsComp.contact_email,
              emailLink: `${process.env.WEB_CLIENT_URL}/logistics/manifests`,
              orderDetails: { ...order.toObject(), vendor_id: v },
              role: 'logistics'
            }
          };
        }
    }

    await session.commitTransaction();
    session.endSession();

    // BACKGROUND DISPATCH
    if (logisticsNotification) {
      sendNotification(req.app, logisticsNotification.recipientId, logisticsNotification.data);
    }

    res.status(200).json({ success: true, message: 'Direct payment executed successfully.' });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getCustomerOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ 
      customer_id: req.user._id,
      $or: [
        { payment_status: 'paid' },
        { payment_status: 'pending' },
        { payment_status: 'failed' },
        { payment_status: 'refunded' },
        { order_status: { $in: ['cancelled', 'refunded', 'refund_pending'] } },
        { payment_method: 'pay_on_delivery' }
      ]
    })
      .populate({
        path: 'vendor_id',
        select: 'store_name user_id',
        populate: {
          path: 'user_id',
          select: 'name avatar branding'
        }
      })
      .populate('shipment', 'status tracking_code')
      .sort('-createdAt');
    res.status(200).json({ success: true, count: orders.length, data: { orders } });
  } catch (error) { next(error); }
};

const getVendorOrders = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    const skip  = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ vendor_id: req.vendor._id })
        .select('order_status food_status payment_status total_amount createdAt customer_id products vendor_id shipment logistics_company_id shipping_method shipping_address special_instructions status_logs')
        .populate('customer_id', 'name email phone avatar')
        .populate('products.product_id', 'name price images')
        .populate({
          path: 'vendor_id',
          select: 'store_name user_id',
          populate: { path: 'user_id', select: 'name avatar branding' }
        })
        .populate('shipment', 'status tracking_code')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ vendor_id: req.vendor._id })
    ]);

    res.status(200).json({
      success: true,
      count: orders.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: { orders }
    });
  } catch (error) { next(error); }
};


const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer_id', 'name email phone')
      .populate({
        path: 'vendor_id',
        select: 'store_name user_id name',
        populate: {
          path: 'user_id',
          select: 'name avatar branding'
        }
      })
      .populate({
        path: 'products.product_id',
        select: 'name images vendor_id',
        populate: {
          path: 'vendor_id',
          select: 'store_name user_id branding name'
        }
      });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const shipments = await Shipment.find({ order_id: order._id })
      .populate('logistics_id', 'company_name contact_phone')
      .populate({
        path: 'vendor_id',
        select: 'store_name user_id',
        populate: {
          path: 'user_id',
          select: 'name avatar branding'
        }
      });

    const escrow = await Escrow.findOne({ order_id: order._id }).select('status vendor_confirmed customer_confirmed delivered_at auto_release_at release_date');

    res.status(200).json({ success: true, data: { order, shipments, escrow } });
  } catch (error) { next(error); }
};

const updateOrderStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { order_status, tracking_number } = req.body;
    const order = await Order.findById(req.params.id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // ── SELLER GUARD ─────────────────────────────────────────────────────────
    // Only the vendor who SOLD this order can update its status.
    // A vendor who BOUGHT from another store is acting as a customer and must
    // use the customer cancel/refund routes — not this seller endpoint.
    if (req.user.role === 'vendor') {
      const sellerVendorId = order.vendor_id?.toString();
      const requestingVendorId = req.vendor?._id?.toString();
      if (!sellerVendorId || sellerVendorId !== requestingVendorId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          success: false,
          message: 'You are not the seller for this order. Use the customer orders section to manage orders you have placed.',
        });
      }
    }

    // Applies to every logistics-backed order (single checkout or cart-split / "group" orders are separate Order docs each).
    const orderUsesLogistics =
      order.shipping_method === 'logistics_partner' || !!order.logistics_company_id;

    if (order_status && order.order_status === order_status) {
      await session.abortTransaction();
      session.endSession();
      const snapshot = await getOrderFulfillmentSnapshot(order._id);
      return res.status(200).json({
        success: true,
        message: 'Order already has this status.',
        data: { order: snapshot.order, shipments: snapshot.shipments, escrow: snapshot.escrow },
      });
    }

    if (req.user.role === 'vendor' && orderUsesLogistics) {
      const Shipment = require('../models/Shipment.model');
      const activeShipment = await Shipment.findOne({ 
        order_id: order._id, 
        status: { $in: ['picked_up', 'in_transit', 'delivered'] } 
      }).session(session);

      // A. If courier already launched (picked up), vendor is locked out of shipment controls
      if (activeShipment) {
        if (['shipped', 'delivered', 'cancelled'].includes(order_status)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(403).json({
            success: false,
            message: 'Carrier has already launched this shipment. Vendor intervention is blocked.'
          });
        }
      }

      // B. If vendor launches (marks as shipped) BEFORE the courier, they take over authority
      if (order_status === 'shipped') {
        // ── PROTECTIVE DELAY: Give courier 6 hours to react ──
        const anyShipment = await Shipment.findOne({ order_id: order._id }).session(session);
        const startTime = anyShipment?.createdAt || order.createdAt;
        const hoursElapsed = (new Date() - new Date(startTime)) / (1000 * 60 * 60);

        if (hoursElapsed < 6) {
          await session.abortTransaction();
          session.endSession();
          const remaining = Math.ceil(6 - hoursElapsed);
          return res.status(403).json({
            success: false,
            message: `Exclusive Logistics Window: Please wait ${remaining} hour(s) before manual takeover. Logistics partners have priority for 6 hours after assignment.`
          });
        }

        // Mark pending shipments as cancelled so courier dashboard is cleared
        await Shipment.updateMany(
          { order_id: order._id, status: { $in: ['pending', 'assigned'] } },
          { 
            $set: { status: 'cancelled' },
            $push: { 
              shipment_logs: {
                status: 'cancelled',
                updated_by: req.user._id,
                timestamp: new Date(),
                note: 'Vendor has launched this shipment manually. Logistics authority revoked.'
              }
            }
          }
        ).session(session);

        // Convert to vendor managed so vendor receives the full shipping fee payout
        order.shipping_method = 'vendor_managed';
        console.log(`🚚 Vendor launched shipment for Order #${order._id}. Logistics partner locked out.`);
      }
    }

    if (order_status) order.order_status = order_status;
    if (tracking_number) order.tracking_number = tracking_number;

    if (order_status === 'delivered') {
      const escrow = await Escrow.findOne({ order_id: order._id, status: { $in: ['held', 'pending_release'] } }).session(session);
      if (escrow) {
        escrow.vendor_confirmed = true;
        markEscrowDelivered(escrow);
        await escrow.save({ session });
      }
    }

    await order.save({ session });

    // ── SYNC: Align shipment tickets with order status everywhere ──
    if (order_status) {
      await syncShipmentsToOrderStatus(order, order_status, {
        session,
        updatedBy: req.user._id,
        note: `Order status updated to ${order_status} by ${req.user.role}.`,
      });
      if (order_status === 'shipped') {
        await Shipment.updateMany(
          { order_id: order._id },
          {
            $push: {
              shipment_logs: {
                status: 'shipped',
                updated_by: req.user._id,
                timestamp: new Date(),
                note: 'Vendor marked the product as shipped.',
              },
            },
          },
          { session }
        );
      }
    }

    // ── NOTE: Fund release is handled either by logistics.controller (on delivery) 
    // or by escrow.controller (on customer confirmation). We do not auto-release 
    // here to prevent vendors from bypassing customer confirmation. ──

    await session.commitTransaction();
    session.endSession();

    // Notify Customer about status
    const customer = await User.findById(order.customer_id);
    const trackingLink = `${process.env.WEB_CLIENT_URL}/orders/${order._id}`;
    const qrCodeDataUrl = await qrcode.toDataURL(trackingLink);
    
    const customerEmailTemplate = templates.orderStatusUpdated({ 
      order, 
      customer, 
      qrCode: qrCodeDataUrl 
    });

    sendNotification(req.app, order.customer_id, {
      title: customerEmailTemplate.subject,
      message: `Your Order #${order._id.toString().slice(-6).toUpperCase()} status is now ${order_status || 'updated'}.`,
      type: 'order_status',
      metadata: { order_id: order._id, link: `/orders/${order._id}` },
      sendEmail: true,
      emailTemplate: customerEmailTemplate,
      emailLink: trackingLink,
      qrCode: qrCodeDataUrl,
      orderDetails: order.toObject()
    });

    notifyOrderStatusChange(req.app, order, order_status, {
      roles: ['vendor'],
      vendorMessage: `Order #${order._id.toString().slice(-6).toUpperCase()} is now ${(order_status || 'updated').replace(/_/g, ' ')}.`,
    });

    const snapshot = await getOrderFulfillmentSnapshot(order._id);
    res.status(200).json({
      success: true,
      message: 'Order status updated.',
      data: { order: snapshot.order, shipments: snapshot.shipments, escrow: snapshot.escrow },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason = 'Customer cancelled order.' } = req.body || {};
    const order = await Order.findById(req.params.id).session(session);
    if (!order) throw new Error('Order not found.');
    if (order.customer_id.toString() !== req.user._id.toString()) {
      throw new Error('You can only cancel your own order.');
    }
    if (['cancelled', 'refunded', 'completed', 'delivered'].includes(order.order_status)) {
      throw new Error(`Order is already ${order.order_status}.`);
    }
    if (['shipped', 'delivered', 'completed'].includes(order.order_status)) {
      throw new Error('This order has already moved into fulfilment and cannot be cancelled here.');
    }

    // Food orders: customer can only cancel before the restaurant accepts.
    // Once food_status moves past 'pending_acceptance' the kitchen is already working.
    if (order.food_status && order.food_status !== 'pending_acceptance') {
      throw new Error('Food orders can only be cancelled before the restaurant accepts. Please open a dispute instead.');
    }

    const paidCancellation = order.payment_status === 'paid';
    const pendingCancellation = order.payment_status === 'pending';
    if (!paidCancellation && !pendingCancellation) {
      throw new Error(`Cannot cancel an order with payment status ${order.payment_status}.`);
    }

    // Non-food paid orders: honour a 30-minute grace window.
    // Food orders skip this check — the food_status guard above is the only gate.
    if (paidCancellation && !order.food_status) {
      const ageMs = Date.now() - new Date(order.createdAt).getTime();
      const thirtyMinutesMs = 30 * 60 * 1000;
      if (ageMs > thirtyMinutesMs) {
        throw new Error('Paid orders can only be cancelled within 30 minutes of checkout.');
      }
    }

    // Block cancellation as soon as a logistics carrier has been assigned (any status).
    // Once a Shipment ticket exists, the order is in the carrier's hands.
    const anyShipment = await Shipment.findOne({ order_id: order._id }).session(session);
    if (anyShipment) {
      throw new Error('A logistics carrier has been assigned to this order. Please open a dispute or contact support.');
    }

    await restoreOrderInventory(order, session);

    const escrow = await Escrow.findOne({ order_id: order._id }).session(session);
    if (escrow && ['held', 'pending_release'].includes(escrow.status)) {
      escrow.status = 'refunded';
      escrow.refund_reason = reason;
      await escrow.save({ session });
    }

    const cancelledAt = new Date();

    const pendingPayoutFilter = { order_id: order._id, type: 'payout', status: 'pending' };
    await Transaction.updateMany(
      { ...pendingPayoutFilter, metadata: null },
      { $set: { metadata: {} } },
      { session }
    );
    await Transaction.updateMany(
      pendingPayoutFilter,
      {
        $set: {
          status: 'rejected',
          'metadata.cancelled_at': cancelledAt,
          'metadata.cancel_reason': reason,
        },
      },
      { session }
    );

    if (paidCancellation) {
      await User.findByIdAndUpdate(
        order.customer_id,
        { $inc: { wallet_balance: Number(order.total_amount || 0) } },
        { session }
      );

      await Transaction.create([{
        user_id: order.customer_id,
        type: 'refund',
        amount: Number(order.total_amount || 0),
        reference: `REF-CANCEL-${Date.now()}-${order._id.toString().slice(-6).toUpperCase()}`,
        status: 'completed',
        gateway: 'wallet',
        description: `30-minute cancellation refund for Order #${order._id.toString().slice(-6).toUpperCase()}`,
        order_id: order._id,
        metadata: {
          cancellation_reason: reason,
          refunded_to: 'customer_wallet',
        },
      }], { session, ordered: true });
    }

    order.order_status = paidCancellation ? 'refunded' : 'cancelled';
    order.payment_status = paidCancellation ? 'refunded' : 'failed';
    await order.save({ session });

    await syncShipmentsToOrderStatus(order, order.order_status, {
      session,
      updatedBy: req.user._id,
      note: reason,
    });

    const pendingCheckoutFilter = {
      user_id: order.customer_id,
      order_ids: order._id,
      gateway: 'eversend',
      status: 'pending',
    };
    await Transaction.updateMany(
      { ...pendingCheckoutFilter, metadata: null },
      { $set: { metadata: {} } },
      { session }
    );
    await Transaction.updateMany(
      pendingCheckoutFilter,
      {
        $set: {
          status: 'rejected',
          'metadata.cancelled_at': cancelledAt,
          'metadata.cancel_reason': reason,
        },
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    setImmediate(async () => {
      // Notify customer
      sendNotification(req.app, order.customer_id, {
        title: paidCancellation ? 'Order Cancelled & Refunded' : 'Order Cancelled',
        message: paidCancellation
          ? `${Number(order.total_amount || 0).toLocaleString()} XAF has been returned to your wallet.`
          : `Order #${order._id.toString().slice(-6).toUpperCase()} was cancelled before payment.`,
        type: 'order_status',
        metadata: { order_id: order._id, link: `/orders/${order._id}` },
        sendEmail: true,
        emailLink: `${process.env.WEB_CLIENT_URL}/orders/${order._id}`,
        role: 'customer',
      }).catch(console.error);

      // Notify restaurant vendor if this is a food order that was still pending acceptance
      if (order.food_status && order.vendor_id) {
        try {
          const Vendor = require('../models/Vendor.model');
          const vendor = await Vendor.findById(order.vendor_id).select('user_id').lean();
          if (vendor) {
            await sendNotification(req.app, vendor.user_id, {
              title:   'Order Cancelled by Customer',
              message: `Order #${order._id.toString().slice(-6).toUpperCase()} was cancelled by the customer${paidCancellation ? ' (refunded)' : ''}. It has been removed from your queue.`,
              type:    'order_status',
              metadata: { order_id: order._id, link: `/vendor/orders/${order._id}` },
            });
          }
        } catch (_) {}
      }
    });

    const snapshot = await getOrderFulfillmentSnapshot(order._id);
    res.status(200).json({
      success: true,
      message: paidCancellation ? 'Order cancelled and refunded to wallet.' : 'Order cancelled.',
      data: { order: snapshot.order, shipments: snapshot.shipments, escrow: snapshot.escrow },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message });
  }
};

const requestRefund = async (req, res, next) => {
  try {
    const { reason, evidence_urls } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    await RefundRequest.create({
      order_id: order._id,
      customer_id: req.user._id,
      vendor_id: order.vendor_id,
      reason,
      evidence_urls
    });

    order.order_status = 'refund_pending';
    await order.save();

    const vendor = await Vendor.findById(order.vendor_id);
    const vendorEmailTemplate = templates.refundRequested({ 
      order, 
      vendor, 
      reason 
    });

    sendNotification(req.app, vendor.user_id, {
      title: vendorEmailTemplate.subject,
      message: `A refund has been requested for Order #${order._id.toString().slice(-6)}.`,
      type: 'system_alert',
      metadata: { order_id: order._id, link: '/vendor/orders' },
      sendEmail: true,
      emailTemplate: vendorEmailTemplate,
      emailLink: `${process.env.WEB_CLIENT_URL}/vendor/orders`,
      role: 'vendor'
    });

    res.status(200).json({ success: true, message: 'Refund request submitted.', data: { order } });
  } catch (error) { next(error); }
};

const approveRefund = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) throw new Error('Order not found.');

    // Seller guard: only the vendor who sold this order can approve refunds
    if (req.vendor && order.vendor_id?.toString() !== req.vendor._id?.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You are not the seller for this order and cannot approve its refund.',
      });
    }

    await RefundRequest.findOneAndUpdate({ order_id: order._id, status: 'pending' }, { status: 'approved' }, { session });

    const escrow = await Escrow.findOne({ order_id: order._id }).session(session);
    if (escrow && escrow.status === 'held') {
      // Refund the full order.total_amount (what the buyer actually paid), not just escrow.amount
      // (escrow.amount is the vendor base portion only and excludes shipping + collection fees).
      const refundAmount = order.total_amount || escrow.amount;
      await User.findByIdAndUpdate(order.customer_id, { $inc: { wallet_balance: refundAmount } }, { session });
      escrow.status = 'refunded';
      await escrow.save({ session });
    }

    order.order_status = 'refunded';
    order.payment_status = 'refunded';
    await order.save({ session });

    await syncShipmentsToOrderStatus(order, 'refunded', {
      session,
      updatedBy: req.user._id,
      note: 'Refund approved; shipments cancelled.',
    });

    await session.commitTransaction();
    session.endSession();

    const customer = await User.findById(order.customer_id);
    const customerEmailTemplate = templates.refundApproved({ order, customer });

    sendNotification(req.app, order.customer_id, {
      title: customerEmailTemplate.subject,
      message: `Your refund for Order #${order._id.toString().slice(-6)} has been approved.`,
      type: 'wallet_update',
      metadata: { order_id: order._id, link: `/orders/${order._id}` },
      sendEmail: true,
      emailTemplate: customerEmailTemplate,
      emailLink: `${process.env.WEB_CLIENT_URL}/orders/${order._id}`,
      role: 'customer'
    });

    res.status(200).json({ success: true, message: 'Refund approved.' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

const getInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer_id', 'name email phone')
      .populate('vendor_id', 'store_name');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    generateInvoice(order, (pdfBuffer) => {
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${order._id}.pdf`,
        'Content-Length': pdfBuffer.length,
        'Cache-Control': 'private, no-store',
      });
      res.send(pdfBuffer);
    });
  } catch (error) { next(error); }
};

const createOrdersFromCart = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let itemsForProcessing = [];
    
    // Support direct items passing for "Buy Now" (bypasses cart DB)
    if (req.body.items && Array.isArray(req.body.items)) {
       // Manual population of product info for each passed item
       for (const item of req.body.items) {
          const product = await Product.findById(item.product_id).session(session);
          if (!product) throw new Error(`Product ${item.product_id} not found.`);
          itemsForProcessing.push({ ...item, product });
       }
    } else {
       const cart = await Cart.findOne({ user_id: req.user._id }).populate('items.product').session(session);
       if (!cart || cart.items.length === 0) throw new Error('Cart is empty.');
       itemsForProcessing = cart.items;
    }

    const itemsByVendor = {};
    for (const item of itemsForProcessing) {
      if (!item.product) continue;
      const vId = item.product.vendor_id.toString();
      if (!itemsByVendor[vId]) itemsByVendor[vId] = [];
      itemsByVendor[vId].push(item);
    }

    // If the buyer is a vendor, remove any items from their own store
    if (req.user.role === 'vendor') {
      const ownVendor = await Vendor.findOne({ user_id: req.user._id }).select('_id').lean();
      if (ownVendor) {
        delete itemsByVendor[ownVendor._id.toString()];
      }
    }

    if (Object.keys(itemsByVendor).length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'You cannot place an order from your own store. Please remove your own products from the cart.',
      });
    }

    const createdOrderIds = [];
    const {
      shipping_address,
      payment_method: rawPaymentMethod,
      shipping_method,
      logistics_company_id,
      delivery_quartier,
      delivery_description,
      escrow_enabled,
      fulfilment_type,
      buyer_zone_id,
    } = req.body;
    // Read timeout from PlatformSettings — will be resolved per-vendor below; default 10 min
    let ACCEPTANCE_TIMEOUT_MINUTES_CART = 30;
    const payment_method = normalizePaymentMethod(rawPaymentMethod);

    // Validate fulfilment_type for cart food orders
    const VALID_FULFILMENT_TYPES_CART = ['delivery', 'pickup', 'dine_in', 'pre_order'];
    const cartHasFoodItems = itemsForProcessing.some(it => it.product?.meal);
    if (cartHasFoodItems && fulfilment_type && !VALID_FULFILMENT_TYPES_CART.includes(fulfilment_type)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Invalid fulfilment_type. Must be one of: ${VALID_FULFILMENT_TYPES_CART.join(', ')}`,
      });
    }

    const normalizedShippingMethod = isVendorManagedShipping(shipping_method)
      ? 'vendor_managed'
      : shipping_method === 'intercity_agency'
        ? 'intercity_agency'
        : 'logistics_partner';
    const deliveryZone = delivery_quartier || shipping_address?.quartier;

    // A delivery zone is required unless ALL items are food on a pickup/dine-in mode
    // (those orders are fulfilled at the restaurant — no address needed).
    const allFoodPickupOrDineIn =
      (fulfilment_type === 'pickup' || fulfilment_type === 'dine_in') &&
      itemsForProcessing.every(it => !!(it.product?.meal));

    if (!allFoodPickupOrDineIn && !deliveryZone) {
       throw new Error('A delivery zone must be selected.');
    }

    if (!allFoodPickupOrDineIn && normalizedShippingMethod === 'logistics_partner' && !logistics_company_id) {
       throw new Error('Select a logistics partner or choose vendor-managed delivery.');
    }

    // ── Step 6: Food cart revalidation ───────────────────────────────────────────
    // Food carts can go stale between item addition and checkout. Validate before
    // taking payment — a restaurant can close or pull a dish at any time.
    const RestaurantProfile = require('../models/RestaurantProfile.model');
    for (const [vendorId, items] of Object.entries(itemsByVendor)) {
      const hasMeal = items.some(it => it.product?.meal);
      if (!hasMeal) continue;

      const rProfile = await RestaurantProfile.findOne({ vendor_id: vendorId })
        .select('is_accepting_orders opening_hours')
        .lean();
      if (!rProfile || !rProfile.is_accepting_orders) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          success: false,
          code: 'RESTAURANT_CLOSED',
          message: 'The restaurant is not accepting orders right now. Please try again later.',
        });
      }
      // Enforce time-based opening hours
      const { computeOpenStatus } = require('./restaurant.controller');
      const { open_status } = computeOpenStatus(rProfile.opening_hours);
      if (open_status !== 'open') {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          success: false,
          code: 'RESTAURANT_CLOSED',
          message: 'This restaurant is currently closed. Please check their opening hours and try again.',
        });
      }

      for (const it of items) {
        if (!it.product?.meal) continue;
        if (it.product.meal.is_available_today === false) {
          await session.abortTransaction();
          session.endSession();
          return res.status(409).json({
            success: false,
            code: 'MEAL_UNAVAILABLE',
            message: `"${it.product.name}" is not available today. Please remove it from your cart.`,
            data: { product_id: it.product._id },
          });
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    for (const [vendorId, items] of Object.entries(itemsByVendor)) {
      // Detect food order per vendor (cart can span multiple vendors, each gets own order)
      const cartVendor = await Vendor.findById(vendorId).select('vendor_type cancel_rate_hold cancel_rate_hold_override').lean().session(session);
      const isFoodOrderCart = cartVendor?.vendor_type === 'restaurant';

      // Step 5b — new-restaurant hold detection (per vendor in cart)
      // Hold applies if below initial order threshold OR cancel_rate_hold is active.
      let cartNewRestaurantHold = false;
      if (isFoodOrderCart) {
        const PlatformSettings = require('../models/PlatformSettings.model');
        const ps = await PlatformSettings.getSettings();
        ACCEPTANCE_TIMEOUT_MINUTES_CART = ps.food_acceptance_timeout_minutes ?? 30;
        const holdThreshold = ps.new_restaurant_hold_order_count ?? 5;
        const completedCount = await Order.countDocuments({
          vendor_id: vendorId,
          food_status: 'delivered',
          payment_status: 'paid',
        }).session(session);
        const belowInitialThresholdCart = completedCount < holdThreshold;
        const cancelRateHoldCart = cartVendor?.cancel_rate_hold === true && !cartVendor?.cancel_rate_hold_override;
        cartNewRestaurantHold = belowInitialThresholdCart || cancelRateHoldCart;
      }

      let subtotal = 0;
      const cartItemParcelClasses = [];
      const orderProducts = items.map(it => {
        const { quantity, itemPrice, regularPrice, salePrice, compare_at_price, itemImage } = resolveOrderLine(it.product, it);

        subtotal += itemPrice * quantity;
        cartItemParcelClasses.push({ parcel_class: it.product?.parcel_class || 'small' });
        return {
          product_id: it.product._id,
          name: it.product.name,
          quantity,
          price: itemPrice,
          regular_price: regularPrice,
          sale_price: salePrice,
          compare_at_price: compare_at_price,
          image: itemImage,
          variant: it.variant,
          selected_options: Array.isArray(it.selected_options) ? it.selected_options : [],
        };
      });

      for (const it of items) {
        // Re-fetch product within the session so stock is current (prevents negative stock on concurrent orders)
        const p = await Product.findById(it.product._id).session(session);
        if (p) {
          const quantity = Number(it.quantity || 1);
          if (p.has_variants) {
            const vMatch = findSelectedVariant(p, it.variant);
            if (!vMatch) throw new Error(`Please select a valid variant for ${p.name}.`);
            if (vMatch.stock < quantity) {
              throw new Error(`Insufficient stock for ${p.name} (${variantLabel(it.variant)}). Available: ${vMatch.stock}`);
            }
            vMatch.stock -= quantity;
            p.markModified('sku_variants');
          } else if (p.stock < quantity) {
            throw new Error(`Insufficient stock for ${p.name}. Available: ${p.stock}`);
          }
          p.stock -= quantity;
          p.purchase_count = (p.purchase_count || 0) + quantity;
          await p.save({ session });
        }
      }

      let shippingFee = 0;
      if (normalizedShippingMethod === 'logistics_partner' && logistics_company_id && deliveryZone) {
          // BREAK-01 fix: verify the firm actually serves this vendor+zone combination
          // before calculating fees. Single-vendor createOrder already does this.
          // Step 9: For food orders, also restrict to same-city firms.
          let cartFirmOptions = {};
          if (isFoodOrderCart) {
            const RestaurantProfile = require('../models/RestaurantProfile.model');
            const rp = await RestaurantProfile.findOne({ vendor_id: vendorId }).select('city_zone_id').lean();
            if (rp?.city_zone_id) cartFirmOptions.city_zone_id = rp.city_zone_id;
          }

          const compatibleFirms = await logisticsService.getCompatibleFirms(deliveryZone, [vendorId], cartFirmOptions);
          const isCompatible = compatibleFirms.some(f => f._id.toString() === logistics_company_id.toString());
          if (!isCompatible) {
            throw new Error('The selected logistics company does not support this delivery route. Please return to checkout and choose another carrier.');
          }
          const fees = await logisticsService.calculateShipmentFees([vendorId], deliveryZone, logistics_company_id);
          shippingFee = fees.totalFee;
      }

      // ── Phase 4: Intercity resolver (per vendor) ──────────────────────────
      let cartTransitFee = 0;
      let cartIntercityFields = {};
      if (normalizedShippingMethod === 'intercity_agency') {
        if (!isIntercityEnabled()) {
          throw new Error('Intercity shipping is not currently available.');
        }
        const [cartVendorDoc, cartVendorStore] = await Promise.all([
          Vendor.findById(vendorId).select('pickup_address').lean().session(session),
          Store.findOne({ vendor_id: vendorId }).select('free_shipping_threshold').lean(),
        ]);
        const cartIntercityResult = await resolveDelivery({
          vendorZoneId:          cartVendorDoc?.pickup_address?.zone_id,
          buyerZoneId:           buyer_zone_id,
          buyerQuartier:         deliveryZone,
          vendorId,
          subtotal,
          freeShippingThreshold: cartVendorStore?.free_shipping_threshold ?? null,
          items:                 cartItemParcelClasses,
        });

        if (cartIntercityResult.blocked) {
          const MSG = {
            oversize:         'One or more items cannot be shipped intercity (oversized parcel).',
            route_not_served: 'Intercity delivery is not available for this origin-destination route.',
            origin_unknown:   'Vendor location could not be resolved for intercity shipping.',
            dest_unknown:     'Your delivery location could not be resolved for intercity shipping.',
          };
          throw new Error(MSG[cartIntercityResult.blocked_reason] || 'Intercity shipping is unavailable for this order.');
        }

        // Exposure cap: max 3 concurrent advanced intercity orders per vendor.
        if (!cartIntercityResult.transit_fee_waived && cartIntercityResult.transit_fee > 0) {
          const INTERCITY_ADVANCE_CAP = 3;
          const activeAdvances = await Order.countDocuments({
            vendor_id:       vendorId,
            shipping_method: 'intercity_agency',
            transit_status:  { $in: ['awaiting_dispatch', 'dispatched'] },
            payment_status:  'paid',
          }).session(session);
          if (activeAdvances >= INTERCITY_ADVANCE_CAP) {
            throw new Error(`This vendor has reached the maximum of ${INTERCITY_ADVANCE_CAP} concurrent intercity shipments. Please wait for existing orders to be delivered before placing another.`);
          }
        }

        cartTransitFee = cartIntercityResult.transit_fee;
        cartIntercityFields = {
          transit_fee:         cartTransitFee,
          transit_fee_waived:  cartIntercityResult.transit_fee_waived,
          transit_rate_id:     cartIntercityResult.transit_rate_id,
          transit_carrier:     cartIntercityResult.agency_name,
          pickup_point_id:     cartIntercityResult.pickup_point?._id || null,
          transit_status:      'awaiting_dispatch',
          expected_arrival_at: cartIntercityResult.estimated_transit_hours
            ? new Date(Date.now() + cartIntercityResult.estimated_transit_hours.max * 3600 * 1000)
            : null,
        };
      }
      // ─────────────────────────────────────────────────────────────────────

      await assertMinimumOrderAmount(vendorId, subtotal, session);

      const collectionFee = (payment_method === 'payunit' || payment_method === 'eversend') ? MOBILE_MONEY_COLLECTION_FEE_XAF : 0;
      const orderTotal = toXAF(subtotal + shippingFee + cartTransitFee + collectionFee);
      assertOrderTotal({ subtotal, shipping_fee: shippingFee, collection_fee: collectionFee, total_amount: orderTotal });

      const [newOrder] = await Order.create([{
        customer_id: req.user._id,
        vendor_id: vendorId,
        products: orderProducts,
        subtotal:        toXAF(subtotal),
        shipping_fee:    toXAF(shippingFee),
        collection_fee: collectionFee,
        total_amount: orderTotal,
        payment_method,
        shipping_method: normalizedShippingMethod,
        logistics_company_id: normalizedShippingMethod === 'logistics_partner' ? logistics_company_id : null,
        shipping_address: { ...shipping_address, quartier: deliveryZone, email: req.user.email, phone: req.user.phone },
        delivery_description,
        payment_status: 'pending',
        order_status: 'placed',
        escrow_enabled: isFoodOrderCart ? false : (escrow_enabled !== undefined ? escrow_enabled : false),
        // Intercity fields (empty spread for non-intercity)
        ...cartIntercityFields,
        ...(isFoodOrderCart && {
          fulfilment_type:          fulfilment_type || 'delivery',
          food_status:              'pending_acceptance',
          acceptance_deadline:      new Date(Date.now() + ACCEPTANCE_TIMEOUT_MINUTES_CART * 60 * 1000),
          new_restaurant_hold:      cartNewRestaurantHold,
          dispute_window_closes_at: new Date(Date.now() + 48 * 60 * 60 * 1000),
          status_logs: [{
            status:    'pending_acceptance',
            actor_id:  req.user._id,
            timestamp: new Date(),
            note:      'Order placed by customer.',
          }],
        }),
      }], { session, ordered: true });

      // For wallet-paid food orders: capture payment immediately at placement so the
      // vendor is paid at capture and any timeout/rejection triggers clawbackFoodRefund
      // which credits the amount back to the buyer's wallet.
      if (isFoodOrderCart && payment_method === 'wallet') {
        const buyer = await User.findById(req.user._id).session(session);
        if ((buyer.wallet_balance || 0) < orderTotal) {
          throw new Error('Insufficient wallet balance to place this food order.');
        }
        buyer.wallet_balance -= orderTotal;
        await buyer.save({ session });

        await Transaction.create([{
          user_id:     buyer._id,
          type:        'payment',
          amount:      orderTotal,
          reference:   `FOOD-${Date.now()}`,
          status:      'completed',
          description: `Food order payment — Order #${newOrder._id.toString().slice(-6).toUpperCase()}`,
          order_id:    newOrder._id,
        }], { session, ordered: true });

        newOrder.payment_status = 'paid';
        newOrder.order_status   = 'processing';
        await newOrder.save({ session });

        await handleVendorPayout(newOrder, session);
      }

      createdOrderIds.push(newOrder._id);

      if (['pay_on_delivery', 'wallet'].includes(payment_method) && normalizedShippingMethod === 'logistics_partner' && logistics_company_id) {
        await logisticsService.createShipmentsForOrder(newOrder, deliveryZone, logistics_company_id, session);
      }
    }

    // For immediate payment methods (wallet, escrow, POD), clear the cart now — the order
    // is already confirmed.  For external/async payments (Eversend, PayUnit) we leave the
    // cart intact so the customer can still see/retry their items if the mobile-money prompt
    // is declined or times out.  The verify page (wallet/verify) clears the server cart once
    // the gateway confirms success.
    const paymentIsExternal = ['eversend', 'payunit'].includes(payment_method);
    if (!req.body.items && !paymentIsExternal) {
       const cart = await Cart.findOne({ user_id: req.user._id }).session(session);
       if (cart) {
          cart.items = [];
          cart.context_booking_type = null;
          cart.context_vendor_id = null;
          await cart.save({ session });
       }
    }
    await session.commitTransaction();
    session.endSession();

    // Background notifications
    const webUrl = getWebUrl(req);
    if (payment_method === 'pay_on_delivery') {
      setImmediate(async () => {
        for (const orderId of createdOrderIds) {
          const o = await Order.findById(orderId);
          const v = await Vendor.findById(o.vendor_id);
          // Provide full order details and a link so notifier builds a styled HTML email
          const orderForEmail = o.toObject();
          sendNotification(req.app, v.user_id, {
            title: 'New Order Received',
            message: `Order #${o._id.toString().slice(-6)} received (POD).`,
            type: 'order_status',
            sendEmail: true,
            orderDetails: orderForEmail,
            emailLink: `${webUrl}/vendor/orders?orderId=${o._id}`,
            webUrl: webUrl
          });

          const trackingLink = `${webUrl}/orders/${o._id}`;
          const qrCodeDataUrl = await qrcode.toDataURL(trackingLink);

          const customerEmailTemplate = templates.orderPlaced({ 
            order: o, 
            customer: req.user,
            qrCode: qrCodeDataUrl,
            webUrl: webUrl
          });

          sendNotification(req.app, req.user._id, {
            title: customerEmailTemplate.subject,
            message: `Your order #${o._id.toString().slice(-6).toUpperCase()} has been confirmed.`,
            type: 'order_status',
            metadata: { order_id: o._id, link: `/orders/${o._id}` },
            sendEmail: true,
            emailLink: trackingLink,
            emailTemplate: customerEmailTemplate,
            orderDetails: orderForEmail,
            qrCode: qrCodeDataUrl,
            role: 'customer',
            webUrl: webUrl
          });

          // 3. Notify Logistics Partner if segment is assigned
          if (o.shipping_method === 'logistics_partner' && o.logistics_company_id) {
            const logisticsComp = await LogisticsCompany.findById(o.logistics_company_id);
            if (logisticsComp) {
              sendNotification(req.app, logisticsComp.user_id, {
                title: 'New Shipment Assigned (Bulk POD)',
                message: `Order #${o._id.toString().slice(-6).toUpperCase()} is ready for processing.`,
                type: 'logistics_update',
                metadata: { order_id: o._id, link: '/logistics/manifests' },
                sendEmail: true,
                overrideEmail: logisticsComp.contact_email,
                emailLink: `${webUrl}/logistics/manifests`,
                orderDetails: orderForEmail,
                role: 'logistics',
                webUrl: webUrl
              });
            }
          }

          // 4. Notify Admins — POD cart orders don't go through settle.service.js
          notifyAdmins(req.app, {
            title:   'New POD Order',
            message: `Order #${o._id.toString().slice(-6).toUpperCase()} (POD, ${Number(o.total_amount || 0).toLocaleString()} XAF) placed by ${req.user.name} at ${v?.store_name || 'unknown store'}.`,
            type:    'order_status',
            metadata: { order_id: o._id, link: `/admin/orders/${o._id}` },
            orderDetails: orderForEmail,
          }).catch(console.error);
        }
      });
    }

    res.status(201).json({ success: true, data: { orderIds: createdOrderIds } });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/orders/:id/food-status
// @desc    Kitchen dashboard — advance food_status through the pipeline.
//          Restaurant vendors: pending_acceptance → preparing → ready
//          Logistics/vendor:   ready → rider_arrived → picked_up → delivered
// @access  Private (vendor = restaurant, or logistics for pickup/delivery steps)
// ─────────────────────────────────────────────
const updateFoodStatus = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { food_status: newStatus, note } = req.body;

    const VALID_STATUSES = ['preparing', 'ready', 'rider_arrived', 'picked_up', 'delivered', 'rejected'];
    if (!VALID_STATUSES.includes(newStatus)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Invalid food_status. Allowed: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const order = await Order.findById(req.params.id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (!order.food_status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'This is not a food order.' });
    }

    // Resolve the caller's role and ownership
    const isAdmin = req.user.role === 'admin';
    let isRestaurantVendor = false;
    let isLogistics = req.user.role === 'logistics';

    if (req.user.role === 'vendor') {
      const callerVendor = await Vendor.findOne({ user_id: req.user._id }).select('_id vendor_type').lean();
      isRestaurantVendor = callerVendor?.vendor_type === 'restaurant' &&
                           callerVendor._id.toString() === order.vendor_id.toString();
    }

    // Validate allowed transition and caller role
    const TRANSITIONS = {
      // Restaurant kitchen controls
      preparing:      { from: ['pending_acceptance'], allowedRoles: ['restaurant', 'admin'] },
      rejected:       { from: ['pending_acceptance'], allowedRoles: ['restaurant', 'admin'] },
      ready:          { from: ['preparing'],          allowedRoles: ['restaurant', 'admin'] },
      // Logistics / pickup controls
      rider_arrived:  { from: ['ready'],              allowedRoles: ['logistics', 'admin'] },
      picked_up:      { from: ['ready', 'rider_arrived'], allowedRoles: ['logistics', 'restaurant', 'admin'] },
      delivered:      { from: ['picked_up'],          allowedRoles: ['logistics', 'restaurant', 'admin'] },
    };

    const rule = TRANSITIONS[newStatus];
    if (!rule.from.includes(order.food_status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: `Cannot transition from '${order.food_status}' to '${newStatus}'.`,
      });
    }

    const callerRole = isAdmin ? 'admin' : isRestaurantVendor ? 'restaurant' : isLogistics ? 'logistics' : null;
    if (!callerRole || !rule.allowedRoles.includes(callerRole)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: 'Not authorised to perform this transition.' });
    }

    // ── Apply the transition ────────────────────────────────────────────────
    const now = new Date();

    if (newStatus === 'preparing') {
      // Restaurant accepted — create Shipment for delivery orders (or schedule it)
      order.order_status = 'processing';
      if (order.fulfilment_type === 'delivery' && order.logistics_company_id) {
        const existingShipment = await Shipment.findOne({ order_id: order._id }).session(session);
        if (!existingShipment) {
          // ── Delayed rider dispatch (Phase 3 Step 12) ────────────────────────
          // Dispatch the rider at prep_time_minutes − avg_delivery_minutes so
          // the rider arrives at the restaurant just as the food is ready.
          // If travel >= prep OR avg_delivery_minutes is unknown → dispatch immediately.
          const RestaurantProfile = require('../models/RestaurantProfile.model');
          const [rProfile, logFirm] = await Promise.all([
            RestaurantProfile.findOne({ vendor_id: order.vendor_id })
              .select('prep_time_minutes')
              .lean(),
            LogisticsCompany.findById(order.logistics_company_id)
              .select('avg_delivery_minutes')
              .lean(),
          ]);

          const prepMinutes   = rProfile?.prep_time_minutes ?? 20;
          const travelMinutes = logFirm?.avg_delivery_minutes ?? null;
          const delayMs = (travelMinutes != null)
            ? Math.max(0, (prepMinutes - travelMinutes) * 60 * 1000)
            : 0;

          // Resolve delivery quartier — use explicit quartier or fall back to null
          const dispatchQuartier = order.shipping_address?.quartier || null;

          if (delayMs > 0) {
            // Schedule deferred dispatch — worker fires at rider_dispatch_at
            order.rider_dispatch_at = new Date(Date.now() + delayMs);
          } else {
            // Dispatch immediately (travel >= prep, or travel unknown)
            await logisticsService.createShipmentsForOrder(
              order,
              dispatchQuartier,
              order.logistics_company_id,
              session
            );
          }
        }
      }
    }

    if (newStatus === 'rejected') {
      // Vendor explicitly declined the order — cancel immediately and refund in full.
      order.order_status = 'cancelled';
      if (order.payment_status === 'paid') {
        const { clawbackFoodRefund } = require('../services/payment/settle.service');
        // Full refund including shipping_fee — no service was rendered
        await clawbackFoodRefund(order, order.total_amount, session, 'Order rejected by restaurant');
        order.payment_status = 'refunded';
        order.order_status   = 'refunded';
      }
    }

    if (newStatus === 'rider_arrived') {
      order.rider_arrived_at = now;
    }

    if (newStatus === 'picked_up') {
      order.order_status = 'shipped';
      order.picked_up_at = now;
      // Trigger logistics payout when rider picks up the order
      const { creditLogistics } = require('../services/payment/settle.service');
      await creditLogistics(order, session);
    }

    if (newStatus === 'delivered') {
      order.order_status = 'completed';
      order.delivered_at = now;
      // Release held payout for new restaurants
      const { releaseRestaurantHold } = require('../services/payment/settle.service');
      await releaseRestaurantHold(order, session);
    }

    order.food_status = newStatus;
    order.status_logs = order.status_logs || [];
    order.status_logs.push({
      status:    newStatus,
      actor_id:  req.user._id,
      timestamp: now,
      note:      note || null,
    });

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    // Background notifications
    setImmediate(async () => {
      try {
        const notifMap = {
          preparing:     { title: 'Order Accepted', message: 'Your food order has been accepted and is being prepared!' },
          rejected:      { title: 'Order Declined', message: 'Unfortunately the restaurant declined your order. Any payment has been refunded.' },
          ready:         { title: 'Order Ready', message: 'Your order is ready and waiting for pickup by the rider.' },
          rider_arrived: null, // internal only
          picked_up:     { title: 'Order Picked Up', message: 'Your food order is on its way!' },
          delivered:     { title: 'Order Delivered', message: 'Your food order has been delivered. Enjoy your meal!' },
        };
        const notif = notifMap[newStatus];
        if (notif) {
          await sendNotification(req.app, order.customer_id, {
            ...notif,
            type: 'order_status',
            metadata: { target_id: order._id, link: `/orders/${order._id}` },
          });
        }
      } catch (e) {
        console.error('[updateFoodStatus] notification failed:', e.message);
      }
    });

    res.status(200).json({ success: true, data: { food_status: order.food_status, order_status: order.order_status } });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/orders/:id/reorder
// @desc    Step 13b — Recreate a cart from a previous food order.
//          Validates: restaurant open, accepting orders, each meal available, prices unchanged.
//          Returns the rebuilt cart state and a flag for any changed prices.
// @access  Private (buyer who placed the original order)
// ─────────────────────────────────────────────
const reorder = async (req, res, next) => {
  try {
    const originalOrder = await Order.findById(req.params.id)
      .populate('products.product_id')
      .lean();

    if (!originalOrder) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (originalOrder.customer_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }
    if (!originalOrder.food_status) {
      return res.status(400).json({ success: false, message: 'Reorder is only available for food orders.' });
    }

    // Validate restaurant is still open + accepting
    const RestaurantProfile = require('../models/RestaurantProfile.model');
    const rProfile = await RestaurantProfile.findOne({ vendor_id: originalOrder.vendor_id })
      .select('is_accepting_orders opening_hours prep_time_minutes city_zone_id')
      .lean();

    if (!rProfile || !rProfile.is_accepting_orders) {
      return res.status(409).json({
        success: false,
        code: 'RESTAURANT_CLOSED',
        message: 'This restaurant is not accepting orders right now.',
      });
    }
    // Enforce time-based opening hours on reorder
    const { computeOpenStatus } = require('./restaurant.controller');
    const { open_status: reorderOpenStatus } = computeOpenStatus(rProfile.opening_hours);
    if (reorderOpenStatus !== 'open') {
      return res.status(409).json({
        success: false,
        code: 'RESTAURANT_CLOSED',
        message: 'This restaurant is currently closed. Please check their opening hours and try again.',
      });
    }

    // Validate each meal item; note price changes
    const cartItems = [];
    const priceChanges = [];
    const unavailable = [];

    for (const item of originalOrder.products) {
      const currentProduct = await Product.findById(item.product_id).lean();

      if (!currentProduct || currentProduct.status !== 'active') {
        unavailable.push({ name: item.name, reason: 'no_longer_available' });
        continue;
      }

      if (currentProduct.meal && currentProduct.meal.is_available_today === false) {
        unavailable.push({ name: item.name, reason: 'not_available_today' });
        continue;
      }

      const currentPrice = currentProduct.sale_price || currentProduct.price;
      if (currentPrice !== item.price) {
        priceChanges.push({
          name:          item.name,
          product_id:    item.product_id,
          original_price: item.price,
          current_price:  currentPrice,
        });
      }

      cartItems.push({
        product_id:       currentProduct._id,
        quantity:         item.quantity,
        selected_options: item.selected_options || [],
      });
    }

    if (cartItems.length === 0) {
      return res.status(409).json({
        success: false,
        code: 'ALL_ITEMS_UNAVAILABLE',
        message: 'None of the original items are available. Please browse the menu.',
        data: { unavailable },
      });
    }

    // Rebuild the cart (replace existing cart)
    const Cart = require('../models/Cart.model');
    let cart = await Cart.findOne({ user_id: req.user._id });

    const cartItemDocs = cartItems.map(ci => ({
      product:          ci.product_id,
      quantity:         ci.quantity,
      selected_options: ci.selected_options,
    }));

    if (cart) {
      cart.items               = cartItemDocs;
      cart.context_vendor_id   = originalOrder.vendor_id;
      cart.context_booking_type = originalOrder.fulfilment_type || 'delivery';
      await cart.save();
    } else {
      cart = await Cart.create({
        user_id:              req.user._id,
        items:                cartItemDocs,
        context_vendor_id:    originalOrder.vendor_id,
        context_booking_type: originalOrder.fulfilment_type || 'delivery',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        cart_id:       cart._id,
        items_added:   cartItems.length,
        unavailable,
        price_changes: priceChanges,
        has_changes:   unavailable.length > 0 || priceChanges.length > 0,
        // Pre-fill checkout fields from original order
        prefill: {
          vendor_id:          originalOrder.vendor_id,
          logistics_company_id: originalOrder.logistics_company_id,
          shipping_address:   originalOrder.shipping_address,
          fulfilment_type:    originalOrder.fulfilment_type || 'delivery',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 Step 7 — Intercity transit status transitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/orders/:id/transit/dispatch
 * Vendor marks the parcel as handed to the intercity agency.
 * Body: { transit_waybill_ref?, transit_receipt_url?, transit_fee_actual? }
 *
 * Guards:
 *   - Order belongs to this vendor
 *   - transit_status must be 'awaiting_dispatch'
 *   - 48h dispatch window not expired (order must be placed within 48h)
 */
const dispatchIntercityParcel = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.payment_status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Order has not been paid.' });
    }
    if (order.shipping_method !== 'intercity_agency') {
      return res.status(400).json({ success: false, message: 'Order is not an intercity shipment.' });
    }

    // Authorise: caller must be the vendor
    const vendor = await Vendor.findOne({ user_id: req.user._id }).select('_id');
    if (!vendor || order.vendor_id.toString() !== vendor._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    if (order.transit_status !== 'awaiting_dispatch') {
      return res.status(409).json({ success: false, message: `Cannot dispatch: transit is already '${order.transit_status}'.` });
    }

    // 48-hour dispatch window guard
    const hoursSincePlaced = (Date.now() - new Date(order.createdAt).getTime()) / 3600000;
    if (hoursSincePlaced > 48) {
      return res.status(409).json({
        success: false,
        code:    'DISPATCH_WINDOW_EXPIRED',
        message: 'The 48-hour dispatch window has expired. Please contact support.',
      });
    }

    const { transit_waybill_ref, transit_receipt_url, transit_fee_actual } = req.body;

    order.transit_status      = 'dispatched';
    order.dispatched_at       = new Date();
    if (transit_waybill_ref)  order.transit_waybill_ref  = transit_waybill_ref;
    if (transit_receipt_url)  order.transit_receipt_url  = transit_receipt_url;
    if (transit_fee_actual != null) order.transit_fee_actual = Number(transit_fee_actual);

    order.status_logs.push({
      status:    'transit_dispatched',
      actor_id:  req.user._id,
      timestamp: new Date(),
      note:      transit_waybill_ref ? `Waybill: ${transit_waybill_ref}` : null,
    });

    await order.save();

    // Notify buyer
    setImmediate(async () => {
      try {
        await sendNotification(req.app, order.customer_id, {
          title:    'Your Parcel Is On Its Way',
          message:  `Order #${order._id.toString().slice(-6).toUpperCase()} has been dispatched via ${order.transit_carrier || 'intercity agency'}.${transit_waybill_ref ? ` Waybill: ${transit_waybill_ref}.` : ''}`,
          type:     'order_status',
          metadata: { order_id: order._id, link: `/orders/${order._id}` },
        });
      } catch (e) {
        console.error('[dispatchIntercityParcel] notify error:', e.message);
      }
    });

    return res.json({ success: true, message: 'Parcel marked as dispatched.', data: { order } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/transit/arrive
 * Admin (or system) marks the parcel as arrived at the destination pickup point.
 * Triggers buyer notification to collect parcel.
 */
const markIntercityArrived = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.shipping_method !== 'intercity_agency') {
      return res.status(400).json({ success: false, message: 'Order is not an intercity shipment.' });
    }
    if (order.transit_status !== 'dispatched') {
      return res.status(409).json({ success: false, message: `Cannot mark arrived: transit is '${order.transit_status}'.` });
    }

    order.transit_status = 'arrived';
    order.arrived_at     = new Date();
    order.status_logs.push({
      status:    'transit_arrived',
      actor_id:  req.user._id,
      timestamp: new Date(),
      note:      req.body.note || null,
    });

    await order.save();

    // Notify buyer to collect
    setImmediate(async () => {
      try {
        await sendNotification(req.app, order.customer_id, {
          title:    'Parcel Arrived — Ready for Collection',
          message:  `Order #${order._id.toString().slice(-6).toUpperCase()} has arrived at the pickup point${order.transit_carrier ? ` (${order.transit_carrier})` : ''}. Please collect it.`,
          type:     'order_status',
          metadata: { order_id: order._id, link: `/orders/${order._id}` },
        });
      } catch (e) {
        console.error('[markIntercityArrived] notify error:', e.message);
      }
    });

    return res.json({ success: true, message: 'Parcel marked as arrived at pickup point.', data: { order } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/transit/collect
 * Buyer (or admin) confirms parcel collection.
 * Advances order_status to 'delivered' and releases escrow if held.
 */
const markIntercityCollected = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) throw new Error('Order not found.');
    if (order.shipping_method !== 'intercity_agency') {
      throw new Error('Order is not an intercity shipment.');
    }
    if (order.transit_status !== 'arrived') {
      throw new Error(`Cannot collect: parcel has not arrived yet (transit_status: '${order.transit_status}').`);
    }

    // Only buyer or admin may confirm collection
    if (
      req.user.role !== 'admin' &&
      order.customer_id.toString() !== req.user._id.toString()
    ) {
      throw new Error('Not authorised to confirm collection.');
    }

    order.transit_status = 'collected';
    order.order_status   = 'delivered';
    order.status_logs.push({
      status:    'transit_collected',
      actor_id:  req.user._id,
      timestamp: new Date(),
      note:      'Buyer collected parcel from pickup point.',
    });

    await order.save({ session });

    // Release escrow if enabled
    if (order.escrow_enabled) {
      const { markEscrowDelivered: markEscrow } = require('./escrow.controller');
      await markEscrow(order._id, session);
    }

    await session.commitTransaction();
    session.endSession();

    return res.json({ success: true, message: 'Parcel collected. Order marked delivered.', data: { order } });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

module.exports = {
  createOrder,
  getCustomerOrders,
  getVendorOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  requestRefund,
  approveRefund,
  getInvoice,
  payDirectly,
  createOrdersFromCart,
  updateFoodStatus,
  reorder,
  dispatchIntercityParcel,
  markIntercityArrived,
  markIntercityCollected,
};
