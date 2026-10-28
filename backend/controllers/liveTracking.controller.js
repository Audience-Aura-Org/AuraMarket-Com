/**
 * Live rider position (feature flag `live_tracking`).
 *
 *   POST /riders/me/location            rider reports a GPS fix (only during a delivery)
 *   GET  /p2p/track/:trackingCode/live  signed-in parties of the shipment
 *   GET  /track/:token/live             holder of the secret tracking link
 */
const Shipment = require('../models/Shipment.model');
const links = require('../services/trackingLink.service');
const live = require('../services/liveTracking.service');
const { isShipmentParty } = require('../utils/trackingPrivacy');

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const SHIPMENT_FIELDS = '_id status booked_by other_party logistics_id';

const reportMyLocation = async (req, res, next) => {
  try {
    const r = await live.reportLocation(req.user._id, req.body);
    if (r.error) return fail(res, r.status, r.error);
    res.json({ success: true, data: { stored: r.stored } });
  } catch (err) { next(err); }
};

const liveByCode = async (req, res, next) => {
  try {
    const shipment = await Shipment.findOne({ tracking_code: String(req.params.trackingCode || '').toUpperCase(), type: { $in: ['p2p', 'agency'] } })
      .select(SHIPMENT_FIELDS).populate('logistics_id', 'user_id').lean();
    // Same answer for "missing" and "not yours", so codes cannot be probed.
    if (!shipment || !isShipmentParty(req.user, shipment)) return fail(res, 404, 'Shipment not found');
    res.json({ success: true, data: await live.liveForShipment(shipment) });
  } catch (err) { next(err); }
};

const liveByLink = async (req, res, next) => {
  try {
    const token = String(req.params.token || '');
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return fail(res, 404, 'This tracking link is not valid.');
    const shipment = await Shipment.findOne({ tracking_token_hash: links.hashToken(token) }).select(`${SHIPMENT_FIELDS} shipment_logs updatedAt`).lean();
    if (!shipment || links.isExpired(shipment)) return fail(res, 404, 'This tracking link is not valid.');
    res.json({ success: true, data: await live.liveForShipment(shipment) });
  } catch (err) { next(err); }
};

module.exports = { reportMyLocation, liveByCode, liveByLink };
