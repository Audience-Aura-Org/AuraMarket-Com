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

const { DEFAULT_PERMISSIONS } = ManagerAssignment;

// ── Helpers ────────────────────────────────────────────────────────

const ok = (res, data) => res.json({ success: true, data });

const inScope = (scope, id) =>
  scope.userIds.some((u) => String(u) === String(id));

/** Build a name map for assigned users. */
async function userMap(scope) {
  const users = await User.find(
    { _id: { $in: scope.userIds } },
    'name email role'
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
    // Pending orders for managed vendors
    Order.find({
      order_status: 'pending',
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
      status: 'open',
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
        'deliveries'
      )
    ),
    ...messages.map((x) =>
      task('message', x.receiver_id, x, 'Unread message', 'messages')
    ),
    ...kyc.map((x) =>
      task('kyc', x.user_id, x, 'KYC needs fixing', 'profile')
    ),
    ...disputes.map((x) =>
      task('dispute', x.initiator_id, x, 'Open dispute', 'messages')
    ),
  ]
    .filter((i) => i.userId && i.userId !== 'undefined')
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

// ═══════════════════════════════════════════════════════════════════
//  Overview — Manager dashboard
// ═══════════════════════════════════════════════════════════════════

exports.getOverview = async (req, res, next) => {
  try {
    const { scope } = req;
    const um = await userMap(scope);
    const tasks = await collectTasks(scope, 100);
    const since = new Date(Date.now() - 30 * 864e5);

    const [rev, wallets] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            vendor_id: { $in: scope.vendorIds },
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: { $sum: '$total_amount' },
          },
        },
      ]),
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
    const lastAct = await ActivityLog.aggregate([
      { $match: { manager_id: req.user._id } },
      { $group: { _id: '$user_id', last: { $max: '$createdAt' } } },
    ]);
    const la = new Map(lastAct.map((a) => [String(a._id), a.last]));

    ok(
      res,
      scope.links.map((l) => {
        const u = nm(um, l.user_id);
        return {
          id: String(l.user_id),
          name: u.name,
          email: u.email,
          role: u.role,
          permissions: l.permissions,
          expires_at: l.expires_at,
          tasks: count[String(l.user_id)] || 0,
          last_activity: la.get(String(l.user_id)) || null,
        };
      })
    );
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
    if (req.query.status) filter.order_status = req.query.status;
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
    if (req.query.status) filter.status = req.query.status;

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
    const filter = { receiver_id: { $in: req.scope.userIds } };
    if (req.query.unread === 'true') filter.read_status = false;

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

exports.getReports = async (req, res, next) => {
  try {
    const from = req.query.from
      ? new Date(req.query.from)
      : new Date(Date.now() - 30 * 864e5);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const { scope } = req;
    const um = await userMap(scope);

    let vendorIds = scope.vendorIds;
    if (req.query.account) {
      if (!inScope(scope, req.query.account))
        return res.status(404).json({ success: false, message: 'Not found' });
      vendorIds = vendorIds.filter(
        (v) => scope.vendorUser[String(v)] === req.query.account
      );
    }

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
          revenue: { $sum: '$total_amount' },
          delivered: {
            $sum: { $cond: [{ $eq: ['$order_status', 'delivered'] }, 1, 0] },
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
    if (req.query.account) f.user_id = req.query.account;

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
    const { user_id = null, body, remind_at = null } = req.body;
    if (!body?.trim())
      return res
        .status(400)
        .json({ success: false, message: 'Note body is required.' });
    if (user_id && !inScope(req.scope, user_id))
      return res
        .status(404)
        .json({ success: false, message: 'Account not found.' });

    const note = await ManagerNote.create({
      manager_id: req.user._id,
      user_id,
      body: body.trim(),
      remind_at,
    });
    ok(res, note);
  } catch (err) {
    next(err);
  }
};

exports.updateNote = async (req, res, next) => {
  try {
    const update = {};
    if (req.body.body) update.body = req.body.body;
    if ('done' in req.body) update.done = !!req.body.done;
    if ('remind_at' in req.body) update.remind_at = req.body.remind_at;

    const note = await ManagerNote.findOneAndUpdate(
      { _id: req.params.id, manager_id: req.user._id },
      { $set: update },
      { new: true }
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
    if (req.query.account) f.user_id = req.query.account;
    if (req.query.category) f.category = req.query.category;

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

    ok(res, rows);
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
        permissions: { ...DEFAULT_PERMISSIONS, ...(req.body.permissions || {}) },
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
    ok(res, {
      name: req.user.name,
      email: req.user.email,
      ...(req.user.manager_settings || {
        notify_email: true,
        notify_push: true,
        daily_digest: false,
      }),
    });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const { notify_email, notify_push, daily_digest } = req.body;
    await User.updateOne(
      { _id: req.user._id },
      {
        $set: {
          manager_settings: {
            notify_email: !!notify_email,
            notify_push: !!notify_push,
            daily_digest: !!daily_digest,
          },
        },
      }
    );
    ok(res, true);
  } catch (err) {
    next(err);
  }
};
