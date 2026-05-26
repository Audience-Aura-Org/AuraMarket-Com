const mongoose = require('mongoose');
const Escrow = require('../models/Escrow.model');
const Order = require('../models/Order.model');
const Dispute = require('../models/Dispute.model');
const Shipment = require('../models/Shipment.model');
const { finalizeEscrowPayout, markEscrowDelivered, AUTO_RELEASE_WINDOW_MS } = require('../controllers/escrow.controller');

const ACTIVE_DISPUTE_STATUSES = ['pending', 'investigating'];
const RUN_INTERVAL_MS = 10 * 60 * 1000;
const BATCH_SIZE = 25;

let running = false;
let timer = null;

const getReleaseBaseTime = (escrow, order, shipment = null) => {
  if (escrow.delivered_at) return escrow.delivered_at;
  if (shipment?.status === 'delivered') {
    return shipment.proof_of_delivery?.timestamp || shipment.updatedAt || shipment.createdAt;
  }
  if (order?.order_status === 'delivered' || order?.order_status === 'completed') {
    return order.updatedAt || order.createdAt;
  }
  return null;
};

const autoReleaseEscrow = async ({ escrow, order, shipment = null, app }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const lockedEscrow = await Escrow.findOne({
      _id: escrow._id,
      status: { $in: ['held', 'pending_release'] },
    }).session(session);

    if (!lockedEscrow) {
      await session.abortTransaction();
      return false;
    }

    const lockedOrder = await Order.findById(order._id).session(session);
    const lockedShipment = shipment
      ? await Shipment.findById(shipment._id).session(session)
      : await Shipment.findOne({ order_id: order._id, status: 'delivered' }).sort('-updatedAt').session(session);
    const shipmentDelivered = lockedShipment?.status === 'delivered';

    if (!lockedOrder || (!shipmentDelivered && !['delivered', 'completed'].includes(lockedOrder.order_status))) {
      await session.abortTransaction();
      return false;
    }

    const activeDispute = await Dispute.exists({
      order_id: lockedOrder._id,
      status: { $in: ACTIVE_DISPUTE_STATUSES },
    }).session(session);

    if (activeDispute) {
      await session.abortTransaction();
      return false;
    }

    const baseTime = getReleaseBaseTime(lockedEscrow, lockedOrder, lockedShipment);
    if (!baseTime) {
      await session.abortTransaction();
      return false;
    }

    if (!lockedEscrow.delivered_at || !lockedEscrow.auto_release_at) {
      markEscrowDelivered(lockedEscrow, baseTime);
      await lockedEscrow.save({ session });
    }

    if (lockedEscrow.auto_release_at > new Date()) {
      await session.abortTransaction();
      return false;
    }

    if (shipmentDelivered && !['delivered', 'completed'].includes(lockedOrder.order_status)) {
      lockedOrder.order_status = 'delivered';
      await lockedOrder.save({ session });
    }

    await finalizeEscrowPayout(
      lockedEscrow,
      lockedOrder,
      {
        app,
        autoRelease: true,
        user: { _id: lockedEscrow.buyer_id },
      },
      session
    );

    await session.commitTransaction();
    return true;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    console.error('[escrowAutoRelease] release failed:', error.message);
    return false;
  } finally {
    session.endSession();
  }
};

const processEscrowAutoReleases = async (app) => {
  if (running) return { processed: 0, skipped: true };
  running = true;
  let processed = 0;

  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - AUTO_RELEASE_WINDOW_MS);
    const candidates = await Escrow.find({
      status: { $in: ['held', 'pending_release'] },
      $or: [
        { auto_release_at: { $lte: now } },
        { delivered_at: { $lte: cutoff } },
        { delivered_at: null },
        { delivered_at: { $exists: false } },
      ],
    })
      .sort('delivered_at createdAt')
      .limit(BATCH_SIZE);

    for (const escrow of candidates) {
      const order = await Order.findById(escrow.order_id).select('order_status updatedAt createdAt');
      if (!order) continue;
      const shipment = await Shipment.findOne({ order_id: order._id, status: 'delivered' }).sort('-updatedAt');

      const baseTime = getReleaseBaseTime(escrow, order, shipment);
      if (!baseTime || new Date(baseTime).getTime() + AUTO_RELEASE_WINDOW_MS > now.getTime()) continue;

      const activeDispute = await Dispute.exists({
        order_id: order._id,
        status: { $in: ACTIVE_DISPUTE_STATUSES },
      });
      if (activeDispute) continue;

      const released = await autoReleaseEscrow({ escrow, order, shipment, app });
      if (released) processed += 1;
    }
  } catch (error) {
    console.error('[escrowAutoRelease] scan failed:', error.message);
  } finally {
    running = false;
  }

  return { processed, skipped: false };
};

const startEscrowAutoReleaseWorker = (app) => {
  if (timer || process.env.DISABLE_ESCROW_AUTO_RELEASE === 'true') return;

  setTimeout(() => {
    processEscrowAutoReleases(app).catch((error) => {
      console.error('[escrowAutoRelease] initial run failed:', error.message);
    });
  }, 30 * 1000);

  timer = setInterval(() => {
    processEscrowAutoReleases(app).catch((error) => {
      console.error('[escrowAutoRelease] interval failed:', error.message);
    });
  }, RUN_INTERVAL_MS);

  if (timer.unref) timer.unref();
};

module.exports = {
  processEscrowAutoReleases,
  startEscrowAutoReleaseWorker,
};
