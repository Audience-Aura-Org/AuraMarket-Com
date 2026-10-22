/**
 * controllers/manager.controller.js
 * Auradime — Manager Space Endpoints
 *
 * Cross-account overview for managers. All routes operate on
 * req.scope (built by loadManagerScope middleware).
 *
 * Endpoints:
 *   getOverview, getAccounts, getTasks, getOrders, getShipments,
 *   getMessages, getMoney, getReports, listNotes, createNote,
 *   updateNote, deleteNote, getActivity, getInvitations,
 *   sendInvitation, respondInvitation, getSettings, updateSettings
 */

const mongoose = require('mongoose');
const User              = require('../models/User.model');
const Order             = require('../models/Order.model');
const Shipment          = require('../models/Shipment.model');
const Message           = require('../models/Message.model');
const KYC               = require('../models/KYC.model');
const Dispute           = require('../models/Dispute.model');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const ManagerAssignment = require('../models/ManagerAssignment.model');
const ManagerNote       = require('../models/ManagerNote.model');
const ActivityLog       = require('../models/ActivityLog.model');
const Notification      = require('../models/Notification.model');

const { PERMISSIONS, DEFAULT_PERMISSIONS } = ManagerAssignment;

// ── Helpers ────────────────────────────────────────────────────────

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

const inScope = (scope, id) =>
  scope.userIds.some((u) => String(u) === String(id));

/** Parse an optional date; returns undefined when absent, null when invalid. */
const parseDate = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Order statuses that represent work waiting on the vendor.
const NEW_ORDER_STATUSES = ['placed'];
// Statuses excluded from revenue — the money never stayed with the vendor.
const NON_REVENUE_STATUSES = ['cancelled', 'refund_pending', 'refunded'];
// Dispute statuses that still need attention.
const OPEN_DISPUTE_STATUSES = ['pending', 'investigating'];

const revenueExpr = {
  $cond: [{ $in: ['$order_status', NON_REVENUE_STATUSES] }, 0, '$total_amount'],
};

/** Build a name map for assigned users. */
async function userMap(scope) {
  const users = await User.find(
    { _id: { $in: scope.userIds } },
    'name email role avatar wallet_balance'
  ).lean();
  return new Map(users.map((u) => [String(u._id), u]));
}

/** Shortcut: get user info from the map (returns {} if missing). */
const nm = (map, id) => map.get(String(id)) || {};

// ═══════════════════════════════════════════════════════════════════
//  Task Collection — aggregates pending work across all accounts
// ═══════════════════════════════════════════════════════════════════

async function collectTasks(scope, limit = 200) {
  const U = scope.userIds;

  const [orders, shipments, messages, kyc, disputes] = await Promise.all([
    // New orders waiting for managed vendors to accept
    Order.find({
      order_status: { $in: NEW_ORDER_STATUSES },
      vendor_id: { $in: scope.vendorIds },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean(),

    // Waiting shipments for managed logistics
    Shipment.find({
      status: { $in: ['pending', 'assigned'] },
      logistics_id: { $in: scope.logisticsIds },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean(),

    // Unread messages for managed users
    Message.find({
      read_status: false,
      receiver_id: { $in: U },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean(),

    // KYC needing attention
    KYC.find({
      status: { $in: ['rejected', 'pending'] },
      user_id: { $in: U },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean(),

    // Open disputes where managed user is the initiator
    Dispute.find({
      status: { $in: OPEN_DISPUTE_STATUSES },
      initiator_id: { $in: U },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean(),
  ]);

  const task = (type, userId, item, title, page) => ({
    type,
    id: item._id,
    userId: String(userId),
    title,
    at: item.createdAt,
    href: `/manager/as/${userId}/${page}`,
  });

  return [
    ...orders.map((x) =>
      task(
        'order',
        scope.vendorUser[String(x.vendor_id)],
        x,
        'New order to accept',
        'orders'
      )
    ),
    ...shipments.map((x) =>
      task(
        'shipment',
        scope.logisticsUser[String(x.logistics_id)],
        x,
        'Delivery waiting',
        'manifests'
      )
    ),
    ...messages.map((x) =>
      task('message', x.receiver_id, x, 'Unread message', 'messages')
    ),
    ...kyc.map((x) =>
      task('kyc', x.user_id, x, 'KYC needs fixing', 'dashboard')
    ),
    ...disputes.map((x) =>
      task('dispute', x.initiator_id, x, 'Open dispute', 'disputes')
    ),
  ]
    .filter((i) => i.userId && i.userId !== 'undefined')
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

// Shipment statuses that earned the logistics account nothing.
const NON_REVENUE_SHIPMENT_STATUSES = ['cancelled', 'failed'];
const URGENT_TASK_AGE_MS = 864e5; // 24h

/**
 * Per-account 30-day revenue/orders and pending withdrawals.
 * Vendors earn from orders, logistics accounts from shipments.
 * One aggregate per collection, mapped back to user ids.
 */
async function accountMetrics(scope) {
  const since = new Date(Date.now() - 30 * 864e5);
  const [orders, shipments, withdrawals] = await Promise.all([
    Order.aggregate([
      { $match: { vendor_id: { $in: scope.vendorIds }, createdAt: { $gte: since } } },
      { $group: { _id: '$vendor_id', orders: { $sum: 1 }, revenue: { $sum: revenueExpr } } },
    ]),
    Shipment.aggregate([
      { $match: { logistics_id: { $in: scope.logisticsIds }, createdAt: { $gte: since } } },
      {
        $group: {
          _id: '$logistics_id',
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $in: ['$status', NON_REVENUE_SHIPMENT_STATUSES] }, 0, { $ifNull: ['$price', 0] }],
            },
          },
        },
      },
    ]),
    WithdrawalRequest.aggregate([
      { $match: { requested_by: { $in: scope.userIds }, status: 'pending' } },
      { $group: { _id: '$requested_by', n: { $sum: 1 } } },
    ]),
  ]);

  const metrics = new Map();
  const add = (uid, fields) => {
    if (!uid) return;
    const m = metrics.get(uid) || { revenue30d: 0, orders30d: 0, pendingWithdrawals: 0 };
    metrics.set(uid, {
      revenue30d: m.revenue30d + (fields.revenue30d || 0),
      orders30d: m.orders30d + (fields.orders30d || 0),
      pendingWithdrawals: m.pendingWithdrawals + (fields.pendingWithdrawals || 0),
    });
  };
  orders.forEach((r) =>
    add(scope.vendorUser[String(r._id)], { revenue30d: r.revenue, orders30d: r.orders })
  );
  shipments.forEach((r) =>
    add(scope.logisticsUser[String(r._id)], { revenue30d: r.revenue, orders30d: r.orders })
  );
  withdrawals.forEach((r) => add(String(r._id), { pendingWithdrawals: r.n }));
  return metrics;
}

/** Account health from open tasks: urgent (dispute or >24h old), attention (any), else ok. */
function accountHealth(tasks, now = Date.now()) {
  const health = new Map();
  for (const t of tasks) {
    const urgent = t.type === 'dispute' || now - new Date(t.at).getTime() > URGENT_TASK_AGE_MS;
    if (urgent) health.set(t.userId, 'urgent');
    else if (health.get(t.userId) !== 'urgent') health.set(t.userId, 'attention');
  }
  return health;
}

// ═══════════════════════════════════════════════════════════════════
//  Overview — Manager dashboard
// ═══════════════════════════════════════════════════════════════════

exports.getOverview = async (req, res, next) => {
  try {
    const { scope } = req;
    const um = await userMap(scope);
    const tasks = await collectTasks(scope, 100);
    const now = new Date();
    const since = new Date(now - 30 * 864e5);
    const prevSince = new Date(now - 60 * 864e5);
    const trendFrom = new Date(now - 29 * 864e5);

    const periodTotals = (from, to) =>
      Order.aggregate([
        { $match: { vendor_id: { $in: scope.vendorIds }, createdAt: { $gte: from, $lt: to } } },
        { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: revenueExpr } } },
      ]);

    const [rev, prev, trend, wallets] = await Promise.all([
      periodTotals(since, new Date(now.getTime() + 1)),
      periodTotals(prevSince, since),
      dailyRevenue(scope.vendorIds, trendFrom, now),
      // Wallet balance is on User model, not a separate Wallet collection
      User.aggregate([
        { $match: { _id: { $in: scope.userIds } } },
        { $group: { _id: null, balance: { $sum: '$wallet_balance' } } },
      ]),
    ]);

    // Count tasks per account
    const perAccount = {};
    tasks.forEach(
      (t) => (perAccount[t.userId] = (perAccount[t.userId] || 0) + 1)
    );

    // Count tasks by type
    const byType = tasks.reduce(
      (c, t) => ({ ...c, [t.type]: (c[t.type] || 0) + 1 }),
      {}
    );

    ok(res, {
      totals: {
        accounts: scope.userIds.length,
        tasks: tasks.length,
        orders30d: rev[0]?.orders || 0,
        revenue30d: rev[0]?.revenue || 0,
        balance: wallets[0]?.balance || 0,
      },
      previous: {
        orders30d: prev[0]?.orders || 0,
        revenue30d: prev[0]?.revenue || 0,
      },
      trend: trend.map(({ date, revenue }) => ({ date, revenue })),
      byType,
      attention: Object.entries(perAccount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([id, n]) => ({
          id,
          name: nm(um, id).name,
          role: nm(um, id).role,
          tasks: n,
        })),
      recent: tasks
        .slice(0, 8)
        .map((t) => ({ ...t, account: nm(um, t.userId).name })),
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Accounts — All assigned accounts
// ═══════════════════════════════════════════════════════════════════

exports.getAccounts = async (req, res, next) => {
  try {
    const { scope } = req;
    const um = await userMap(scope);
    const tasks = await collectTasks(scope, 100);

    // Count tasks per account
    const count = {};
    tasks.forEach(
      (t) => (count[t.userId] = (count[t.userId] || 0) + 1)
    );

    // Last activity per account
    const [lastAct, metrics] = await Promise.all([
      ActivityLog.aggregate([
        { $match: { manager_id: req.user._id } },
        { $group: { _id: '$user_id', last: { $max: '$createdAt' } } },
      ]),
      accountMetrics(scope),
    ]);
    const la = new Map(lastAct.map((a) => [String(a._id), a.last]));
    const health = accountHealth(tasks);

    ok(
      res,
      scope.links.map((l) => {
        const uid = String(l.user_id);
        const u = nm(um, uid);
        const m = metrics.get(uid) || {};
        return {
          id: uid,
          name: u.name,
          email: u.email,
          role: u.role,
          avatar: u.avatar || null,
          permissions: l.permissions,
          expires_at: l.expires_at,
          tasks: count[uid] || 0,
          last_activity: la.get(uid) || null,
          revenue30d: m.revenue30d || 0,
          orders30d: m.orders30d || 0,
          balance: u.wallet_balance || 0,
          pendingWithdrawals: m.pendingWithdrawals || 0,
          health: health.get(uid) || 'ok',
        };
      })
    );
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Account Session — the managed user's profile for the workspace
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /manager/accounts/:id/session
 * Returns the assigned user's profile in the same shape as /auth/me so the
 * embedded vendor/logistics/customer pages can render as that account.
 */
exports.getAccountSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isId(id) || !inScope(req.scope, id))
      return fail(res, 404, 'Account not found.');

    const user = await User.findById(id)
      .select('-password -token_version -manager_settings')
      .lean();
    if (!user) return fail(res, 404, 'Account not found.');

    user.kyc = await KYC.findOne({ user_id: user._id })
      .sort('-updatedAt')
      .lean();

    ok(res, {
      user,
      permissions: req.scope.perms[String(id)] || {},
    });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Tasks — Unified task inbox across all accounts
// ═══════════════════════════════════════════════════════════════════

exports.getTasks = async (req, res, next) => {
  try {
    const um = await userMap(req.scope);
    let items = await collectTasks(req.scope);

    // Optional filters
    if (req.query.type) items = items.filter((i) => i.type === req.query.type);
    if (req.query.account)
      items = items.filter((i) => i.userId === req.query.account);

    ok(
      res,
      items
        .slice(0, 300)
        .map((i) => ({ ...i, account: nm(um, i.userId).name }))
    );
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Combined Lists — Orders, Shipments, Messages
// ═══════════════════════════════════════════════════════════════════

exports.getOrders = async (req, res, next) => {
  try {
    const um = await userMap(req.scope);
    const filter = { vendor_id: { $in: req.scope.vendorIds } };
    if (req.query.status) filter.order_status = String(req.query.status);
    if (req.query.account) {
      const vids = req.scope.vendorIds.filter(
        (v) => req.scope.vendorUser[String(v)] === req.query.account
      );
      filter.vendor_id = { $in: vids };
    }

    const rows = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    ok(
      res,
      rows.map((o) => {
        const uid = req.scope.vendorUser[String(o.vendor_id)];
        return {
          id: o._id,
          userId: uid,
          account: nm(um, uid).name,
          status: o.order_status,
          total: o.total_amount,
          at: o.createdAt,
          href: `/manager/as/${uid}/orders`,
        };
      })
    );
  } catch (err) {
    next(err);
  }
};

exports.getShipments = async (req, res, next) => {
  try {
    const um = await userMap(req.scope);
    const filter = { logistics_id: { $in: req.scope.logisticsIds } };
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.account) {
      filter.logistics_id = {
        $in: req.scope.logisticsIds.filter(
          (l) => req.scope.logisticsUser[String(l)] === String(req.query.account)
        ),
      };
    }

    const rows = await Shipment.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    ok(
      res,
      rows.map((s) => {
        const uid = req.scope.logisticsUser[String(s.logistics_id)];
        return {
          id: s._id,
          userId: uid,
          account: nm(um, uid).name,
          status: s.status,
          at: s.createdAt,
          href: `/manager/as/${uid}/deliveries`,
        };
      })
    );
  } catch (err) {
    next(err);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const um = await userMap(req.scope);
    const filter = {
      receiver_id: { $in: req.scope.userIds },
      deleted_everyone: { $ne: true },
    };
    if (req.query.unread === 'true') filter.read_status = false;
    if (req.query.account) {
      if (!isId(req.query.account) || !inScope(req.scope, req.query.account))
        return ok(res, []);
      filter.receiver_id = req.query.account;
    }

    const rows = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    ok(
      res,
      rows.map((m) => ({
        id: m._id,
        userId: String(m.receiver_id),
        account: nm(um, m.receiver_id).name,
        preview: String(m.text || '').slice(0, 90),
        unread: !m.read_status,
        at: m.createdAt,
        href: `/manager/as/${m.receiver_id}/messages`,
      }))
    );
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Money — Wallet balances & pending withdrawals
// ═══════════════════════════════════════════════════════════════════

exports.getMoney = async (req, res, next) => {
  try {
    const um = await userMap(req.scope);

    const [users, pending] = await Promise.all([
      // Wallet balance is on User model
      User.find(
        { _id: { $in: req.scope.userIds } },
        '_id wallet_balance'
      ).lean(),
      // Pending withdrawals
      WithdrawalRequest.aggregate([
        {
          $match: {
            requested_by: { $in: req.scope.userIds },
            status: 'pending',
          },
        },
        {
          $group: {
            _id: '$requested_by',
            n: { $sum: 1 },
            amount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const p = new Map(pending.map((x) => [String(x._id), x]));

    ok(
      res,
      users.map((u) => {
        const uid = String(u._id);
        return {
          userId: uid,
          account: nm(um, uid).name,
          balance: u.wallet_balance || 0,
          pendingWithdrawals: p.get(uid)?.n || 0,
          pendingAmount: p.get(uid)?.amount || 0,
          canManageMoney: Boolean(req.scope.perms[uid]?.money),
          href: `/manager/as/${uid}/wallet`,
        };
      })
    );
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Reports — Revenue/order metrics with date filtering
// ═══════════════════════════════════════════════════════════════════

const MAX_RANGE_DAYS = 366;

/** Parse ?from&to (default: last 30 days). Returns { from, to } or { error }. */
function parseRange(query) {
  const fromQ = parseDate(query.from);
  const toQ = parseDate(query.to);
  if (fromQ === null || toQ === null) return { error: 'Invalid date range.' };
  const from = fromQ || new Date(Date.now() - 30 * 864e5);
  const to = toQ || new Date();
  // A bare date for "to" means the whole day.
  if (toQ && /^\d{4}-\d{2}-\d{2}$/.test(String(query.to)))
    to.setUTCHours(23, 59, 59, 999);
  if (from > to) return { error: '"from" must be before "to".' };
  if (to - from > MAX_RANGE_DAYS * 864e5)
    return { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days.` };
  return { from, to };
}

/** Vendor ids for the report, optionally narrowed to one account; null when out of scope. */
function reportVendorIds(scope, account) {
  if (!account) return scope.vendorIds;
  if (!inScope(scope, account)) return null;
  return scope.vendorIds.filter((v) => scope.vendorUser[String(v)] === String(account));
}

const utcDay = (d) => d.toISOString().slice(0, 10);

/** Daily revenue/orders per UTC day from `from` to `to`, zero-filled. */
async function dailyRevenue(vendorIds, from, to) {
  const rows = await Order.aggregate([
    { $match: { vendor_id: { $in: vendorIds }, createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
        revenue: { $sum: revenueExpr },
        orders: { $sum: 1 },
      },
    },
  ]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const out = [];
  const day = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (; day <= to; day.setUTCDate(day.getUTCDate() + 1)) {
    const key = utcDay(day);
    out.push({ date: key, revenue: byDay.get(key)?.revenue || 0, orders: byDay.get(key)?.orders || 0 });
  }
  return out;
}

exports.getReportSeries = async (req, res, next) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return fail(res, 400, range.error);
    const vendorIds = reportVendorIds(req.scope, req.query.account);
    if (!vendorIds) return fail(res, 404, 'Not found');
    ok(res, await dailyRevenue(vendorIds, range.from, range.to));
  } catch (err) {
    next(err);
  }
};

exports.getReports = async (req, res, next) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return fail(res, 400, range.error);
    const { from, to } = range;
    const { scope } = req;
    const um = await userMap(scope);

    const vendorIds = reportVendorIds(scope, req.query.account);
    if (!vendorIds) return fail(res, 404, 'Not found');

    const rows = await Order.aggregate([
      {
        $match: {
          vendor_id: { $in: vendorIds },
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: '$vendor_id',
          orders: { $sum: 1 },
          revenue: { $sum: revenueExpr },
          delivered: {
            $sum: {
              $cond: [{ $in: ['$order_status', ['delivered', 'completed']] }, 1, 0],
            },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$order_status', 'cancelled'] }, 1, 0] },
          },
        },
      },
    ]);

    ok(
      res,
      rows.map((r) => {
        const uid = scope.vendorUser[String(r._id)];
        return {
          userId: uid,
          account: nm(um, uid).name,
          orders: r.orders,
          revenue: r.revenue,
          delivered: r.delivered,
          cancelled: r.cancelled,
          deliveredRate: r.orders ? r.delivered / r.orders : 0,
          cancelledRate: r.orders ? r.cancelled / r.orders : 0,
        };
      })
    );
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Notes & Reminders
// ═══════════════════════════════════════════════════════════════════

exports.listNotes = async (req, res, next) => {
  try {
    const f = { manager_id: req.user._id };
    if (req.query.account) {
      if (!isId(req.query.account)) return ok(res, []);
      f.user_id = req.query.account;
    }

    const notes = await ManagerNote.find(f)
      .sort({ done: 1, remind_at: 1, createdAt: -1 })
      .limit(200)
      .lean();

    ok(res, notes);
  } catch (err) {
    next(err);
  }
};

exports.createNote = async (req, res, next) => {
  try {
    const { user_id = null, body } = req.body;
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text) return fail(res, 400, 'Note body is required.');
    if (text.length > 2000)
      return fail(res, 400, 'Note is too long (max 2000 characters).');
    if (user_id && (!isId(user_id) || !inScope(req.scope, user_id)))
      return fail(res, 404, 'Account not found.');
    const remind_at = parseDate(req.body.remind_at);
    if (remind_at === null) return fail(res, 400, 'Invalid reminder date.');

    const note = await ManagerNote.create({
      manager_id: req.user._id,
      user_id: user_id || null,
      body: text,
      remind_at: remind_at || null,
    });
    ok(res, note);
  } catch (err) {
    next(err);
  }
};

exports.updateNote = async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, 'Note not found.');

    const update = {};
    if ('body' in req.body) {
      const text = typeof req.body.body === 'string' ? req.body.body.trim() : '';
      if (!text) return fail(res, 400, 'Note body is required.');
      if (text.length > 2000)
        return fail(res, 400, 'Note is too long (max 2000 characters).');
      update.body = text;
    }
    if ('done' in req.body) update.done = !!req.body.done;
    if ('remind_at' in req.body) {
      const remind_at = parseDate(req.body.remind_at);
      if (remind_at === null) return fail(res, 400, 'Invalid reminder date.');
      update.remind_at = remind_at || null;
    }

    const note = await ManagerNote.findOneAndUpdate(
      { _id: req.params.id, manager_id: req.user._id },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!note)
      return res
        .status(404)
        .json({ success: false, message: 'Note not found.' });
    ok(res, note);
  } catch (err) {
    next(err);
  }
};

exports.deleteNote = async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, 'Note not found.');
    await ManagerNote.deleteOne({
      _id: req.params.id,
      manager_id: req.user._id,
    });
    ok(res, true);
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Activity Log
// ═══════════════════════════════════════════════════════════════════

exports.getActivity = async (req, res, next) => {
  try {
    const f = { manager_id: req.user._id };
    if (req.query.account) {
      if (!isId(req.query.account)) return ok(res, []);
      f.user_id = req.query.account;
    }
    if (req.query.category) f.category = String(req.query.category);

    const um = await userMap(req.scope);
    const rows = await ActivityLog.find(f)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    ok(
      res,
      rows.map((a) => ({
        id: a._id,
        account: nm(um, a.user_id).name,
        userId: String(a.user_id),
        category: a.category,
        action: `${a.method} ${a.path}`,
        fields: (a.fields || []).join(', '),
        at: a.createdAt,
      }))
    );
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Invitations
// ═══════════════════════════════════════════════════════════════════

exports.getInvitations = async (req, res, next) => {
  try {
    const rows = await ManagerAssignment.find({
      manager_id: req.user._id,
      status: { $in: ['pending', 'declined'] },
    })
      .populate('user_id', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    ok(
      res,
      rows.map((r) => ({
        id: String(r._id),
        // incoming = the account owner asked this manager to manage them
        direction: r.initiated_by === 'user' ? 'incoming' : 'outgoing',
        userId: r.user_id?._id ? String(r.user_id._id) : null,
        email: r.user_id?.email || null,
        from: r.user_id?.name || null,
        role: r.user_id?.role || null,
        status: r.status,
        permissions: r.permissions,
        at: r.createdAt,
      }))
    );
  } catch (err) {
    next(err);
  }
};

exports.sendInvitation = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: 'Email is required.' });

    const u = await User.findOne({
      email,
      role: { $nin: ['admin', 'manager'] },
    }).lean();
    if (!u)
      return res.status(404).json({
        success: false,
        message: 'No account found with that email.',
      });

    try {
      await ManagerAssignment.create({
        manager_id: req.user._id,
        user_id: u._id,
        permissions: Object.fromEntries(
          PERMISSIONS.map((k) => [
            k,
            typeof req.body.permissions?.[k] === 'boolean'
              ? req.body.permissions[k]
              : DEFAULT_PERMISSIONS[k],
          ])
        ),
        status: 'pending',
        initiated_by: 'manager',
      });
    } catch (e) {
      if (e.code === 11000)
        return res.status(409).json({
          success: false,
          message: 'An active or pending assignment already exists.',
        });
      throw e;
    }

    // Notify the user about the invitation
    await Notification.create({
      recipient: u._id,
      title: 'Manager invitation',
      message: `${req.user.name} would like to manage your account.`,
      type: 'system_alert',
    }).catch(() => {});

    ok(res, true);
  } catch (err) {
    next(err);
  }
};

exports.respondInvitation = async (req, res, next) => {
  try {
    const link = await ManagerAssignment.findOne({
      _id: req.params.id,
      manager_id: req.user._id,
      status: 'pending',
      initiated_by: 'user',
    });
    if (!link)
      return res
        .status(404)
        .json({ success: false, message: 'Invitation not found.' });

    link.status = req.body.accept ? 'active' : 'declined';
    await link.save();

    // Notify the user
    await Notification.create({
      recipient: link.user_id,
      title: req.body.accept
        ? 'Manager accepted your invitation'
        : 'Manager declined your invitation',
      message: req.body.accept
        ? `${req.user.name} has accepted your invitation and can now manage your account.`
        : `${req.user.name} has declined your invitation.`,
      type: 'system_alert',
    }).catch(() => {});

    ok(res, true);
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Settings — Manager notification preferences
// ═══════════════════════════════════════════════════════════════════

exports.getSettings = async (req, res, next) => {
  try {
    const s = req.user.manager_settings || {};
    ok(res, {
      name: req.user.name,
      email: req.user.email,
      notify_email: s.notify_email !== false,
      notify_push: s.notify_push !== false,
      daily_digest: s.daily_digest === true,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    // Partial update: only booleans that were sent are changed.
    const $set = {};
    for (const key of ['notify_email', 'notify_push', 'daily_digest']) {
      if (typeof req.body[key] === 'boolean')
        $set[`manager_settings.${key}`] = req.body[key];
    }
    if (Object.keys($set).length)
      await User.updateOne({ _id: req.user._id }, { $set });
    ok(res, true);
  } catch (err) {
    next(err);
  }
};
