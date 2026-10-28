/**
 * Rider accounts managed by delivery agencies.
 *
 * Agency (logistics role, own agency only):
 *   GET   /logistics/riders                 list riders + availability
 *   POST  /logistics/riders/invite          invite by email (creates the account if new)
 *   PATCH /logistics/riders/:riderId        activate / deactivate / vehicle
 * Rider (any signed-in user with a rider profile):
 *   GET   /riders/me                        my rider profile + agency
 *   POST  /riders/me/accept | /decline      answer an invitation
 *   PATCH /riders/me/availability           online / offline
 */
const mongoose = require('mongoose');
const RiderProfile = require('../models/RiderProfile.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const User = require('../models/User.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { isEnabled } = require('../utils/featureFlags');
const { sendNotification } = require('../utils/notifier');
const { recordAudit } = require('../utils/auditTrail');

const VEHICLES = ['motorcycle', 'bicycle', 'car', 'van', 'on_foot'];
const fail = (res, status, message) => res.status(status).json({ success: false, message });

const myAgency = (user) => LogisticsCompany.findOne({ user_id: user._id }).select('_id company_name').lean();

const riderView = (p) => ({
  id: p._id,
  user: p.user_id && typeof p.user_id === 'object' ? { id: p.user_id._id, name: p.user_id.name, email: p.user_id.email, avatar: p.user_id.avatar || null } : p.user_id,
  status: p.status,
  availability: p.availability,
  phone: p.phone,
  vehicle_type: p.vehicle_type,
  vehicle_plate: p.vehicle_plate,
  invited_at: p.invited_at,
  accepted_at: p.accepted_at,
  last_seen_at: p.last_location?.at || p.availability_changed_at || null,
});

const listRiders = async (req, res, next) => {
  try {
    const agency = await myAgency(req.user);
    if (!agency) return fail(res, 404, 'Set up your delivery agency first.');
    const riders = await RiderProfile.find({ agency_id: agency._id, status: { $ne: 'declined' } })
      .populate('user_id', 'name email avatar').sort({ status: 1, availability: -1, createdAt: -1 }).lean();
    const counts = riders.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      if (r.status === 'active' && r.availability !== 'offline') acc.online += 1;
      return acc;
    }, { online: 0 });
    res.json({ success: true, data: { riders: riders.map(riderView), counts } });
  } catch (err) { next(err); }
};

const inviteRider = async (req, res, next) => {
  try {
    if (!isEnabled(await PlatformSettings.getSettings(), 'rider_accounts')) return fail(res, 403, 'Rider accounts are not enabled yet.');
    const agency = await myAgency(req.user);
    if (!agency) return fail(res, 404, 'Set up your delivery agency first.');

    const email = String(req.body?.email || '').trim().toLowerCase();
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const phone = String(req.body?.phone || '').trim().slice(0, 20) || null;
    const vehicle_type = VEHICLES.includes(req.body?.vehicle_type) ? req.body.vehicle_type : 'motorcycle';
    const vehicle_plate = String(req.body?.vehicle_plate || '').trim().toUpperCase().slice(0, 20) || null;
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, 'Enter the rider’s email address. They sign in with a code sent there.');

    let user = await User.findOne({ email });
    if (user && ['admin', 'manager', 'logistics', 'vendor'].includes(user.role)) {
      return fail(res, 400, 'This account belongs to a business or staff user and cannot be added as a rider.');
    }
    if (!user) {
      if (!name) return fail(res, 400, 'Enter the rider’s name to create their account.');
      user = await User.create({ name, email, phone: phone || undefined, role: 'customer', auth_provider: 'email_otp' });
    }

    const existing = await RiderProfile.findOne({ user_id: user._id });
    if (existing && existing.agency_id.toString() !== agency._id.toString() && ['invited', 'active'].includes(existing.status)) {
      // Do not reveal which agency: just that this person is unavailable.
      return fail(res, 409, 'This person already rides for another agency.');
    }
    if (existing && existing.agency_id.toString() === agency._id.toString() && ['invited', 'active'].includes(existing.status)) {
      return fail(res, 409, existing.status === 'active' ? 'This person is already one of your riders.' : 'An invitation is already waiting for this person.');
    }

    const profile = existing || new RiderProfile({ user_id: user._id, agency_id: agency._id });
    Object.assign(profile, { agency_id: agency._id, status: 'invited', availability: 'offline', phone: phone || profile.phone, vehicle_type, vehicle_plate,
      invited_by: req.user._id, invited_at: new Date(), accepted_at: null, deactivated_at: null });
    await profile.save();

    await recordAudit({ actorId: req.user._id, action: 'rider_invited', targetType: 'RiderProfile', targetId: profile._id, after: { agency_id: agency._id, user_id: user._id } });
    sendNotification(req.app, user._id, {
      title: `${agency.company_name} invited you to deliver`,
      message: `${agency.company_name} wants to add you as a rider on Auradime. Open the Rider page to accept.`,
      type: 'logistics_update', metadata: { link: '/rider' }, sendEmail: true,
    }).catch((err) => console.error('[rider invite] notify:', err.message));

    await profile.populate('user_id', 'name email avatar');
    res.status(201).json({ success: true, data: { rider: riderView(profile.toObject()) } });
  } catch (err) { next(err); }
};

const updateRider = async (req, res, next) => {
  try {
    const agency = await myAgency(req.user);
    if (!agency) return fail(res, 404, 'Set up your delivery agency first.');
    if (!mongoose.isValidObjectId(req.params.riderId)) return fail(res, 404, 'Rider not found.');
    // Scoped to this agency: another agency's rider is simply "not found".
    const profile = await RiderProfile.findOne({ _id: req.params.riderId, agency_id: agency._id });
    if (!profile) return fail(res, 404, 'Rider not found.');

    const { status, vehicle_type, vehicle_plate } = req.body || {};
    const before = { status: profile.status };
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) return fail(res, 400, 'Status must be active or inactive.');
      if (status === 'active' && profile.status !== 'inactive') return fail(res, 400, 'Only a deactivated rider can be reactivated. New riders must accept their invitation.');
      if (status === 'inactive') { profile.deactivated_at = new Date(); profile.availability = 'offline'; }
      if (status === 'active') profile.deactivated_at = null;
      profile.status = status;
    }
    if (vehicle_type !== undefined) {
      if (!VEHICLES.includes(vehicle_type)) return fail(res, 400, 'Unknown vehicle type.');
      profile.vehicle_type = vehicle_type;
    }
    if (vehicle_plate !== undefined) profile.vehicle_plate = String(vehicle_plate).trim().toUpperCase().slice(0, 20) || null;
    await profile.save();
    if (status !== undefined) await recordAudit({ actorId: req.user._id, action: `rider_${status === 'active' ? 'reactivated' : 'deactivated'}`, targetType: 'RiderProfile', targetId: profile._id, before, after: { status: profile.status } });
    await profile.populate('user_id', 'name email avatar');
    res.json({ success: true, data: { rider: riderView(profile.toObject()) } });
  } catch (err) { next(err); }
};

const getMyRiderProfile = async (req, res, next) => {
  try {
    const profile = await RiderProfile.findOne({ user_id: req.user._id, status: { $in: ['invited', 'active', 'inactive'] } })
      .populate('agency_id', 'company_name logo contact_phone').lean();
    if (!profile) return res.json({ success: true, data: { rider: null } });
    res.json({ success: true, data: { rider: { ...riderView(profile), agency: profile.agency_id ? { id: profile.agency_id._id, name: profile.agency_id.company_name, logo: profile.agency_id.logo || null, phone: profile.agency_id.contact_phone || null } : null } } });
  } catch (err) { next(err); }
};

const answerInvite = (accept) => async (req, res, next) => {
  try {
    const profile = await RiderProfile.findOne({ user_id: req.user._id, status: 'invited' });
    if (!profile) return fail(res, 404, 'There is no invitation waiting.');
    if (accept) {
      profile.status = 'active';
      profile.accepted_at = new Date();
      profile.history.push({ agency_id: profile.agency_id, joined_at: new Date() });
    } else {
      profile.status = 'declined';
    }
    await profile.save();
    await recordAudit({ actorId: req.user._id, action: accept ? 'rider_invite_accepted' : 'rider_invite_declined', targetType: 'RiderProfile', targetId: profile._id, after: { status: profile.status } });
    res.json({ success: true, data: { status: profile.status } });
  } catch (err) { next(err); }
};

const setAvailability = async (req, res, next) => {
  try {
    const availability = req.body?.availability;
    if (!['online', 'offline'].includes(availability)) return fail(res, 400, 'Availability must be online or offline.');
    // Going offline forgets the last position: offline riders are not tracked.
    const update = availability === 'offline'
      ? { $set: { availability, availability_changed_at: new Date() }, $unset: { last_location: 1 } }
      : { $set: { availability, availability_changed_at: new Date() } };
    const profile = await RiderProfile.findOneAndUpdate({ user_id: req.user._id, status: 'active' }, update, { returnDocument: 'after' });
    if (!profile) return fail(res, 403, 'You are not an active rider.');
    // A rider coming online may be the one a waiting delivery needs.
    if (availability === 'online') {
      setImmediate(() => require('../services/riderDispatch.service').sweepUndispatched(req.app).catch((e) => console.error('[rider] dispatch:', e.message)));
    }
    res.json({ success: true, data: { availability: profile.availability } });
  } catch (err) { next(err); }
};

module.exports = { listRiders, inviteRider, updateRider, getMyRiderProfile, acceptInvite: answerInvite(true), declineInvite: answerInvite(false), setAvailability };
