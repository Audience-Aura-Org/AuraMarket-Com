/**
 * Logistics reports and the admin live map.
 *
 *   GET /logistics/riders/report?days=30   agency: rider performance + dispatch quality
 *   GET /admin/logistics/live-map          admin: online riders and deliveries under way
 */
const LogisticsCompany = require('../models/LogisticsCompany.model');
const RiderProfile = require('../models/RiderProfile.model');
const Shipment = require('../models/Shipment.model');
const { agencyReport } = require('../services/riderReport.service');
const { pickupPoint } = require('../services/riderDispatch.service');

const FRESH_MS = 10 * 60 * 1000;
const UNDER_WAY = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'];

const riderReport = async (req, res, next) => {
  try {
    const agency = await LogisticsCompany.findOne({ user_id: req.user._id }).select('_id').lean();
    if (!agency) return res.status(404).json({ success: false, message: 'Set up your delivery agency first.' });
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    res.json({ success: true, data: await agencyReport(agency._id, { days }) });
  } catch (err) { next(err); }
};

const liveMap = async (req, res, next) => {
  try {
    const [profiles, shipments] = await Promise.all([
      RiderProfile.find({ status: 'active', availability: { $ne: 'offline' }, 'last_location.at': { $gte: new Date(Date.now() - FRESH_MS) } })
        .populate('user_id', 'name').populate('agency_id', 'company_name').select('user_id agency_id availability vehicle_type last_location').lean(),
      Shipment.find({ status: { $in: UNDER_WAY }, createdAt: { $gte: new Date(Date.now() - 3 * 864e5) } })
        .populate('logistics_id', 'company_name').select('tracking_code status type logistics_id rider_id pickup_address delivery_address createdAt').sort({ createdAt: -1 }).limit(300).lean(),
    ]);
    // Exact pins where customers confirmed one, else the quartier centre (flagged approximate).
    // Quartier lookups are shared within the request: most deliveries reuse a few quartiers.
    const centres = new Map();
    const pointOf = (a) => {
      if (a?.location?.lat != null) return pickupPoint(a);
      const key = String(a?.zone_id || a?.quartier || '').toLowerCase();
      if (!centres.has(key)) centres.set(key, pickupPoint(a));
      return centres.get(key);
    };
    const points = await Promise.all(shipments.map((s) => Promise.all([pointOf(s.pickup_address), pointOf(s.delivery_address)])));
    res.json({
      success: true,
      data: {
        riders: profiles.filter((p) => p.user_id).map((p) => ({
          rider_id: p.user_id._id, name: p.user_id.name, agency: p.agency_id?.company_name || null,
          availability: p.availability, vehicle_type: p.vehicle_type,
          lat: p.last_location.lat, lng: p.last_location.lng, at: p.last_location.at,
        })),
        deliveries: shipments.map((s, i) => ({
          id: s._id, tracking_code: s.tracking_code, status: s.status, type: s.type || 'order',
          agency: s.logistics_id?.company_name || null, has_rider: Boolean(s.rider_id),
          pickup: points[i][0] && { ...points[i][0], quartier: s.pickup_address?.quartier || null },
          dropoff: points[i][1] && { ...points[i][1], quartier: s.delivery_address?.quartier || null },
        })),
        generated_at: new Date(),
      },
    });
  } catch (err) { next(err); }
};

module.exports = { riderReport, liveMap };
