/**
 * routes/reservation.routes.js
 * Auradime — Dine-In Reservation Routes (Phase 3 Step 14)
 *
 *   POST   /api/reservations              — create reservation (buyer)
 *   GET    /api/reservations/my           — list own reservations (buyer)
 *   GET    /api/reservations/vendor       — incoming reservations (vendor)
 *   PATCH  /api/reservations/:id/status   — confirm / seat / complete / no_show (vendor)
 *   DELETE /api/reservations/:id          — cancel (buyer or vendor)
 */

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth.middleware');
const {
  createReservation,
  getMyReservations,
  getVendorReservations,
  updateReservationStatus,
  cancelReservation,
} = require('../controllers/reservation.controller');

router.use(protect);

router.post('/',                      restrictTo('customer', 'vendor', 'logistics'), createReservation);
router.get('/my',                     restrictTo('customer', 'vendor', 'logistics'), getMyReservations);
router.get('/vendor',                 restrictTo('vendor'),                          getVendorReservations);
router.patch('/:id/status',           restrictTo('vendor', 'admin'),                 updateReservationStatus);
router.delete('/:id',                 cancelReservation); // auth checked inside handler

module.exports = router;
