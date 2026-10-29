/**
 * Rider day, earnings and history; agency pay rate and rider payouts.
 *
 * Rider:
 *   GET   /riders/me/summary                  today, week, month, earnings owed, cash held
 *   GET   /riders/me/history?before&outcome&from&to
 * Agency (logistics role, own agency only):
 *   GET   /logistics/rider-pay                current pay rate
 *   PATCH /logistics/rider-pay                { mode: 'percent' | 'fixed', value }  (mode null clears it)
 *   POST  /logistics/riders/:riderId/payouts  { amount, note }  record paying a rider
 */
const mongoose = require('mongoose');
const RiderProfile = require('../models/RiderProfile.model');
const RiderPayout = require('../models/RiderPayout.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const earnings = require('../services/riderEarnings.service');
const { recordAudit } = require('../utils/auditTrail');
const { sendNotification } = require('../utils/notifier');

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const myAgency = (user) => LogisticsCompany.findOne({ user_id: user._id }).select('_id company_name rider_pay').lean();
// Riders keep seeing their figures after the agency switches them off.
const myProfile = (user) => RiderProfile.findOne({ user_id: user._id, status: { $in: ['active', 'inactive'] } }).select('agency_id').lean();

const riderSummary = async (req, res, next) => {
  try {
    const profile = await myProfile(req.user);
    if (!profile) return fail(res, 403, 'You are not a rider.');
    res.json({ success: true, data: await earnings.summary(req.user._id, profile.agency_id) });
  } catch (err) { next(err); }
};

const riderHistory = async (req, res, next) => {
  try {
    const profile = await myProfile(req.user);
    if (!profile) return fail(res, 403, 'You are not a rider.');
    const { before, outcome, from, to } = req.query;
    res.json({ success: true, data: await earnings.history(req.user._id, { before, outcome, from, to, limit: 20 }) });
  } catch (err) { next(err); }
};

const getRiderPay = async (req, res, next) => {
  try {
    const agency = await myAgency(req.user);
    if (!agency) return fail(res, 404, 'Set up your delivery agency first.');
    res.json({ success: true, data: { rider_pay: agency.rider_pay?.mode ? agency.rider_pay : null } });
  } catch (err) { next(err); }
};

const setRiderPay = async (req, res, next) => {
  try {
    const agency = await myAgency(req.user);
    if (!agency) return fail(res, 404, 'Set up your delivery agency first.');
    const { mode } = req.body || {};
    const value = Number(req.body?.value);
    let rider_pay = null;
    if (mode) {
      if (!['percent', 'fixed'].includes(mode)) return fail(res, 400, 'Choose a percentage of the delivery fee or a fixed amount.');
      if (!Number.isFinite(value) || value < 0 || (mode === 'percent' && value > 100) || (mode === 'fixed' && value > 100000)) {
        return fail(res, 400, mode === 'percent' ? 'Enter a percentage between 0 and 100.' : 'Enter an amount in XAF.');
      }
      rider_pay = { mode, value: mode === 'fixed' ? Math.round(value) : Math.round(value * 10) / 10 };
    }
    await LogisticsCompany.updateOne({ _id: agency._id }, rider_pay ? { $set: { rider_pay } } : { $unset: { rider_pay: 1 } });
    await recordAudit({ actorId: req.user._id, action: 'rider_pay_rate_changed', targetType: 'LogisticsCompany', targetId: agency._id, before: agency.rider_pay || null, after: rider_pay });
    res.json({ success: true, data: { rider_pay } });
  } catch (err) { next(err); }
};

const recordRiderPayout = async (req, res, next) => {
  try {
    const agency = await myAgency(req.user);
    if (!agency) return fail(res, 404, 'Set up your delivery agency first.');
    if (!mongoose.isValidObjectId(req.params.riderId)) return fail(res, 404, 'Rider not found.');
    const profile = await RiderProfile.findOne({ _id: req.params.riderId, agency_id: agency._id }).select('user_id').lean();
    if (!profile) return fail(res, 404, 'Rider not found.');
    const amount = Math.round(Number(req.body?.amount));
    if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, 'Enter the amount paid, in whole XAF.');
    const owed = (await earnings.owedByRider(agency._id))[profile.user_id.toString()]?.owed || 0;
    if (amount > owed) return fail(res, 400, `You owe this rider ${owed.toLocaleString('en-US')} XAF.`);
    const payout = await RiderPayout.create({ agency_id: agency._id, rider_id: profile.user_id, amount, note: String(req.body?.note || '').trim().slice(0, 200), recorded_by: req.user._id });
    await recordAudit({ actorId: req.user._id, action: 'rider_paid', targetType: 'RiderProfile', targetId: profile._id, before: { owed }, after: { owed: owed - amount }, meta: { amount, payout_id: payout._id } });
    sendNotification(req.app, profile.user_id, { title: 'You were paid', message: `${agency.company_name} recorded paying you ${amount.toLocaleString('en-US')} XAF for your deliveries.`, type: 'payout', metadata: { link: '/rider' } }).catch(() => {});
    res.status(201).json({ success: true, data: { owed: owed - amount } });
  } catch (err) { next(err); }
};

module.exports = { riderSummary, riderHistory, getRiderPay, setRiderPay, recordRiderPayout };
