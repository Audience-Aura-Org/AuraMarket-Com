/**
 * Packages an agency registers itself (not marketplace orders), plus secure
 * tracking links for any of the agency's shipments.
 *
 *   POST /logistics/packages                    register a package (flag: agency_packages)
 *   POST /logistics/shipments/:id/tracking-link  new shareable link (replaces the old one)
 *   GET  /track/:token                           public tracking by link (rate-limited)
 */
const mongoose = require('mongoose');
const Shipment = require('../models/Shipment.model');
const LogisticsCompany = require('../models/LogisticsCompany.model');
const LogisticZone = require('../models/LogisticZone.model');
const PlatformSettings = require('../models/PlatformSettings.model');
const { generateTrackingCode } = require('../services/logistics.service');
const links = require('../services/trackingLink.service');
const { isEnabled } = require('../utils/featureFlags');
const { confirmedPoint } = require('../utils/geoPoint');
const { isShipmentParty, redactShipmentForPublic } = require('../utils/trackingPrivacy');
const { isDistance, priceDelivery } = require('../services/pricing.service');
const { recordAudit } = require('../utils/auditTrail');

const CATEGORIES = ['document', 'fragile', 'food', 'electronics', 'clothing', 'household', 'other'];
const WEIGHTS = ['light', 'medium', 'heavy', 'extra_heavy'];
const ARRANGEMENTS = ['paid_to_agency', 'pay_on_delivery', 'agency_account'];
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** "677 12 34 56" → "237677123456" for wa.me links; null when it is not a Cameroon mobile. */
const waNumber = (phone) => {
  const d = String(phone || '').replace(/\D/g, '').replace(/^00/, '');
  const local = d.startsWith('237') ? d.slice(3) : d;
  return /^6\d{8}$/.test(local) ? `237${local}` : null;
};

const shareBundle = (shipment, token, agencyName) => {
  const link = links.linkFor(token);
  const message = links.whatsappText({ agencyName, reference: shipment.agency_package?.reference || shipment.tracking_code, link, recipientName: shipment.other_party?.name?.split(' ')[0] });
  const to = waNumber(shipment.other_party?.phone);
  return { tracking_link: link, whatsapp_text: message, whatsapp_url: `https://wa.me/${to || ''}?text=${encodeURIComponent(message)}` };
};

/** The agency's own district price for a destination quartier (or one of its parents). */
const districtFee = (firm, zone) => {
  const ids = [zone._id, ...(zone.ancestors || [])].map(String);
  const byZone = (firm.quartier_prices || []).find((p) => p.zone_id && ids.includes(p.zone_id.toString()));
  const byName = (firm.quartier_prices || []).find((p) => p.quartier?.toLowerCase() === zone.name.toLowerCase());
  const hit = byZone || byName;
  return hit && Number(hit.price) > 0 ? Number(hit.price) : null;
};

const addressFrom = async (input, label) => {
  if (!input || !mongoose.isValidObjectId(input.zone_id)) return { error: `Choose the ${label} quartier.` };
  const zone = await LogisticZone.findOne({ _id: input.zone_id, type: 'quartier', is_active: { $ne: false } }).select('name ancestors').lean();
  if (!zone) return { error: `The ${label} quartier is not one we deliver to.` };
  const parents = await LogisticZone.find({ _id: { $in: zone.ancestors || [] } }).select('name type').lean();
  return {
    zone,
    address: {
      street: text(input.street, 200), quartier: zone.name, city: parents.find((p) => p.type === 'city')?.name || '',
      region: parents.find((p) => p.type === 'region')?.name || undefined, phone: text(input.phone, 20) || undefined,
      zone_id: zone._id, landmark: text(input.landmark, 200) || null, location: confirmedPoint(input.location) || undefined,
    },
  };
};

const createPackage = async (req, res, next) => {
  try {
    if (!isEnabled(await PlatformSettings.getSettings(), 'agency_packages')) return fail(res, 403, 'Package registration is not enabled yet.');
    const firm = await LogisticsCompany.findOne({ user_id: req.user._id }).select('company_name quartier_prices pricing service_regions').lean();
    if (!firm) return fail(res, 404, 'Set up your delivery agency first.');

    const b = req.body || {};
    const sender = { name: text(b.sender?.name, 80), phone: text(b.sender?.phone, 20) };
    const recipient = { name: text(b.recipient?.name, 80), phone: text(b.recipient?.phone, 20) };
    if (!sender.name || !sender.phone) return fail(res, 400, 'Enter the sender’s name and phone.');
    if (!recipient.name || !recipient.phone) return fail(res, 400, 'Enter the recipient’s name and phone.');
    const description = text(b.description, 300);
    if (!description) return fail(res, 400, 'Describe the package.');

    const pickup = await addressFrom({ ...b.pickup, phone: b.pickup?.phone || sender.phone }, 'pickup');
    if (pickup.error) return fail(res, 400, pickup.error);
    const drop = await addressFrom({ ...b.delivery, phone: b.delivery?.phone || recipient.phone }, 'delivery');
    if (drop.error) return fail(res, 400, drop.error);

    // The agency's own price (district list, or distance from pickup to drop-off);
    // it may still set its own fee on its own package.
    let quoted;
    if (isDistance(firm)) {
      const q = await priceDelivery(firm, { pickup: pickup.address, dropoff: drop.address });
      quoted = q.error ? null : q.fee;
    } else {
      quoted = districtFee(firm, drop.zone);
    }
    const entered = b.fee === undefined || b.fee === null || b.fee === '' ? null : Math.round(Number(b.fee));
    if (entered !== null && (!Number.isFinite(entered) || entered < 0)) return fail(res, 400, 'The delivery fee must be a whole XAF amount.');
    const fee = entered ?? quoted;
    if (fee === null) return fail(res, 400, isDistance(firm)
      ? 'Your distance prices do not cover this trip (e.g. cross-city is off). Enter the delivery fee or update Route Pricing.'
      : `You have no price for ${drop.zone.name} yet. Enter the delivery fee or add it in Route Pricing.`);

    const payer = b.payer === 'recipient' ? 'recipient' : 'sender';
    const arrangement = ARRANGEMENTS.includes(b.payment_arrangement) ? b.payment_arrangement : (payer === 'recipient' ? 'pay_on_delivery' : 'paid_to_agency');

    const shipment = new Shipment({
      type: 'agency', logistics_id: firm._id, tracking_code: await generateTrackingCode(), status: 'pending',
      price: fee, base_price: fee, platform_fee: 0,
      pickup_address: pickup.address, delivery_address: drop.address,
      guest_booker: sender, other_party: recipient,
      package_details: { category: CATEGORIES.includes(b.category) ? b.category : 'other', weight_tier: WEIGHTS.includes(b.weight_tier) ? b.weight_tier : 'light',
        description, declared_value: Math.max(0, Math.round(Number(b.declared_value) || 0)), prohibited_items_confirmed: true },
      delivery_description: text(b.handling_instructions, 300) || null,
      payment_status: arrangement === 'pay_on_delivery' ? 'unpaid' : 'paid',
      agency_package: {
        reference: text(b.reference, 40) || null, payer, payment_arrangement: arrangement,
        amount_due_on_delivery: arrangement === 'pay_on_delivery' ? fee : 0,
        fee_source: entered === null || entered === quoted ? (isDistance(firm) ? 'distance' : 'district') : 'manual',
        photo_url: /^https:\/\//.test(b.photo_url || '') ? b.photo_url : null,
        created_by: req.user._id,
      },
      shipment_logs: [{ status: 'pending', timestamp: new Date(), note: 'Registered by the agency' }],
    });
    const token = links.issueToken(shipment);
    await shipment.save();
    await recordAudit({ actorId: req.user._id, action: 'agency_package_created', targetType: 'Shipment', targetId: shipment._id, after: { fee, fee_source: shipment.agency_package.fee_source } });

    // Offer it to one of the agency's riders right away when automatic dispatch is on.
    setImmediate(() => require('../services/riderDispatch.service').autoDispatch(shipment._id, req.app).catch((e) => console.error('[agencyPackage] dispatch:', e.message)));
    const body = shipment.toObject();
    delete body.tracking_token_hash;
    res.status(201).json({ success: true, data: { shipment: body, ...shareBundle(shipment, token, firm.company_name) } });
  } catch (err) { next(err); }
};

const createTrackingLink = async (req, res, next) => {
  try {
    if (!isEnabled(await PlatformSettings.getSettings(), 'tracking_links')) return fail(res, 403, 'Tracking links are not enabled yet.');
    const firm = await LogisticsCompany.findOne({ user_id: req.user._id }).select('_id company_name').lean();
    if (!firm || !mongoose.isValidObjectId(req.params.id)) return fail(res, 404, 'Shipment not found.');
    const shipment = await Shipment.findOne({ _id: req.params.id, logistics_id: firm._id });
    if (!shipment) return fail(res, 404, 'Shipment not found.');
    if (links.isExpired(shipment)) return fail(res, 400, 'This delivery is finished; its tracking link can no longer be shared.');
    const token = links.issueToken(shipment);
    await shipment.save();
    res.json({ success: true, data: shareBundle(shipment, token, firm.company_name) });
  } catch (err) { next(err); }
};

const trackByLink = async (req, res, next) => {
  try {
    const token = String(req.params.token || '');
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return fail(res, 404, 'This tracking link is not valid.');
    const shipment = await Shipment.findOne({ tracking_token_hash: links.hashToken(token) })
      .select('-tracking_token_hash -pod_otp_hash -pod_otp_expires -pod_otp_attempts')
      .populate('booked_by', 'name email phone')
      .populate('logistics_id', 'company_name avg_delivery_minutes user_id contact_phone')
      .lean();
    if (!shipment) return fail(res, 404, 'This tracking link is not valid.');
    if (links.isExpired(shipment)) return fail(res, 410, 'This delivery is finished and its tracking link has expired.');

    const visible = isShipmentParty(req.user, shipment) ? shipment : redactShipmentForPublic(shipment);
    if (visible.logistics_id) {
      // Recipients holding the link may call the agency, not see its owner account.
      visible.logistics_id = { company_name: shipment.logistics_id.company_name, contact_phone: shipment.logistics_id.contact_phone || null };
    }
    res.json({ success: true, data: { shipment: { ...visible, agency_package: undefined, link_expires_at: links.expiresAt(shipment) } } });
  } catch (err) { next(err); }
};

module.exports = { createPackage, createTrackingLink, trackByLink, waNumber, districtFee };
