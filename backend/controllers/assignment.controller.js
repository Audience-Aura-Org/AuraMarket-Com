/**
 * controllers/assignment.controller.js
 * Auradime — Manager ↔ User Assignment Management
 *
 * Admin-side:
 *   listManagers, assignUsersToManager, unassignUsersFromManager,
 *   transferAccounts, getManagerAssignments
 *
 * User-side:
 *   getMyManagers, inviteManager, respondToInvite,
 *   updateMyManagerPermissions, revokeMyManager
 *
 * Utility:
 *   revokeAllForManager (used when demoting a manager)
 */

const mongoose = require('mongoose');
const User              = require('../models/User.model');
const ManagerAssignment = require('../models/ManagerAssignment.model');
const Notification      = require('../models/Notification.model');
const { logAction }     = require('./audit.controller');

const { PERMISSIONS, DEFAULT_PERMISSIONS } = ManagerAssignment;

const MAX_IDS = 500;
const OPEN    = ['pending', 'active'];
const isId    = (v) => mongoose.Types.ObjectId.isValid(v);

/** Sanitise incoming permissions — unknown keys are dropped, missing keys get defaults. */
const cleanPerms = (p = {}) =>
  Object.fromEntries(
    PERMISSIONS.map((k) => [
      k,
      typeof p[k] === 'boolean' ? p[k] : DEFAULT_PERMISSIONS[k],
    ])
  );

/** Fire-and-forget notification. */
const notify = (recipientId, title, message) =>
  Notification.create({
    recipient: recipientId,
    title,
    message,
    type: 'system_alert',
  }).catch(() => {});

// ═══════════════════════════════════════════════════════════════════
//  ADMIN-SIDE — called from admin routes
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /admin/managers — List all managers with assignment count.
 */
exports.listManagers = async (req, res, next) => {
  try {
    const managers = await User.find(
      { role: 'manager' },
      'name email avatar'
    ).lean();

    const counts = await ManagerAssignment.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$manager_id', n: { $sum: 1 } } },
    ]);
    const m = new Map(counts.map((c) => [String(c._id), c.n]));

    res.json({
      success: true,
      data: managers.map((x) => ({
        ...x,
        accounts: m.get(String(x._id)) || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/managers/:managerId/assign
 * Body: { userIds: [...], permissions?: {...}, expires_at?: Date, require_consent?: boolean }
 */
exports.assignUsersToManager = async (req, res, next) => {
  try {
    const { managerId } = req.params;
    const {
      userIds = [],
      permissions,
      expires_at = null,
      require_consent = false,
    } = req.body;

    if (!Array.isArray(userIds) || !userIds.length || userIds.length > MAX_IDS)
      return res
        .status(400)
        .json({ success: false, message: `Provide 1-${MAX_IDS} userIds.` });

    const manager =
      isId(managerId) &&
      (await User.findOne({ _id: managerId, role: 'manager' }).lean());
    if (!manager)
      return res
        .status(404)
        .json({ success: false, message: 'Manager not found.' });

    const out = { assigned: [], skipped: [], rejected: [] };
    const unique = [...new Set(userIds.map(String))];
    const users = await User.find(
      { _id: { $in: unique.filter(isId) } },
      '_id role'
    ).lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    for (const id of unique) {
      const u = byId.get(id);
      if (!u) {
        out.rejected.push({ id, reason: 'not_found' });
        continue;
      }
      if (['admin', 'manager'].includes(u.role)) {
        out.rejected.push({ id, reason: 'role_not_assignable' });
        continue;
      }
      try {
        const targetStatus = require_consent ? 'pending' : 'active';
        const perms = cleanPerms(permissions);

        // First: revoke any old revoked/declined/expired assignments
        // so they don't block a fresh assignment.
        await ManagerAssignment.updateMany(
          {
            manager_id: managerId,
            user_id: id,
            status: { $in: ['revoked', 'declined', 'expired'] },
          },
          { $set: { status: 'revoked' } }
        );

        // Atomic upsert: creates if no open assignment exists,
        // UPDATES (activates + sets permissions) if one does.
        // $set runs on both insert and update.
        await ManagerAssignment.findOneAndUpdate(
          { manager_id: managerId, user_id: id, status: { $in: OPEN } },
          {
            $set: {
              status: targetStatus,
              permissions: perms,
              assigned_by: req.user._id,
              ...(expires_at !== undefined ? { expires_at } : {}),
            },
            $setOnInsert: {
              manager_id: managerId,
              user_id: id,
              initiated_by: 'admin',
            },
          },
          { upsert: true, new: true }
        );
        out.assigned.push(id);
      } catch (e) {
        if (e.code === 11000)
          out.skipped.push({ id, reason: 'duplicate' });
        else throw e;
      }
    }

    // Audit
    await logAction(
      req.user._id,
      'manager.assign',
      'manager',
      managerId,
      out
    );

    // Notifications
    await Promise.all(
      out.assigned.map((id) =>
        notify(id, 'Manager assigned', 'A manager has been assigned to your account by an admin.')
      )
    );
    if (out.assigned.length) {
      await notify(
        managerId,
        'Accounts assigned',
        `${out.assigned.length} account(s) have been assigned to you.`
      );
    }

    res.json({ success: true, data: out });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/managers/:managerId/unassign
 * Body: { userIds: [...] }
 */
exports.unassignUsersFromManager = async (req, res, next) => {
  try {
    const { managerId } = req.params;
    const ids = (req.body.userIds || []).filter(isId).slice(0, MAX_IDS);

    const r = await ManagerAssignment.updateMany(
      {
        manager_id: managerId,
        user_id: { $in: ids },
        status: { $in: OPEN },
      },
      {
        $set: {
          status: 'revoked',
          revoked_at: new Date(),
          revoked_by: req.user._id,
        },
      }
    );

    await logAction(
      req.user._id,
      'manager.unassign',
      'manager',
      managerId,
      { ids, revoked: r.modifiedCount }
    );

    await Promise.all(
      ids.map((id) =>
        notify(id, 'Manager removed', 'A manager has been removed from your account.')
      )
    );

    res.json({ success: true, data: { revoked: r.modifiedCount } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /admin/assignments/transfer
 * Body: { fromManagerId, toManagerId, userIds?: [...] }
 */
exports.transferAccounts = async (req, res, next) => {
  try {
    const { fromManagerId, toManagerId, userIds } = req.body;

    if (fromManagerId === toManagerId)
      return res
        .status(400)
        .json({ success: false, message: 'Source and target are the same manager.' });

    const to =
      isId(toManagerId) &&
      (await User.findOne({ _id: toManagerId, role: 'manager' }).lean());
    if (!to)
      return res
        .status(404)
        .json({ success: false, message: 'Target manager not found.' });

    const filter = { manager_id: fromManagerId, status: 'active' };
    if (Array.isArray(userIds) && userIds.length)
      filter.user_id = { $in: userIds.filter(isId) };

    const links = await ManagerAssignment.find(filter).lean();

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Revoke old assignments
        await ManagerAssignment.updateMany(
          { _id: { $in: links.map((l) => l._id) } },
          {
            $set: {
              status: 'revoked',
              revoked_at: new Date(),
              revoked_by: req.user._id,
            },
          },
          { session }
        );

        // Create new assignments under target manager
        for (const l of links) {
          await ManagerAssignment.updateOne(
            {
              manager_id: toManagerId,
              user_id: l.user_id,
              status: { $in: OPEN },
            },
            {
              $setOnInsert: {
                manager_id: toManagerId,
                user_id: l.user_id,
                permissions: l.permissions,
                status: 'active',
                initiated_by: 'admin',
                assigned_by: req.user._id,
              },
            },
            { upsert: true, session }
          );
        }
      });
    } finally {
      session.endSession();
    }

    await logAction(
      req.user._id,
      'manager.transfer',
      'manager',
      fromManagerId,
      { to: toManagerId, count: links.length }
    );

    await Promise.all([
      notify(
        fromManagerId,
        'Accounts transferred',
        `${links.length} account(s) have been transferred to another manager.`
      ),
      notify(
        toManagerId,
        'Accounts received',
        `${links.length} account(s) have been transferred to you.`
      ),
    ]);

    res.json({ success: true, data: { transferred: links.length } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /admin/managers/:managerId/assignments
 */
exports.getManagerAssignments = async (req, res, next) => {
  try {
    const rows = await ManagerAssignment.find({
      manager_id: req.params.managerId,
      status: { $in: OPEN },
    })
      .populate('user_id', 'name email role avatar')
      .lean();

    res.json({ success: true, data: { assignments: rows } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /admin/assignments/:assignmentId/permissions
 * Body: { permissions: { products: true, money: false, ... } }
 */
exports.adminUpdatePermissions = async (req, res, next) => {
  try {
    const link = await ManagerAssignment.findOne({
      _id: req.params.assignmentId,
      status: { $in: OPEN },
    });
    if (!link)
      return res
        .status(404)
        .json({ success: false, message: 'Assignment not found.' });

    link.permissions = cleanPerms({
      ...(link.permissions?.toObject?.() || link.permissions),
      ...req.body.permissions,
    });
    await link.save();

    await logAction(
      req.user._id,
      'admin.update_assignment_permissions',
      'assignment',
      link._id,
      link.permissions
    );

    res.json({ success: true, data: link.permissions });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  USER-SIDE — any authenticated user manages their managers
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /my-managers — list managers assigned to the current user.
 */
exports.getMyManagers = async (req, res, next) => {
  try {
    const rows = await ManagerAssignment.find({
      user_id: req.user._id,
      status: { $in: OPEN },
    })
      .populate('manager_id', 'name email')
      .lean();

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /my-managers/invite — user invites a manager by email.
 * Body: { email, permissions?: {...} }
 */
exports.inviteManager = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: 'Email is required.' });

    const mgr = await User.findOne({ email, role: 'manager' }).lean();
    if (!mgr)
      return res
        .status(404)
        .json({ success: false, message: 'No manager found with that email.' });

    try {
      await ManagerAssignment.create({
        manager_id: mgr._id,
        user_id: req.user._id,
        permissions: cleanPerms(req.body.permissions),
        status: 'pending',
        initiated_by: 'user',
      });
    } catch (e) {
      if (e.code === 11000)
        return res.json({
          success: true,
          message: 'Invitation already exists.',
        });
      throw e;
    }

    await notify(
      mgr._id,
      'Management invitation',
      `${req.user.name} has invited you to manage their account.`
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /invites/:assignmentId/respond — user accepts or declines.
 * Body: { accept: boolean }
 */
exports.respondToInvite = async (req, res, next) => {
  try {
    const link = await ManagerAssignment.findOne({
      _id: req.params.assignmentId,
      user_id: req.user._id,
      status: 'pending',
      initiated_by: { $in: ['manager', 'admin'] },
    });
    if (!link)
      return res
        .status(404)
        .json({ success: false, message: 'Invitation not found.' });

    link.status = req.body.accept ? 'active' : 'declined';
    await link.save();

    await logAction(
      req.user._id,
      req.body.accept ? 'invite.accept' : 'invite.decline',
      'assignment',
      link._id
    );

    await notify(
      link.manager_id,
      req.body.accept ? 'Invitation accepted' : 'Invitation declined',
      req.body.accept
        ? `${req.user.name} has accepted your management invitation.`
        : `${req.user.name} has declined your management invitation.`
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /my-managers/:assignmentId/permissions — user updates what the manager may do.
 * Body: { permissions: { products: true, money: false, ... } }
 */
exports.updateMyManagerPermissions = async (req, res, next) => {
  try {
    const link = await ManagerAssignment.findOne({
      _id: req.params.assignmentId,
      user_id: req.user._id,
      status: { $in: OPEN },
    });
    if (!link)
      return res
        .status(404)
        .json({ success: false, message: 'Assignment not found.' });

    link.permissions = cleanPerms({
      ...(link.permissions?.toObject?.() || link.permissions),
      ...req.body.permissions,
    });
    await link.save();

    await logAction(
      req.user._id,
      'user.update_manager_permissions',
      'assignment',
      link._id,
      link.permissions
    );

    await notify(
      link.manager_id,
      'Permissions updated',
      `${req.user.name} has updated your permissions on their account.`
    );

    res.json({ success: true, data: link.permissions });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /my-managers/:assignmentId/revoke — user removes a manager.
 */
exports.revokeMyManager = async (req, res, next) => {
  try {
    const link = await ManagerAssignment.findOne({
      _id: req.params.assignmentId,
      user_id: req.user._id,
      status: { $in: OPEN },
    });
    if (!link) return res.json({ success: true }); // safe to call twice

    Object.assign(link, {
      status: 'revoked',
      revoked_at: new Date(),
      revoked_by: req.user._id,
    });
    await link.save();

    await logAction(
      req.user._id,
      'user.revoke_manager',
      'assignment',
      link._id
    );

    await notify(
      link.manager_id,
      'Access revoked',
      `${req.user.name} has revoked your management access.`
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Utility — used by demotion flow
// ═══════════════════════════════════════════════════════════════════

/**
 * Revoke all open assignments for a manager (used when demoting).
 */
exports.revokeAllForManager = (managerId, byId) =>
  ManagerAssignment.updateMany(
    { manager_id: managerId, status: { $in: OPEN } },
    {
      $set: {
        status: 'revoked',
        revoked_at: new Date(),
        revoked_by: byId,
      },
    }
  );
