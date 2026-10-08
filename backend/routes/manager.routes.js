/**
 * routes/manager.routes.js
 * Auradime — Manager Workspace Routes
 *
 * The manager's own space for cross-account operations.
 * All routes require JWT + 'manager' role + loadManagerScope.
 *
 * Mounted at /api/v1/manager
 *
 * Routes:
 *   /overview         — Dashboard KPIs & attention list
 *   /accounts         — All assigned accounts with task counts
 *   /tasks            — Unified task inbox
 *   /orders           — Cross-account orders
 *   /shipments        — Cross-account shipments
 *   /messages         — Cross-account messages
 *   /money            — Wallet balances & pending withdrawals
 *   /reports          — Revenue/order metrics
 *   /notes            — Notes & reminders
 *   /activity         — Activity log
 *   /invitations      — Invitation management
 *   /settings         — Notification preferences
 */

const express = require('express');
const router  = express.Router();

const {
  getOverview,
  getAccounts,
  getTasks,
  getOrders,
  getShipments,
  getMessages,
  getMoney,
  getReports,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  getActivity,
  getInvitations,
  sendInvitation,
  respondInvitation,
  getSettings,
  updateSettings,
} = require('../controllers/manager.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');
const { loadManagerScope }    = require('../middleware/delegate.middleware');

// ── Authentication Gate ──────────────────────
router.use(protect, restrictTo('manager'), loadManagerScope);

// ── Manager Space ────────────────────────────
router.get('/overview',   getOverview);
router.get('/accounts',   getAccounts);
router.get('/tasks',      getTasks);
router.get('/orders',     getOrders);
router.get('/shipments',  getShipments);
router.get('/messages',   getMessages);
router.get('/money',      getMoney);
router.get('/reports',    getReports);

// Notes & Reminders
router.get('/notes',          listNotes);
router.post('/notes',         createNote);
router.patch('/notes/:id',    updateNote);
router.delete('/notes/:id',   deleteNote);

// Activity Log
router.get('/activity', getActivity);

// Invitations
router.get('/invitations',          getInvitations);
router.post('/invitations',         sendInvitation);
router.post('/invitations/:id/respond', respondInvitation);

// Manager Preferences
router.get('/settings',   getSettings);
router.patch('/settings', updateSettings);

module.exports = router;
