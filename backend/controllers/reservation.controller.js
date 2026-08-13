/**
 * controllers/reservation.controller.js
 * Auradime — Dine-In Reservation CRUD
 *
 * Phase 3 Step 14
 *
 * Routes:
 *   POST   /api/reservations                  — buyer: create reservation
 *   GET    /api/reservations/my               — buyer: list own reservations
 *   GET    /api/reservations/vendor           — vendor: list incoming reservations
 *   PATCH  /api/reservations/:id/status       — vendor/admin: confirm, seat, complete, no_show
 *   DELETE /api/reservations/:id              — buyer or vendor: cancel
 */

const mongoose = require('mongoose');
const Reservation = require('../models/Reservation.model');
const Vendor      = require('../models/Vendor.model');
const RestaurantProfile = require('../models/RestaurantProfile.model');
const { sendNotification } = require('../utils/notifier');

// ─────────────────────────────────────────────
// @route   POST /api/reservations
// @access  Private (customer, vendor as buyer, logistics)
// ─────────────────────────────────────────────
const createReservation = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      vendor_id,
      slot_start,
      slot_end,
      party_size,
      contact_phone,
      notes,
      product_ids,
    } = req.body;

    if (!vendor_id || !slot_start || !slot_end || !party_size || !contact_phone) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'vendor_id, slot_start, slot_end, party_size, and contact_phone are required.' });
    }

    const vendor = await Vendor.findById(vendor_id).select('vendor_type user_id store_name').session(session).lean();
    if (!vendor || vendor.vendor_type !== 'restaurant') {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Restaurant not found.' });
    }

    const profile = await RestaurantProfile.findOne({ vendor_id }).select('accepts_scheduled is_accepting_orders').session(session).lean();
    if (!profile) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'This restaurant has not set up reservations yet.' });
    }

    if (!profile.accepts_scheduled) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ success: false, code: 'RESERVATIONS_DISABLED', message: 'This restaurant does not accept reservations.' });
    }

    const slotStart = new Date(slot_start);
    const slotEnd   = new Date(slot_end);

    if (slotStart <= new Date()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Slot must be in the future.' });
    }
    if (slotEnd <= slotStart) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'slot_end must be after slot_start.' });
    }

    const [reservation] = await Reservation.create([{
      vendor_id,
      customer_id:   req.user._id,
      slot_start:    slotStart,
      slot_end:      slotEnd,
      party_size:    Number(party_size),
      contact_phone,
      notes:         notes || null,
      product_ids:   product_ids || [],
    }], { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    // Notify restaurant
    setImmediate(async () => {
      try {
        await sendNotification(null, vendor.user_id, {
          title:   'New Reservation Request',
          message: `A reservation for ${party_size} on ${slotStart.toLocaleDateString()} has been requested.`,
          type:    'order_status',
          metadata: { target_id: reservation._id, link: `/vendor/reservations/${reservation._id}` },
        });
      } catch (_) {}
    });

    res.status(201).json({ success: true, data: { reservation } });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    if (error.code === 11000) {
      return res.status(409).json({ success: false, code: 'DOUBLE_BOOKING', message: 'That table is already booked for this time slot.' });
    }
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/reservations/my
// @access  Private (buyer)
// ─────────────────────────────────────────────
const getMyReservations = async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit    = 20;
    const status   = req.query.status;
    const filter   = { customer_id: req.user._id };
    if (status) filter.status = status;

    const [reservations, total] = await Promise.all([
      Reservation.find(filter)
        .populate('vendor_id', 'store_name logo_url')
        .sort({ slot_start: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Reservation.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, data: { reservations, total, page, total_pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/reservations/vendor
// @access  Private (vendor — restaurant only)
// ─────────────────────────────────────────────
const getVendorReservations = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ user_id: req.user._id }).select('_id vendor_type').lean();
    if (!vendor || vendor.vendor_type !== 'restaurant') {
      return res.status(403).json({ success: false, message: 'Restaurant vendors only.' });
    }

    const page   = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit  = 30;
    const status = req.query.status;
    const date   = req.query.date; // ISO date string for filtering by day

    const filter = { vendor_id: vendor._id };
    if (status) filter.status = status;
    if (date) {
      const day = new Date(date);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.slot_start = { $gte: day, $lt: nextDay };
    }

    const [reservations, total] = await Promise.all([
      Reservation.find(filter)
        .populate('customer_id', 'name phone')
        .sort({ slot_start: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Reservation.countDocuments(filter),
    ]);

    res.status(200).json({ success: true, data: { reservations, total, page, total_pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/reservations/:id/status
// @access  Private (vendor / admin)
// ─────────────────────────────────────────────
const updateReservationStatus = async (req, res, next) => {
  try {
    const { status, table_ref, note } = req.body;

    const VALID_VENDOR_TRANSITIONS = {
      confirmed: ['requested'],
      seated:    ['confirmed'],
      completed: ['seated'],
      no_show:   ['confirmed'],
      cancelled: ['requested', 'confirmed'],
    };

    if (!VALID_VENDOR_TRANSITIONS[status]) {
      return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
    }

    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ success: false, message: 'Reservation not found.' });

    // Auth check — must be the restaurant vendor or admin
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin) {
      const callerVendor = await Vendor.findOne({ user_id: req.user._id }).select('_id').lean();
      if (!callerVendor || callerVendor._id.toString() !== reservation.vendor_id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorised.' });
      }
    }

    if (!VALID_VENDOR_TRANSITIONS[status].includes(reservation.status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot transition from '${reservation.status}' to '${status}'.`,
      });
    }

    reservation.status = status;
    if (table_ref !== undefined) reservation.table_ref = table_ref;
    if (status === 'cancelled') {
      reservation.cancelled_by     = req.user._id;
      reservation.cancellation_reason = note || null;
      reservation.cancelled_at     = new Date();
    }
    await reservation.save();

    // Notify buyer of status changes they care about
    const notifMap = {
      confirmed: { title: 'Reservation Confirmed', message: `Your reservation for ${reservation.slot_start.toLocaleDateString()} has been confirmed!` },
      cancelled: { title: 'Reservation Cancelled', message: `Your reservation was cancelled${note ? ': ' + note : '.'}` },
      no_show:   null,
      seated:    null,
      completed: null,
    };
    const notif = notifMap[status];
    if (notif) {
      setImmediate(async () => {
        try {
          await sendNotification(null, reservation.customer_id, {
            ...notif, type: 'order_status',
            metadata: { target_id: reservation._id, link: `/reservations/${reservation._id}` },
          });
        } catch (_) {}
      });
    }

    res.status(200).json({ success: true, data: { reservation } });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────
// @route   DELETE /api/reservations/:id
// @access  Private (buyer who created it, or vendor, or admin)
// ─────────────────────────────────────────────
const cancelReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ success: false, message: 'Reservation not found.' });

    const isAdmin   = req.user.role === 'admin';
    const isBuyer   = reservation.customer_id.toString() === req.user._id.toString();
    const callerVendor = req.user.role === 'vendor'
      ? await Vendor.findOne({ user_id: req.user._id }).select('_id').lean()
      : null;
    const isVendor  = callerVendor && callerVendor._id.toString() === reservation.vendor_id.toString();

    if (!isAdmin && !isBuyer && !isVendor) {
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    }

    if (['completed', 'no_show', 'cancelled'].includes(reservation.status)) {
      return res.status(409).json({ success: false, message: `Cannot cancel a reservation with status '${reservation.status}'.` });
    }

    const { reason } = req.body;
    reservation.status               = 'cancelled';
    reservation.cancelled_by         = req.user._id;
    reservation.cancellation_reason  = reason || null;
    reservation.cancelled_at         = new Date();
    await reservation.save();

    // Notify the other party
    const notifyId = isBuyer ? reservation.vendor_id : reservation.customer_id;
    setImmediate(async () => {
      try {
        await sendNotification(null, notifyId, {
          title:   'Reservation Cancelled',
          message: `A reservation for ${reservation.slot_start.toLocaleDateString()} has been cancelled.`,
          type:    'system_alert',
        });
      } catch (_) {}
    });

    res.status(200).json({ success: true, message: 'Reservation cancelled.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReservation,
  getMyReservations,
  getVendorReservations,
  updateReservationStatus,
  cancelReservation,
};
