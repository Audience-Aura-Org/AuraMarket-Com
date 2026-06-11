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

const { sendNotification }    = require('../utils/notifier');
const { sendEmail }           = require('../utils/emailService');
const { generateInvoice }     = require('../utils/invoiceGenerator');
const { getWebUrl }           = require('../utils/url');
const logisticsService        = require('../services/logistics.service');
const {
  syncShipmentsToOrderStatus,
  getOrderFulfillmentSnapshot,
  notifyOrderStatusChange,
} = require('../services/orderSync.service');
const templates               = require('../utils/emailTemplates');
const { markEscrowDelivered } = require('./escrow.controller');

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
  let itemPrice = product.price;
  let itemImage = product.images?.[0]?.url || null;

  if (product.has_variants) {
    const variantMatch = findSelectedVariant(product, item.variant);
    if (!variantMatch) {
      throw new Error(`Please select a valid variant for ${product.name}.`);
    }
    if (variantMatch.stock < quantity) {
      throw new Error(`Insufficient stock for ${product.name} (${variantLabel(item.variant)}). Available: ${variantMatch.stock}`);
    }
    itemPrice = variantMatch.price;
    if (variantMatch.image) itemImage = variantMatch.image;
  } else if (product.stock < quantity) {
    throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
  }

  return { quantity, itemPrice, itemImage };
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
    const { vendor_id, products, shipping_address, shipping_method } = req.body;
    const payment_method = normalizePaymentMethod(req.body.payment_method);

    if (!products || products.length === 0) {
      return res.status(400).json({ success: false, message: 'No order items provided.' });
    }

    // 1. Verify vendor exists
    const vendor = await Vendor.findById(vendor_id).populate('user_id', 'name email');
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    // 2. Calculate Subtotal & Verify Stock atomically
    let subtotal = 0;
    const validatedProducts = [];

    for (const item of products) {
      const product = await Product.findById(item.product_id).session(session);
      
      if (!product || product.status !== 'active') {
        throw new Error(`Product ${item.product_id} is unavailable.`);
      }

      const { quantity, itemPrice, itemImage } = resolveOrderLine(product, item);

      if (product.has_variants) {
        const variantMatch = findSelectedVariant(product, item.variant);
        variantMatch.stock -= quantity;
      }

      product.stock -= quantity;
      product.purchase_count = (product.purchase_count || 0) + quantity;
      product.markModified('sku_variants');
      await product.save({ session });

      // Low stock alert (in-app only)
      if (product.stock < 5) {
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
        image:      itemImage,
        variant:    item.variant
      });

      subtotal += itemPrice * item.quantity;
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
      escrow_enabled 
    } = req.body;

    const normalizedShippingMethod = isVendorManagedShipping(shipping_method) ? 'vendor_managed' : 'logistics_partner';
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
      const firms = await logisticsService.getCompatibleFirms(deliveryZone, [vendor_id]);
      const isCompatible = firms.some(f => f._id.toString() === logistics_company_id);
      if (!isCompatible) {
        throw new Error('Selected logistics company does not support this delivery route.');
      }

      const fees = await logisticsService.calculateShipmentFees([vendor_id], deliveryZone, logistics_company_id);
      shipping_fee = fees.totalFee;
    }

    const total_amount = subtotal + shipping_fee - discount;

    const orderData = {
      customer_id:     req.user._id,
      vendor_id,
      products:        validatedProducts,
      subtotal,
      shipping_fee,
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
      escrow_enabled:  escrow_enabled !== undefined ? escrow_enabled : true,
    };

    const [createdOrder] = await Order.create([orderData], { session, ordered: true });

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

    const vendorAccount = await Vendor.findById(order.vendor_id).session(session);
    const vendorUser    = await User.findById(vendorAccount.user_id).session(session);

    const vendorBaseAmount = (order.shipping_method === 'logistics_partner' && order.logistics_company_id)
      ? order.subtotal
      : order.total_amount;

    // Transfer Funds directly to Vendor (No Escrow)
    user.wallet_balance -= order.total_amount;
    await user.save({ session });
    vendorUser.wallet_balance += vendorBaseAmount; 
    await vendorUser.save({ session });

    // Log Transactions
    await Transaction.create([{
      user_id:     user._id,
      type:        'payment',
      amount:      order.total_amount,
      reference:   `DIRECT-${Date.now()}`,
      status:      'completed',
      description: `Direct Payment for Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order_id:    order._id
    }, {
      user_id:     vendorUser._id,
      type:        'payout',
      amount:      vendorBaseAmount,
      reference:   `EP-${Date.now()}`,
      status:      'completed',
      description: `Incoming Direct Payment (Order #${order._id.toString().slice(-6).toUpperCase()})`,
      order_id:    order._id
    }], { session, ordered: true });

    order.payment_status = 'paid';
    order.order_status   = 'processing';
    await order.save({ session });

    // Clear cart upon successful direct payment
    const cart = await Cart.findOne({ user_id: req.user._id }).session(session);
    if (cart) {
      cart.items = [];
      await cart.save({ session });
    }

    // ── AUTOMATIC LOGISTICS SHIPMENT TRIGGER ──
    let logisticsNotification = null;
    if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
        const quartier = order.shipping_address.quartier;
        await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
        
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
    const orders = await Order.find({ vendor_id: req.vendor._id })
      .populate('customer_id', 'name email phone avatar')
      .populate('products.product_id', 'name price images')
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

    // ── GUARD: First to Launch Wins (Authority Handover) ──
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

    const paidCancellation = order.payment_status === 'paid';
    const pendingCancellation = order.payment_status === 'pending';
    if (!paidCancellation && !pendingCancellation) {
      throw new Error(`Cannot cancel an order with payment status ${order.payment_status}.`);
    }

    if (paidCancellation) {
      const ageMs = Date.now() - new Date(order.createdAt).getTime();
      const thirtyMinutesMs = 30 * 60 * 1000;
      if (ageMs > thirtyMinutesMs) {
        throw new Error('Paid orders can only be cancelled within 30 minutes of checkout.');
      }
    }

    const activeShipment = await Shipment.findOne({
      order_id: order._id,
      status: { $in: ['picked_up', 'in_transit', 'out_for_delivery', 'delivered'] },
    }).session(session);
    if (activeShipment) {
      throw new Error('The shipment has already started. Please open a dispute or refund request instead.');
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

    setImmediate(() => {
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

    await RefundRequest.findOneAndUpdate({ order_id: order._id, status: 'pending' }, { status: 'approved' }, { session });

    const escrow = await Escrow.findOne({ order_id: order._id }).session(session);
    if (escrow && escrow.status === 'held') {
      await User.findByIdAndUpdate(order.customer_id, { $inc: { wallet_balance: escrow.amount } }).session(session);
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

    const createdOrderIds = [];
    const { 
      shipping_address, 
      payment_method: rawPaymentMethod, 
      shipping_method,
      logistics_company_id, 
      delivery_quartier, 
      delivery_description,
      escrow_enabled
    } = req.body;
    const payment_method = normalizePaymentMethod(rawPaymentMethod);

    const normalizedShippingMethod = isVendorManagedShipping(shipping_method) ? 'vendor_managed' : 'logistics_partner';
    const deliveryZone = delivery_quartier || shipping_address?.quartier;

    if (!deliveryZone) {
       throw new Error('A delivery zone must be selected for all items in your cart.');
    }

    if (normalizedShippingMethod === 'logistics_partner' && !logistics_company_id) {
       throw new Error('Select a logistics partner or choose vendor-managed delivery.');
    }

    for (const [vendorId, items] of Object.entries(itemsByVendor)) {
      let subtotal = 0;
      const orderProducts = items.map(it => {
        const { quantity, itemPrice, itemImage } = resolveOrderLine(it.product, it);

        subtotal += itemPrice * quantity;
        return { 
          product_id: it.product._id, 
          name: it.product.name, 
          quantity,
          price: itemPrice, 
          image: itemImage,
          variant: it.variant
        };
      });

      for (const it of items) {
        // Find product to update stock
        const p = await Product.findById(it.product._id).session(session);
        if (p) {
          const quantity = Number(it.quantity || 1);
          if (p.has_variants) {
            const vMatch = findSelectedVariant(p, it.variant);
            if (!vMatch) throw new Error(`Please select a valid variant for ${p.name}.`);
            vMatch.stock -= quantity;
            p.markModified('sku_variants');
          }
          p.stock -= quantity;
          p.purchase_count = (p.purchase_count || 0) + quantity;
          await p.save({ session });
        }
      }

      let shippingFee = 0;
      if (normalizedShippingMethod === 'logistics_partner' && logistics_company_id && deliveryZone) {
          const fees = await logisticsService.calculateShipmentFees([vendorId], deliveryZone, logistics_company_id);
          shippingFee = fees.totalFee;
      }

      const [newOrder] = await Order.create([{
        customer_id: req.user._id,
        vendor_id: vendorId,
        products: orderProducts,
        subtotal,
        shipping_fee: shippingFee,
        total_amount: subtotal + shippingFee,
        payment_method,
        shipping_method: normalizedShippingMethod,
        logistics_company_id: normalizedShippingMethod === 'logistics_partner' ? logistics_company_id : null,
        shipping_address: { ...shipping_address, quartier: deliveryZone, email: req.user.email, phone: req.user.phone },
        delivery_description,
        payment_status: 'pending',
        order_status: 'placed',
        escrow_enabled: escrow_enabled !== undefined ? escrow_enabled : true,
      }], { session, ordered: true });

      createdOrderIds.push(newOrder._id);

      if (['pay_on_delivery', 'wallet'].includes(payment_method) && normalizedShippingMethod === 'logistics_partner' && logistics_company_id) {
        await logisticsService.createShipmentsForOrder(newOrder, deliveryZone, logistics_company_id, session);
      }
    }

    // Once cart items become order records, clear the server cart for every checkout method.
    // External payments keep retry state on the created orders, not by resubmitting stale cart lines.
    if (!req.body.items) {
       const cart = await Cart.findOne({ user_id: req.user._id }).session(session);
       if (cart) {
          cart.items = [];
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
};
