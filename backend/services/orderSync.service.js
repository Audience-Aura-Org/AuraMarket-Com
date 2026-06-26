/**
 * orderSync.service.js
 * Keeps Order.order_status, Shipment.status, and related fulfillment state aligned.
 */

const Shipment = require('../models/Shipment.model');
const Escrow = require('../models/Escrow.model');
const Order = require('../models/Order.model');
const Vendor = require('../models/Vendor.model');

const buildLog = (status, updatedBy, note) => ({
  status,
  updated_by: updatedBy || undefined,
  timestamp: new Date(),
  note: note || `Synced with order status.`,
});

/**
 * Sync all shipment tickets for an order to match its order_status.
 * Call inside a transaction when possible (pass session).
 */
async function syncShipmentsToOrderStatus(order, orderStatus, options = {}) {
  if (!order?._id || !orderStatus) return { modified: 0 };

  const { session, updatedBy, note } = options;
  const opts = session ? { session } : {};
  const baseFilter = { order_id: order._id };
  let result = { modified: 0 };

  switch (orderStatus) {
    case 'shipped':
      if (order.shipping_method === 'vendor_managed') {
        const r = await Shipment.updateMany(
          { ...baseFilter, status: { $in: ['pending', 'assigned'] } },
          {
            $set: { status: 'in_transit' },
            $push: {
              shipment_logs: buildLog(
                'in_transit',
                updatedBy,
                note || 'Vendor marked order as shipped.'
              ),
            },
          },
          opts
        );
        result.modified += r.modifiedCount || 0;
      }
      break;

    case 'delivered':
    case 'completed': {
      const r = await Shipment.updateMany(
        { ...baseFilter, status: { $nin: ['cancelled', 'delivered'] } },
        {
          $set: { status: 'delivered' },
          $push: {
            shipment_logs: buildLog(
              'delivered',
              updatedBy,
              note || `Order marked ${orderStatus}; shipment closed.`
            ),
          },
        },
        opts
      );
      result.modified += r.modifiedCount || 0;
      break;
    }

    case 'cancelled':
    case 'refunded': {
      const r = await Shipment.updateMany(
        { ...baseFilter, status: { $ne: 'cancelled' } },
        {
          $set: { status: 'cancelled' },
          $push: {
            shipment_logs: buildLog(
              'cancelled',
              updatedBy,
              note || `Order ${orderStatus}; shipment cancelled.`
            ),
          },
        },
        opts
      );
      result.modified += r.modifiedCount || 0;
      break;
    }

    default:
      break;
  }

  return result;
}

/**
 * Load order + shipments + escrow snapshot for API responses.
 */
async function getOrderFulfillmentSnapshot(orderId, session = null) {
  let orderQ = Order.findById(orderId);
  let shipQ = Shipment.find({ order_id: orderId }).populate('logistics_id', 'company_name contact_phone');
  let escrowQ = Escrow.findOne({ order_id: orderId }).select(
    'status vendor_confirmed customer_confirmed logistics_settled delivered_at auto_release_at release_date'
  );
  if (session) {
    orderQ = orderQ.session(session);
    shipQ = shipQ.session(session);
    escrowQ = escrowQ.session(session);
  }
  const [order, shipments, escrow] = await Promise.all([orderQ, shipQ, escrowQ]);
  return { order, shipments, escrow };
}

/**
 * Notify customer + vendor that fulfillment state changed (real-time UI refresh).
 */
function notifyOrderStatusChange(app, order, orderStatus, extra = {}) {
  if (!app || !order) return;

  const { sendNotification } = require('../utils/notifier');
  const shortId = order._id.toString().slice(-6).toUpperCase();
  const label = (orderStatus || 'updated').replace(/_/g, ' ');
  const meta = { order_id: order._id, link: `/orders/${order._id}`, ...extra.metadata };
  const roles = extra.roles || ['customer', 'vendor'];

  if (roles.includes('customer') && order.customer_id) {
    sendNotification(app, order.customer_id, {
      title: extra.title || `Order #${shortId} — ${label}`,
      message: extra.message || `Your order status is now ${label}.`,
      type: 'order_status',
      metadata: meta,
      orderDetails: order.toObject?.() || order,
      role: 'customer',
    });
  }

  if (roles.includes('vendor')) {
    Vendor.findById(order.vendor_id)
      .select('user_id')
      .then((vendor) => {
        if (!vendor?.user_id) return;
        sendNotification(app, vendor.user_id, {
          title: extra.vendorTitle || `Order #${shortId} — ${label}`,
          message: extra.vendorMessage || `Order status updated to ${label}.`,
          type: 'order_status',
          metadata: { ...meta, link: '/vendor/orders' },
          role: 'vendor',
        });
      })
      .catch(() => {});
  }
}

module.exports = {
  syncShipmentsToOrderStatus,
  getOrderFulfillmentSnapshot,
  notifyOrderStatusChange,
};
