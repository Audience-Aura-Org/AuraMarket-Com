/**
 * Admin view of pay-on-delivery cash held by delivery agencies.
 *   GET  /admin/agency-settlements            → outstanding balance per agency
 *   GET  /admin/agency-settlements/:agencyId  → that agency's ledger entries
 *   POST /admin/agency-settlements/:agencyId/remittances → record cash paid back
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const AgencySettlement = require('../models/AgencySettlement.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const { recordAudit } = require('../utils/auditTrail');

const balances = async (match = {}) => {
  const rows = await AgencySettlement.aggregate([
    { $match: match },
    { $group: {
      _id: '$agency_id',
      collected: { $sum: { $cond: [{ $eq: ['$kind', 'collection'] }, '$amount_collected', 0] } },
      owed: { $sum: { $cond: [{ $eq: ['$kind', 'collection'] }, '$amount_due', 0] } },
      remitted: { $sum: { $cond: [{ $eq: ['$kind', 'remittance'] }, '$amount_due', 0] } },
      collections: { $sum: { $cond: [{ $eq: ['$kind', 'collection'] }, 1, 0] } },
      last_activity: { $max: '$createdAt' },
    } },
  ]);
  const agencies = await LogisticsCompany.find({ _id: { $in: rows.map((r) => r._id) } }).select('company_name contact_phone').lean();
  const names = new Map(agencies.map((a) => [a._id.toString(), a]));
  return rows
    .map((r) => ({ agency_id: r._id, agency: names.get(r._id.toString()) || null, collected: r.collected, owed: r.owed, remitted: r.remitted, outstanding: Math.max(0, r.owed - r.remitted), collections: r.collections, last_activity: r.last_activity }))
    .sort((a, b) => b.outstanding - a.outstanding);
};

const listAgencyBalances = async (req, res, next) => {
  try {
    const data = await balances();
    res.json({ success: true, data: { agencies: data, total_outstanding: data.reduce((sum, a) => sum + a.outstanding, 0) } });
  } catch (err) { next(err); }
};

const getAgencyLedger = async (req, res, next) => {
  try {
    const { agencyId } = req.params;
    if (!mongoose.isValidObjectId(agencyId)) return res.status(400).json({ success: false, message: 'Invalid agency.' });
    const [summary] = await balances({ agency_id: new mongoose.Types.ObjectId(agencyId) });
    const entries = await AgencySettlement.find({ agency_id: agencyId }).sort({ createdAt: -1 }).limit(200)
      .populate('order_id', 'total_amount createdAt').populate('shipment_id', 'tracking_code').lean();
    res.json({ success: true, data: { summary: summary || { agency_id: agencyId, collected: 0, owed: 0, remitted: 0, outstanding: 0 }, entries } });
  } catch (err) { next(err); }
};

const recordRemittance = async (req, res, next) => {
  try {
    const { agencyId } = req.params;
    const amount = Math.round(Number(req.body?.amount));
    if (!mongoose.isValidObjectId(agencyId)) return res.status(400).json({ success: false, message: 'Invalid agency.' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Enter the amount the agency paid back, in whole XAF.' });
    const [summary] = await balances({ agency_id: new mongoose.Types.ObjectId(agencyId) });
    const outstanding = summary?.outstanding || 0;
    if (amount > outstanding) return res.status(400).json({ success: false, message: `The agency only owes ${outstanding.toLocaleString()} XAF.` });

    const entry = await AgencySettlement.create({
      agency_id: agencyId, kind: 'remittance', amount_due: amount, status: 'settled',
      reference: `AURA-REMIT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      note: String(req.body?.note || '').slice(0, 300), recorded_by: req.user._id,
    });
    await recordAudit({ actorId: req.user._id, action: 'agency_remittance_recorded', targetType: 'LogisticsCompany', targetId: agencyId,
      before: { outstanding }, after: { outstanding: outstanding - amount }, meta: { amount, reference: entry.reference } });
    res.status(201).json({ success: true, data: { entry, outstanding: outstanding - amount } });
  } catch (err) { next(err); }
};

module.exports = { listAgencyBalances, getAgencyLedger, recordRemittance };
