/**
 * services/payment/settle.service.js
 * Auradime — Order Settlement Engine
 *
 * Single source of truth for all vendor payout/escrow/platform-fee accounting.
 * Replaces duplicate logic previously in:
 *   - wallet.controller.js → payOrderWithWallet()
 *   - payment.controller.js → settleOrdersInSession()
 *
 * Usage:
 *   const { settleOrder, settleOrders } = require('../services/payment/settle.service');
 *   await settleOrder(order, session, app, { webUrl, skipBalanceDeduct });
 */

const mongoose = require('mongoose');
const User = require('../../models/User.model');
const Vendor = require('../../models/Vendor.model');
const Store = require('../../models/Store.model');
const Escrow = require('../../models/Escrow.model');
const Transaction = require('../../models/Transaction.model');
const Order = require('../../models/Order.model');
const Cart = require('../../models/Cart.model');
const LogisticsCompany = require('../../models/LogisticsCompany.model');
const Shipment = require('../../models/Shipment.model');
const PlatformSettings = require('../../models/PlatformSettings.model');
const logisticsService = require('../logistics.service');
const { sendNotification, notifyAdmins } = require('../../utils/notifier');
const { applyCommissionOverride, calculatePlatformFees, describeFee } = require('../../utils/platformFees');
const { debitBalance, creditBalance } = require('../wallet.service');
const crypto = require('crypto');

const getEffectivePlatformSettings = async (vendorId, session) => {
  const platformSettings = await PlatformSettings.getSettings(session);
  const store = await Store.findOne({ vendor_id: vendorId }).select('commission_rate').session(session);
  return {
    platformSettings,
    effectiveSettings: applyCommissionOverride(platformSettings, store?.commission_rate),
  };
};
const genRef = (prefix = 'SETTLE') =>
  `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/**
 * Credit the logistics company's wallet for the shipping fee on an order.
 * Called after delivery confirmation (escrow release).
 *
 * @param {Object} order - Populated Order document
 * @param {Object} session - Mongoose session
 */
const creditLogistics = async (order, session) => {
  if (
    order.shipping_method !== 'logistics_partner' ||
    !order.logistics_company_id ||
    !order.shipping_fee ||
    order.shipping_fee <= 0
  ) return;

  const logisticsFirm = await LogisticsCompany.findById(order.logistics_company_id).session(session);
  if (!logisticsFirm) return;

  const logisticsUser = await creditBalance(logisticsFirm.user_id, order.shipping_fee, session);
  if (!logisticsUser) return;

  await Transaction.create([{
    user_id: logisticsFirm.user_id,
    type: 'payout',
    amount: order.shipping_fee,
    reference: genRef('LOG'),
    status: 'completed',
    description: `Shipping fee credit for Order #${order._id.toString().slice(-6).toUpperCase()}`,
    order_id: order._id,
    gateway: 'wallet',
  }], { session, ordered: true });
};

/**
 * Handle vendor payout for a single order.
 * Manages escrow vs direct payout, commission deduction, and platform revenue.
 *
 * @param {Object} order        - Mongoose Order document (must be within session)
 * @param {Object} session      - Active mongoose session
 * @param {number} [overrideAmount] - Override the base amount (e.g. already-computed vendorBase)
 */
const handleVendorPayout = async (order, session, overrideAmount = null) => {
  const { platformSettings, effectiveSettings } = await getEffectivePlatformSettings(order.vendor_id, session);

  // Vendor base excludes payment collection fees.
  // - logistics_partner: shipping_fee is paid separately to the logistics carrier after delivery.
  // - intercity_agency:  transit_fee is credited to vendor immediately below so they can pay the
  //                      agency at dropoff. Commission only applies to subtotal.
  // - vendor_managed:    vendor keeps subtotal + shipping_fee (shipping is their revenue).
  const vendorBaseAmount = overrideAmount ?? (
    (order.shipping_method === 'logistics_partner' && order.logistics_company_id) ||
    order.shipping_method === 'intercity_agency'
      ? order.subtotal
      : order.subtotal + (order.shipping_fee || 0)
  );

  const isEscrowPayout = !!order.escrow_enabled;
  const { commissionFee, escrowFee, platformFee, vendorPayout } = calculatePlatformFees(vendorBaseAmount, effectiveSettings, {
    includeEscrowFee: isEscrowPayout
  });
  const feeDescription = describeFee(effectiveSettings, { includeEscrowFee: isEscrowPayout });
  const platformFeeBreakdown = {
    base_amount: vendorBaseAmount,
    commission_fee: commissionFee,
    escrow_fee: escrowFee,
    platform_fee: platformFee,
    vendor_payout: vendorPayout,
  };

  if (order.escrow_enabled) {
    // ── ESCROW PATH: hold funds, create pending payout tx ────────────────
    await Escrow.create([{
      order_id: order._id,
      vendor_id: order.vendor_id,
      buyer_id: order.customer_id,
      amount: vendorBaseAmount,
      status: 'held',
    }], { session, ordered: true });

    // BUG-03 fix: store GROSS amount (vendorBaseAmount), not net-of-fees (vendorPayout).
    // The admin audit trail must show what the vendor earned before the platform deducted its fees,
    // otherwise the pending record looks like the vendor is owed more than they actually are.
    // The fee breakdown is preserved in metadata so the escrow release step can recalculate correctly.
    const vendorRecord = await Vendor.findById(order.vendor_id).session(session);
    await Transaction.create([{
      user_id: vendorRecord.user_id,
      type: 'payout',
      amount: vendorBaseAmount,
      reference: genRef('PAYOUT-PEND'),
      status: 'pending',
      description: `Pending payout for Order #${order._id.toString().slice(-6).toUpperCase()} (Escrow held — fees deducted on release)`,
      order_id: order._id,
      gateway: 'escrow',
      metadata: { platform_fee_breakdown: platformFeeBreakdown },
    }], { session, ordered: true });

  } else if (order.new_restaurant_hold) {
    // ── NEW-RESTAURANT HOLD PATH ─────────────────────────────────────────
    // Phase 3 Step 5b: Vendor is a new restaurant below the completed-order threshold.
    // Do NOT credit the wallet at capture. Record a pending payout; the hold will be
    // released when food_status transitions to 'delivered' (see releaseRestaurantHold).
    const vendorRecord = await Vendor.findById(order.vendor_id).session(session);
    await Transaction.create([{
      user_id:     vendorRecord.user_id,
      type:        'payout',
      amount:      vendorPayout,
      reference:   genRef('PAYOUT-HELD'),
      status:      'pending',
      description: `Held payout for Order #${order._id.toString().slice(-6).toUpperCase()} (new restaurant — releases on delivery)`,
      order_id:    order._id,
      gateway:     'wallet',
      metadata:    { platform_fee_breakdown: platformFeeBreakdown },
    }], { session, ordered: true });
    // Platform fee is pre-committed at capture regardless of hold
    platformSettings.platform_wallet_balance = (platformSettings.platform_wallet_balance || 0) + platformFee;
    await platformSettings.save({ session });

  } else {
    // ── DIRECT PATH: credit vendor immediately ───────────────────────────
    const vendorRecord = await Vendor.findById(order.vendor_id).session(session);
    await creditBalance(vendorRecord.user_id, vendorPayout, session);

    platformSettings.platform_wallet_balance = (platformSettings.platform_wallet_balance || 0) + platformFee;
    await platformSettings.save({ session });

    const transactionEntries = [{
      user_id: vendorRecord.user_id,
      type: 'payout',
      amount: vendorPayout,
      reference: genRef('PAYOUT-DIRECT'),
      status: 'completed',
      description: `Direct payout for Order #${order._id.toString().slice(-6).toUpperCase()} (No Escrow)`,
      order_id: order._id,
      gateway: 'wallet',
      metadata: { platform_fee_breakdown: platformFeeBreakdown },
    }];

    if (platformFee > 0) {
      transactionEntries.push({
        user_id: vendorRecord.user_id,
        type: 'payment',
        amount: platformFee,
        reference: genRef('REV'),
        status: 'completed',
        description: `Platform commission from Order #${order._id.toString().slice(-6).toUpperCase()}`,
        order_id: order._id,
        gateway: 'platform',
        metadata: { platform_fee_breakdown: platformFeeBreakdown },
      });
    }

    await Transaction.create(transactionEntries, { session, ordered: true });

    // NOTE: Logistics company is NO LONGER credited here.
    // They are credited in logistics.controller.js ONLY after successful delivery.
    // This ensures couriers are only paid for completed work. ───
  }

  // ── Phase 4: Intercity transit-fee credit ────────────────────────────────
  // Credit transit_fee to the vendor wallet immediately at capture.
  // The vendor uses these funds to pay the intercity agency at parcel dropoff.
  // If transit_fee_waived, nothing to credit. Applies regardless of escrow/hold path.
  if (
    order.shipping_method === 'intercity_agency' &&
    !order.transit_fee_waived &&
    order.transit_fee > 0
  ) {
    const vendorRecord = await Vendor.findById(order.vendor_id).session(session);
    await creditBalance(vendorRecord.user_id, order.transit_fee, session);

    await Transaction.create([{
      user_id:     vendorRecord.user_id,
      type:        'payout',
      amount:      order.transit_fee,
      reference:   genRef('TRANSIT'),
      status:      'completed',
      description: `Intercity transit fee advance for Order #${order._id.toString().slice(-6).toUpperCase()} (${order.transit_carrier || 'agency'})`,
      order_id:    order._id,
      gateway:     'wallet',
      metadata:    { transit_carrier: order.transit_carrier, transit_rate_id: order.transit_rate_id },
    }], { session, ordered: true });
  }
};

/**
 * Fully settle a single order: deduct buyer balance, pay vendor/escrow,
 * create logistics shipment, and send notifications.
 *
 * @param {Object} params
 * @param {string|Object} params.orderId     - Order ID or populated Order document
 * @param {string}        params.userId      - Buyer's User ID
 * @param {Object}        params.session     - Active Mongoose session
 * @param {Object}        [params.app]       - Express app (for notifications)
 * @param {string}        [params.webUrl]    - Base URL for email links
 * @param {boolean}       [params.skipBalanceDeduct] - Skip deducting buyer wallet (e.g. already deducted)
 * @returns {Object} settled order
 */
const settleOrder = async ({ orderId, userId, session, app, webUrl = '', skipBalanceDeduct = false, paymentGateway = 'wallet' }) => {
  const order = typeof orderId === 'object' ? orderId : await Order.findById(orderId).session(session);
  if (!order || order.payment_status !== 'pending') return null;

  if (!skipBalanceDeduct) {
    const debited = await debitBalance(userId, order.total_amount, session);
    if (!debited) throw new Error(`Insufficient wallet balance for order #${order._id.toString().slice(-4)}.`);
  }
  const user = await User.findById(userId).select('_id name email wallet_balance').session(session);
  if (!user) throw new Error('Buyer user not found.');

  // Mark order paid
  order.payment_status = 'paid';
  order.order_status = 'processing';
  await order.save({ session });

  // Log customer payment transaction
  await Transaction.create([{
    user_id: user._id,
    type: 'payment',
    amount: order.total_amount,
    reference: genRef('PAY'),
    status: 'completed',
    gateway: paymentGateway,
    description: `Payment for Order #${order._id.toString().slice(-6).toUpperCase()}`,
    order_id: order._id,
  }], { session, ordered: true });

  // Handle vendor payout (escrow or direct)
  await handleVendorPayout(order, session);

  // Food orders that started as 'awaiting_payment' (gateway checkout):
  // Now that payment is confirmed, open the kitchen acceptance window.
  if (order.food_status === 'awaiting_payment') {
    const PlatformSettings = require('../../models/PlatformSettings.model');
    const ps = await PlatformSettings.getSettings();
    const timeoutMins = ps.food_acceptance_timeout_minutes ?? 30;
    order.food_status = 'pending_acceptance';
    order.acceptance_deadline = new Date(Date.now() + timeoutMins * 60 * 1000);
    order.status_logs = order.status_logs || [];
    order.status_logs.push({
      status:    'pending_acceptance',
      actor_id:  null,
      timestamp: new Date(),
      note:      'Payment confirmed via gateway — kitchen acceptance window opened.',
    });
    await order.save({ session });
  }

  // A food delivery is dispatched only after kitchen acceptance. Gateway
  // confirmation must not assign a rider to a meal that can still be rejected.
  if (!order.food_status && order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
    const quartier = order.shipping_address?.quartier;
    if (quartier) {
      const existing = await Shipment.findOne({ order_id: order._id }).session(session);
      if (!existing) {
        await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
      }
    }
  }

  // Background notifications
  if (app) {
    const vendor = await Vendor.findById(order.vendor_id);
    const orderObj = order.toObject();
    orderObj.vendor_id = vendor;

    setImmediate(async () => {
      try {
        // Fetch supporting data in parallel before dispatching notifications
        const [shipmentDoc, logisticsFirm] = await Promise.all([
          Shipment.findOne({ order_id: order._id }).lean(),
          (order.shipping_method === 'logistics_partner' && order.logistics_company_id)
            ? LogisticsCompany.findById(order.logistics_company_id)
            : Promise.resolve(null),
        ]);
        if (shipmentDoc) orderObj.shipment = shipmentDoc;
        orderObj.customer_name = user.name;

        // Dispatch all notifications in parallel so no recipient waits on another
        const tasks = [
          sendNotification(app, user._id, {
            title: 'Order Payment Confirmed',
            message: `Your payment for order #${order._id.toString().slice(-6).toUpperCase()} has been confirmed.`,
            type: 'order_status',
            metadata: { order_id: order._id, link: '/orders' },
            sendEmail: true,
            orderDetails: orderObj,
            role: 'customer',
            webUrl,
          }),
          notifyAdmins(app, {
            title: 'Order Payment Received',
            message: `Order #${order._id.toString().slice(-6).toUpperCase()} paid — ${user.name || 'Customer'} · ${order.total_amount?.toLocaleString()} XAF`,
            type: 'system_alert',
            metadata: { order_id: order._id, link: '/admin/orders' },
            sendEmail: true,
          }),
        ];
        if (vendor) {
          tasks.push(sendNotification(app, vendor.user_id, {
            title: 'Order Paid & Confirmed',
            message: `Payment received for order #${order._id.toString().slice(-6).toUpperCase()} from ${user.name}.`,
            type: 'order_status',
            metadata: { order_id: order._id, link: '/vendor/orders' },
            sendEmail: true,
            orderDetails: orderObj,
            role: 'vendor',
            webUrl,
          }));
        }
        if (logisticsFirm) {
          tasks.push(sendNotification(app, logisticsFirm.user_id, {
            title: 'New Shipment Assigned',
            message: `Order #${order._id.toString().slice(-6).toUpperCase()} is ready for pickup.`,
            type: 'logistics_update',
            metadata: { order_id: order._id, link: '/logistics/manifests', status: shipmentDoc?.status || 'assigned' },
            sendEmail: true,
            role: 'logistics',
            webUrl,
            orderDetails: { ...orderObj, logistics_name: logisticsFirm.company_name },
            emailLink: `${webUrl}/logistics/manifests`,
            overrideEmail: logisticsFirm.contact_email,
          }));
        }
        await Promise.all(tasks);

        // Push real-time balance update to vendor if they were credited immediately
        const vendorGotDirectPayout = !order.escrow_enabled && !order.new_restaurant_hold;
        const vendorGotTransitFee = order.shipping_method === 'intercity_agency' && !order.transit_fee_waived && order.transit_fee > 0;
        if (vendor && (vendorGotDirectPayout || vendorGotTransitFee)) {
          try {
            const io = app?.get?.('io');
            if (io) {
              const vRoom = vendor.user_id.toString();
              const payload = { type: 'payout', reference: order._id };
              io.to(vRoom).emit('wallet:credited', payload);
              io.to(`user:${vRoom}`).emit('wallet:credited', payload);
            }
          } catch (_) { /* non-critical */ }
        }
      } catch (e) {
        console.error('[settleOrder] bg notification error:', e.message);
      }
    });
  }

  return order;
};

/**
 * Settle multiple orders in a single session (e.g., post-Eversend payment).
 * Also clears the buyer's cart after all orders are settled.
 *
 * @param {string}   userId   - Buyer's User ID
 * @param {string[]} orderIds - Array of Order IDs to settle
 * @param {Object}   session  - Active Mongoose session (managed by caller)
 * @param {Object}   [app]    - Express app (for notifications)
 * @param {boolean}  [skipBalanceDeduct] - If true, does NOT deduct wallet (funds already credited via gateway)
 * @param {string}   [webUrl] - Base URL for email links
 */
const settleOrders = async (userId, orderIds, session, app = null, skipBalanceDeduct = false, webUrl = '', paymentGateway = 'wallet') => {
  const user = await User.findById(userId).select('_id name email wallet_balance').session(session);
  if (!user) throw new Error('User not found.');

  for (const orderId of orderIds) {
    const order = await Order.findById(orderId).session(session);
    if (!order) continue;

    // Handle non-pending orders
    if (order.payment_status !== 'pending') {
      if (skipBalanceDeduct) {
        if (order.payment_status === 'failed') {
          // The order was prematurely marked failed (e.g. a transient verify response
          // called markCheckoutOrdersFailed before the gateway confirmed success).
          // The gateway is now confirming success — reset to pending and fall through
          // to settle normally so the order actually completes.
          order.payment_status = 'pending';
          order.order_status   = 'pending';
          await order.save({ session });
          // Fall through to normal settlement below
        } else {
          // Already fully paid — these are duplicate gateway funds.
          // Credit them back to the user's wallet so nothing is lost.
          await creditBalance(userId, order.total_amount, session);

          await Transaction.create([{
            user_id:     user._id,
            type:        'deposit',
            amount:      order.total_amount,
            reference:   genRef('ADJ'),
            status:      'completed',
            gateway:     paymentGateway,
            description: `Wallet credit (Order #${order._id.toString().slice(-6).toUpperCase()} already paid)`,
            order_id:    order._id,
          }], { session, ordered: true });
          continue;
        }
      } else {
        continue;
      }
    }

    if (!skipBalanceDeduct) {
      const debited = await debitBalance(userId, order.total_amount, session);
      if (!debited) throw new Error(`Insufficient wallet balance for order #${orderId.toString().slice(-4)}.`);
    }

    order.payment_status = 'paid';
    order.order_status = 'processing';
    await order.save({ session });

    await Transaction.create([{
      user_id: user._id,
      type: 'payment',
      amount: order.total_amount,
      reference: genRef('PAY'),
      status: 'completed',
      gateway: paymentGateway,
      description: `Payment for Order #${order._id.toString().slice(-6).toUpperCase()}`,
      order_id: order._id,
    }], { session, ordered: true });

    await handleVendorPayout(order, session);

    // Food orders that started as 'awaiting_payment' (gateway checkout):
    // Now that payment is confirmed, open the kitchen acceptance window.
    if (order.food_status === 'awaiting_payment') {
      const PlatformSettings = require('../../models/PlatformSettings.model');
      const ps = await PlatformSettings.getSettings();
      const timeoutMins = ps.food_acceptance_timeout_minutes ?? 30;
      order.food_status = 'pending_acceptance';
      order.acceptance_deadline = new Date(Date.now() + timeoutMins * 60 * 1000);
      order.status_logs = order.status_logs || [];
      order.status_logs.push({
        status:    'pending_acceptance',
        actor_id:  null,
        timestamp: new Date(),
        note:      'Payment confirmed via gateway — kitchen acceptance window opened.',
      });
      await order.save({ session });
    }

    // Keep bulk checkout settlement identical to single-order settlement.
    if (!order.food_status && order.shipping_method === 'logistics_partner' && order.logistics_company_id) {
      const quartier = order.shipping_address?.quartier;
      if (quartier) {
        const existing = await Shipment.findOne({ order_id: order._id }).session(session);
        if (!existing) {
          await logisticsService.createShipmentsForOrder(order, quartier, order.logistics_company_id, session);
        }
      }
    }

    // Background notifications per order
    if (app) {
      const vendor = await Vendor.findById(order.vendor_id);
      const orderObj = order.toObject();
      orderObj.vendor_id = vendor;
      const userSnap = { _id: user._id, name: user.name };

      setImmediate(async () => {
        try {
          // Fetch supporting data in parallel before dispatching notifications
          const [shipmentDoc, logisticsFirm] = await Promise.all([
            Shipment.findOne({ order_id: order._id }).lean(),
            (order.shipping_method === 'logistics_partner' && order.logistics_company_id)
              ? LogisticsCompany.findById(order.logistics_company_id)
              : Promise.resolve(null),
          ]);
          if (shipmentDoc) orderObj.shipment = shipmentDoc;
          orderObj.customer_name = userSnap.name;

          // Dispatch all notifications in parallel so no recipient waits on another
          const tasks = [
            sendNotification(app, userSnap._id, {
              title: 'Order Payment Confirmed',
              message: `Your payment for order #${order._id.toString().slice(-6).toUpperCase()} has been confirmed.`,
              type: 'order_status',
              metadata: { order_id: order._id, link: '/orders' },
              sendEmail: true, orderDetails: orderObj, role: 'customer', webUrl,
            }),
            notifyAdmins(app, {
              title: 'Order Payment Received',
              message: `Order #${order._id.toString().slice(-6).toUpperCase()} paid — ${userSnap.name || 'Customer'} · ${order.total_amount?.toLocaleString()} XAF`,
              type: 'system_alert',
              metadata: { order_id: order._id, link: '/admin/orders' },
              sendEmail: true,
            }),
          ];
          if (vendor) {
            tasks.push(sendNotification(app, vendor.user_id, {
              title: 'Order Paid & Confirmed',
              message: `Payment received for order #${order._id.toString().slice(-6).toUpperCase()}.`,
              type: 'order_status',
              metadata: { order_id: order._id, link: '/vendor/orders' },
              sendEmail: true, orderDetails: orderObj, role: 'vendor', webUrl,
            }));
          }
          if (logisticsFirm) {
            tasks.push(sendNotification(app, logisticsFirm.user_id, {
              title: 'New Shipment Assigned',
              message: `Order #${order._id.toString().slice(-6).toUpperCase()} is ready for pickup.`,
              type: 'logistics_update',
              sendEmail: true,
              role: 'logistics',
              webUrl,
              metadata: { order_id: order._id, link: '/logistics/manifests', status: shipmentDoc?.status || 'assigned' },
              orderDetails: { ...orderObj, logistics_name: logisticsFirm.company_name },
              emailLink: `${webUrl}/logistics/manifests`,
              overrideEmail: logisticsFirm.contact_email,
            }));
          }
          await Promise.all(tasks);

          // Push real-time balance update to vendor if they were credited immediately
          const vendorGotDirectPayout = !order.escrow_enabled && !order.new_restaurant_hold;
          const vendorGotTransitFee = order.shipping_method === 'intercity_agency' && !order.transit_fee_waived && order.transit_fee > 0;
          if (vendor && (vendorGotDirectPayout || vendorGotTransitFee)) {
            try {
              const io = app?.get?.('io');
              if (io) {
                const vRoom = vendor.user_id.toString();
                const payload = { type: 'payout', reference: order._id };
                io.to(vRoom).emit('wallet:credited', payload);
                io.to(`user:${vRoom}`).emit('wallet:credited', payload);
              }
            } catch (_) { /* non-critical */ }
          }
        } catch (e) {
          console.error('[settleOrders] bg notification error:', e.message);
        }
      });
    }
  }

  // Clear cart once all orders settled
  const cart = await Cart.findOne({ user_id: userId }).session(session);
  if (cart) {
    cart.items = [];
    await cart.save({ session });
  }

  console.log(`✅ [settle.service] Settled ${orderIds.length} order(s) for user ${userId}`);
};

/**
 * clawbackFoodRefund — Phase 3 Step 5 clawback
 *
 * For food orders (no escrow) the vendor was paid at capture. On refund:
 *   1. Debit the restaurant vendor's wallet by `refundAmount` (can go negative — Step 5 allows it)
 *   2. Credit the buyer's wallet by `refundAmount`
 *   3. Log two Transaction records for the audit trail
 *   4. Update the order's payment_status to 'refunded' and order_status to 'refunded'
 *
 * Called from dispute.controller.js when admin resolves with 'food_full_refund' or 'food_partial_refund'.
 *
 * @param {Object}  order           - Mongoose Order document (already fetched, within session)
 * @param {number}  refundAmount    - Amount to clawback in XAF (positive number)
 * @param {Object}  session         - Mongoose ClientSession
 * @param {string}  [reason]        - Human-readable reason for logs
 */
const clawbackFoodRefund = async (order, refundAmount, session, reason = 'Food order refund') => {
  if (!order || refundAmount <= 0) throw new Error('clawbackFoodRefund: invalid order or amount.');
  if (order.escrow_enabled) throw new Error('clawbackFoodRefund: called on an escrow order. Use finalizeEscrowPayout instead.');

  const vendorRecord = await Vendor.findById(order.vendor_id).session(session);
  if (!vendorRecord) throw new Error('clawbackFoodRefund: vendor record not found.');

  const ref = genRef('FOOD-CLBK');
  const orderLabel = `Order #${order._id.toString().slice(-6).toUpperCase()}`;

  // Atomic: debit vendor (allowNegative — vendor may have already spent the funds)
  //         credit buyer
  await Promise.all([
    debitBalance(vendorRecord.user_id, refundAmount, session, { allowNegative: true }),
    creditBalance(order.customer_id, refundAmount, session),
  ]);

  // Audit trail
  await Transaction.create([
    {
      user_id:     vendorRecord.user_id,
      type:        'payment',
      amount:      refundAmount,
      reference:   ref,
      status:      'completed',
      gateway:     'platform',
      description: `Clawback — ${reason} (${orderLabel})`,
      order_id:    order._id,
    },
    {
      user_id:     order.customer_id,
      type:        'refund',
      amount:      refundAmount,
      reference:   `${ref}-REF`,
      status:      'completed',
      gateway:     'platform',
      description: `Food order refund — ${reason} (${orderLabel})`,
      order_id:    order._id,
    },
  ], { session, ordered: true });

  // Update order state
  order.payment_status = 'refunded';
  order.order_status   = 'refunded';
  await order.save({ session });
};

/**
 * Release the new-restaurant hold on a food order.
 * Called when food_status transitions to 'delivered'.
 * Credits the vendor wallet and marks the pending Transaction as completed.
 *
 * @param {Object} order   — Mongoose Order document (within session)
 * @param {Object} session — Active mongoose session
 */
const releaseRestaurantHold = async (order, session) => {
  if (!order.new_restaurant_hold) return;

  // Use the vendorPayout that was captured at checkout — NOT a live recalculation.
  // The platform fee was pre-committed to platform_wallet_balance at capture time
  // (handleVendorPayout, new_restaurant_hold path). Recalculating with a drifted
  // commission rate would credit the vendor a different amount than the pending
  // transaction records, breaking the audit trail and the platform's balance.
  const pendingTxn = await Transaction.findOne({
    order_id: order._id,
    status:   'pending',
    reference: /^PAYOUT-HELD/,
  }).session(session);

  if (!pendingTxn) throw new Error(`releaseRestaurantHold: no held payout transaction found for order ${order._id}.`);

  const vendorPayout =
    pendingTxn.metadata?.platform_fee_breakdown?.vendor_payout ??
    pendingTxn.amount;

  const vendorRecord = await Vendor.findById(order.vendor_id).session(session);
  await creditBalance(vendorRecord.user_id, vendorPayout, session);

  // Mark the exact pending Transaction as completed, preserving the original amount
  await Transaction.findByIdAndUpdate(
    pendingTxn._id,
    { $set: { status: 'completed', description: `Held payout released on delivery — Order #${order._id.toString().slice(-6).toUpperCase()}` } },
    { session }
  );
};

module.exports = { settleOrder, settleOrders, handleVendorPayout, creditLogistics, clawbackFoodRefund, releaseRestaurantHold };
