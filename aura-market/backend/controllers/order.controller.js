/**
 * controllers/order.controller.js
 * Aura Market — Order Controller
 *
 * Handling the creation of orders, reducing product stock natively, 
 * and routing payment status updates.
 */

const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const Vendor = require('../models/Vendor.model');
const RefundRequest = require('../models/RefundRequest.model');
const Escrow = require('../models/Escrow.model');
const User = require('../models/User.model');
const Shipment = require('../models/Shipment.model');
const mongoose = require('mongoose');
const { sendNotification } = require('../utils/notifier');
const { generateInvoice } = require('../utils/invoiceGenerator');
const Coupon = require('../models/Coupon.model');
const logisticsService = require('../services/logistics.service');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const Cart = require('../models/Cart.model');

// ─────────────────────────────────────────────
// @route   POST /api/orders
// @desc    Create a new order
// @access  Private (Role: customer)
// ─────────────────────────────────────────────
const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { vendor_id, products, payment_method, shipping_address, shipping_method } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ success: false, message: 'No order items provided.' });
    }

    // 1. Verify vendor exists
    const vendor = await Vendor.findById(vendor_id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }

    // 2. Calculate Subtotal & Verify Stock atomically
    let subtotal = 0;
    const validatedProducts = [];

    for (const item of products) {
      // Fetch currently active product 
      const product = await Product.findById(item.product_id).session(session);
      
      if (!product || product.status !== 'active') {
        throw new Error(`Product ${item.product_id} is unavailable.`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
      }

      // Deduct stock natively
      product.stock -= item.quantity;
      await product.save({ session });

      // Low stock alert
      if (product.stock < 5) {
        await sendNotification(req.app, vendor.user_id, {
          title: 'Low Stock Alert',
          message: `Your product "${product.name}" is running low on stock (${product.stock} items left).`,
          type: 'system_alert'
        });
      }

      // Build safe order item array
      validatedProducts.push({
        product_id: product._id,
        name: product.name,
        quantity: item.quantity,
        price: product.price, // Trusting the DB price mapping
        image: product.images.length > 0 ? product.images[0].url : null,
      });

      subtotal += product.price * item.quantity;
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
        // Increment use count
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

    let shipping_fee = 0;
    if (shipping_method === 'logistics_partner' && logistics_company_id && delivery_quartier) {
      // Validate compatibility
      const firms = await logisticsService.getCompatibleFirms(delivery_quartier, [vendor_id]);
      const isCompatible = firms.some(f => f._id.toString() === logistics_company_id);
      if (!isCompatible) {
        throw new Error('Selected logistics company does not support this delivery route.');
      }

      const fees = await logisticsService.calculateShipmentFees([vendor_id], delivery_quartier, logistics_company_id);
      shipping_fee = fees.totalFee;
    }

    const total_amount = subtotal + shipping_fee - discount;

    const orderData = [{
      customer_id: req.user._id,
      vendor_id,
      products: validatedProducts,
      subtotal,
      shipping_fee,
      total_amount: total_amount > 0 ? total_amount : 0,
      payment_method,
      shipping_method,
      shipping_address: {
         ...(shipping_address || req.user.address),
         quartier: delivery_quartier || (shipping_address?.quartier),
         email: req.user.email,
         phone: req.user.phone
      },
      delivery_description,
      logistics_company_id: logistics_company_id || null,
      payment_status: 'pending',
      order_status: 'placed',
      escrow_enabled: escrow_enabled !== undefined ? escrow_enabled : true,
    }];

    const order = await Order.create(orderData, { session });

    // For test flows: create shipment immediately when using pay on delivery.
    if (
      shipping_method === 'logistics_partner' &&
      logistics_company_id &&
      payment_method === 'pay_on_delivery'
    ) {
      await logisticsService.createShipmentsForOrder(order[0], delivery_quartier, logistics_company_id, session);
      const logisticsComp = await LogisticsCompany.findById(logistics_company_id).session(session);
      if (logisticsComp) {
        await sendNotification(req.app, logisticsComp.user_id, {
          title: 'New Shipment Assigned',
          message: `You have new delivery work for Order #${order[0]._id.toString().slice(-6).toUpperCase()}.`,
          type: 'system_alert',
          metadata: { order_id: order[0]._id, link: '/logistics/dashboard' },
          sendEmail: true,
          emailLink: `${process.env.WEB_CLIENT_URL}/logistics/dashboard`
        });
      }
    }

    // 5. Prune from Cart if it exists (Buy Now scenario)
    const cart = await Cart.findOne({ user_id: req.user._id }).session(session);
    if (cart) {
      const boughtIds = products.map(p => p.product_id.toString());
      cart.items = cart.items.filter(item => !boughtIds.includes(item.product.toString()));
      await cart.save({ session });
    }

    // 6. Notify Vendor (Order Received)
    await sendNotification(req.app, vendor.user_id, {
      title: 'New Order Received',
      message: `You have received a new order (#${order[0]._id.toString().slice(-6).toUpperCase()}) from ${req.user.name}.`,
      type: 'order_status',
      metadata: { order_id: order[0]._id, link: '/vendor/orders' },
      sendEmail: true,
      emailLink: `${process.env.WEB_CLIENT_URL}/vendor/orders`
    });

    // 7. Notify Customer (Confirmation)
    await sendNotification(req.app, req.user._id, {
      title: 'Order Confirmed',
      message: `Your order #${order[0]._id.toString().slice(-6).toUpperCase()} has been successfully processed and recorded.`,
      type: 'order_status',
      metadata: { order_id: order[0]._id, link: '/orders' },
      sendEmail: true,
      emailLink: `${process.env.WEB_CLIENT_URL}/orders`
    });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Order created successfully. Protocol Handshake established.',
      data: { order: order[0] },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Since we threw generic `Error` objects above for stock/availability faults, catch them properly:
    if (error.message.includes('Insufficient stock') || error.message.includes('unavailable')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/orders/:id/pay-direct
// @desc    Customer pays directly to vendor avoiding Escrow stage
// @access  Private (Role: customer)
// ─────────────────────────────────────────────
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
    const vendorUser = await User.findById(vendorAccount.user_id).session(session);

    // Transfer Funds
    user.wallet_balance -= order.total_amount;
    vendorUser.wallet_balance += order.total_amount;
    
    await user.save({ session });
    await vendorUser.save({ session });

    // Log Transactions
    await Transaction.create([{
      user_id: user._id,
      type: 'payment',
      amount: order.total_amount,
      reference: `DIRECT-${Date.now()}`,
      status: 'completed',
      description: `Direct Payment for Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order_id: order._id
    }, {
      user_id: vendorUser._id,
      type: 'payout',
      amount: order.total_amount,
      reference: `DR-REC-${Date.now()}`,
      status: 'completed',
      description: `Direct Payment Received (Order #${order._id.toString().slice(-6).toUpperCase()})`,
      order_id: order._id
    }], { session });

    order.payment_status = 'paid';
    order.order_status = 'processing';
    await order.save({ session });

    // ── AUTOMATIC LOGISTICS SHIPMENT TRIGGER ──
    if (order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
        const quartier = order.shipping_address.quartier;
        await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
        
        // Notify Logistics Company
        const logisticsComp = await LogisticsCompany.findById(order.logistics_company_id).session(session);
        await sendNotification(req.app, logisticsComp.user_id, {
            title: 'New Shipment Assigned',
            message: `You have been assigned new shipments for Order #${order._id.toString().slice(-6).toUpperCase()}.`,
            type: 'system_alert',
            metadata: { order_id: order._id, link: '/logistics/dashboard' },
            sendEmail: true,
            emailLink: `${process.env.WEB_CLIENT_URL}/logistics/dashboard`
        });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: 'Direct payment executed successfully.' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/orders/customer
// @desc    Get logged-in user's orders
// @access  Private (Role: customer)
// ─────────────────────────────────────────────
const getCustomerOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ customer_id: req.user._id })
      .populate('vendor_id', 'store_name')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: orders.length, data: { orders } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/orders/vendor
// @desc    Get logged-in vendor's received orders
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const getVendorOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ vendor_id: req.vendor._id })
      .populate('customer_id', 'name email phone avatar')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: orders.length, data: { orders } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/orders/:id
// @desc    Get order details
// @access  Private (Role: customer || vendor)
// ─────────────────────────────────────────────
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer_id', 'name email phone')
      .populate('vendor_id', 'store_name');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Verify Authorization: Only the customer who bought it or the vendor who sold it can view it
    const isCustomer = order.customer_id._id.toString() === req.user._id.toString();
    
    // We must check if the user is the vendor for this order
    let isVendor = false;
    if (req.user.role === 'vendor' && req.vendor) {
      if (order.vendor_id._id.toString() === req.vendor._id.toString()) {
        isVendor = true;
      }
    }

    if (!isCustomer && !isVendor && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order.' });
    }

    const shipments = await Shipment.find({ order_id: order._id })
      .populate('logistics_id', 'company_name contact_phone')
      .populate('vendor_id', 'store_name');

    res.status(200).json({ success: true, data: { order, shipments } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/orders/:id/status
// @desc    Update order timeline status + details
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const updateOrderStatus = async (req, res, next) => {
  try {
    const { order_status, tracking_number } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Check ownership (admins bypass)
    if (req.user.role !== 'admin') {
      if (order.vendor_id.toString() !== req.vendor._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to modify this order.' });
      }
    }

    if (order_status) order.order_status = order_status;
    if (tracking_number) order.tracking_number = tracking_number;

    await order.save();

    // Notify Customer about status change
    await sendNotification(req.app, order.customer_id, {
      title: `Order Status: ${order_status?.toUpperCase() || 'UPDATED'}`,
      message: `Your Order #${order._id.toString().slice(-6).toUpperCase()} is now ${order_status || 'updated'}.${tracking_number ? ' Tracking: ' + tracking_number : ''}`,
      type: 'order_status',
      metadata: { order_id: order._id, link: '/orders' },
      sendEmail: true,
      emailLink: `${process.env.WEB_CLIENT_URL}/orders`
    });

    res.status(200).json({ success: true, message: 'Order status updated.', data: { order } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/orders/:id/refund
// @desc    Customer requests a refund for an order
// @access  Private (Role: customer)
// ─────────────────────────────────────────────
const requestRefund = async (req, res, next) => {
  try {
    const { reason, evidence_urls } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.customer_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    if (!['placed', 'processing', 'shipped', 'delivered'].includes(order.order_status)) {
      return res.status(400).json({ success: false, message: 'Refund cannot be requested in current order state.' });
    }

    // Create Refund Request
    await RefundRequest.create({
      order_id: order._id,
      customer_id: req.user._id,
      vendor_id: order.vendor_id,
      reason,
      evidence_urls
    });

    order.order_status = 'refund_pending';
    await order.save();

    // Notify Vendor
    const vendor = await Vendor.findById(order.vendor_id);
    await sendNotification(req.app, vendor.user_id, {
      title: 'Refund Requested',
      message: `A refund has been requested for Order #${order._id.toString().slice(-6)}.`,
      type: 'system_alert',
      metadata: { order_id: order._id, link: '/vendor/orders' },
      sendEmail: true,
      emailLink: `${process.env.WEB_CLIENT_URL}/vendor/orders`
    });

    res.status(200).json({ success: true, message: 'Refund request submitted.', data: { order } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/orders/:id/approve-refund
// @desc    Vendor approves a refund request (Escrow released back to user)
// @access  Private (Role: vendor)
// ─────────────────────────────────────────────
const approveRefund = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(req.params.id).session(session);
    if (!order) throw new Error('Order not found.');

    if (order.vendor_id.toString() !== req.vendor._id.toString()) {
      throw new Error('Not authorized to approve refund for this order.');
    }

    if (order.order_status !== 'refund_pending') {
      throw new Error('No pending refund request found.');
    }

    // Update Request Record
    await RefundRequest.findOneAndUpdate(
      { order_id: order._id, status: 'pending' },
      { status: 'approved' },
      { session }
    );

    // Process Escrow Refund (if payment was in escrow)
    const escrow = await Escrow.findOne({ order_id: order._id }).session(session);
    if (escrow && escrow.status === 'held') {
      // Return money to user wallet
      await User.findByIdAndUpdate(order.customer_id, {
        $inc: { wallet_balance: escrow.amount }
      }).session(session);

      escrow.status = 'refunded';
      await escrow.save({ session });
    }

    order.order_status = 'refunded';
    order.payment_status = 'refunded';
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Notify Customer
    await sendNotification(req.app, order.customer_id, {
      title: 'Refund Approved',
      message: `Your refund for Order #${order._id.toString().slice(-6)} has been approved and funds returned to your wallet.`,
      type: 'wallet_update',
      metadata: { order_id: order._id, link: '/orders' },
      sendEmail: true,
      emailLink: `${process.env.WEB_CLIENT_URL}/orders`
    });

    res.status(200).json({ success: true, message: 'Refund approved and funds returned.', data: { order } });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/orders/:id/invoice
// @desc    Generate and download invoice PDF
// @access  Private
// ─────────────────────────────────────────────
const getInvoice = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('customer_id', 'name email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    // Authorization check
    if (order.customer_id._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    generateInvoice(order, (pdfBuffer) => {
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${order._id}.pdf`,
        'Content-Length': pdfBuffer.length,
      });
      res.send(pdfBuffer);
    });
  } catch (error) {
    next(error);
  }
};

const Cart = require('../models/Cart.model');
const Transaction = require('../models/Transaction.model');

// ... existing code ...

const createOrdersFromCart = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.findOne({ user_id: req.user._id }).populate({
        path: 'items.product',
        select: 'name price stock images vendor_id status'
    }).session(session);

    if (!cart || cart.items.length === 0) throw new Error('Cart is empty.');

    const itemsByVendor = {};
    for (const item of cart.items) {
      if (!item.product || item.product.status !== 'active') continue;
      if (item.product.stock < item.quantity) throw new Error(`Insufficient stock for ${item.product.name}`);
      
      const vId = item.product.vendor_id.toString();
      if (!itemsByVendor[vId]) itemsByVendor[vId] = [];
      itemsByVendor[vId].push(item);
    }

    const createdOrders = [];
    const { 
      shipping_address, 
      shipping_method, 
      payment_method, 
      escrow_enabled,
      logistics_company_id,
      delivery_quartier,
      delivery_description
    } = req.body;

    // Validate global logistics compatibility if using partner
    if (shipping_method === 'logistics_partner' && logistics_company_id && delivery_quartier) {
        const vendorIds = Object.keys(itemsByVendor);
        const firms = await logisticsService.getCompatibleFirms(delivery_quartier, vendorIds);
        const isCompatible = firms.some(f => f._id.toString() === logistics_company_id);
        if (!isCompatible) {
            throw new Error('Selected logistics company cannot handle one or more vendors in your cart for this delivery quartier.');
        }
    }

    for (const [vendorId, items] of Object.entries(itemsByVendor)) {

      let subtotal = 0;
      const orderProducts = items.map(it => {
        subtotal += it.product.price * it.quantity;
        return {
          product_id: it.product._id,
          name: it.product.name,
          quantity: it.quantity,
          price: it.product.price,
          image: it.product.images?.[0]?.url || it.product.images?.[0]
        };
      });

      // Atomically decrement stock
      for (const it of items) {
        await Product.findByIdAndUpdate(it.product._id, { $inc: { stock: -it.quantity } }, { session });
      }

      let vendor_shipping_fee = 0;
      if (shipping_method === 'logistics_partner' && logistics_company_id && delivery_quartier) {
          const fees = await logisticsService.calculateShipmentFees([vendorId], delivery_quartier, logistics_company_id);
          vendor_shipping_fee = fees.totalFee;
      }

      const order = await Order.create([{
        customer_id: req.user._id,
        vendor_id: vendorId,
        products: orderProducts,
        subtotal,
        shipping_fee: vendor_shipping_fee,
        total_amount: subtotal + vendor_shipping_fee,
        payment_method: payment_method || 'wallet',
        shipping_method: shipping_method || 'vendor_managed',
        logistics_company_id: logistics_company_id || null,
        shipping_address: {
            ...(shipping_address || {}),
            quartier: delivery_quartier || shipping_address?.quartier,
            email: shipping_address?.email || req.user.email,
            phone: shipping_address?.phone || req.user.phone
        },
        delivery_description,
        payment_status: 'pending',
        order_status: 'placed',
        escrow_enabled: escrow_enabled !== undefined ? escrow_enabled : true
      }], { session });

      createdOrders.push(order[0]._id);

      // For test flows: create shipment now when pay_on_delivery is selected.
      if (
        (payment_method || 'wallet') === 'pay_on_delivery' &&
        shipping_method === 'logistics_partner' &&
        logistics_company_id &&
        delivery_quartier
      ) {
        await logisticsService.createShipmentsForOrder(order[0], delivery_quartier, logistics_company_id, session);
        const logisticsComp = await LogisticsCompany.findById(logistics_company_id).session(session);
        if (logisticsComp) {
          await sendNotification(req.app, logisticsComp.user_id, {
            title: 'New Shipment Assigned',
            message: `You have new delivery work for Order #${order[0]._id.toString().slice(-6).toUpperCase()}.`,
            type: 'system_alert',
            metadata: { order_id: order[0]._id, link: '/logistics/dashboard' },
            sendEmail: true,
            emailLink: `${process.env.WEB_CLIENT_URL}/logistics/dashboard`
          });
        }
      }
    }

    // Clear cart
    cart.items = [];
    await cart.save({ session });

    // Notify Vendors & Customer for each order created
    for (const orderId of createdOrders) {
      const o = await Order.findById(orderId).session(session);
      const v = await Vendor.findById(o.vendor_id);
      
      // Notify Vendor
      await sendNotification(req.app, v.user_id, {
        title: 'New Order Received',
        message: `New bulk order segment (#${o._id.toString().slice(-6).toUpperCase()}) from ${req.user.name}.`,
        type: 'order_status',
        metadata: { order_id: o._id, link: '/vendor/orders' },
        sendEmail: true,
        emailLink: `${process.env.WEB_CLIENT_URL}/vendor/orders`
      });

      // Notify Customer
      await sendNotification(req.app, req.user._id, {
        title: 'Order Segment Placed',
        message: `Your order segment #${o._id.toString().slice(-6).toUpperCase()} has been confirmed.`,
        type: 'order_status',
        metadata: { order_id: o._id, link: '/orders' },
        sendEmail: true,
        emailLink: `${process.env.WEB_CLIENT_URL}/orders`
      });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ 
      success: true, 
      message: 'Cart synchronized and orders split successfully.', 
      data: { orderIds: createdOrders } 
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOrder,
  getCustomerOrders,
  getVendorOrders,
  getOrderById,
  updateOrderStatus,
  requestRefund,
  approveRefund,
  getInvoice,
  payDirectly,
  createOrdersFromCart,
};


