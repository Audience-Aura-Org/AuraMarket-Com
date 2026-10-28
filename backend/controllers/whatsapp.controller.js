/**
 * WhatsApp webhooks + customer opt-in.
 *   GET  /api/v1/whatsapp/webhook   Meta's verification handshake (hub.challenge)
 *   POST /api/v1/whatsapp/webhook   statuses + incoming messages (raw body, signed)
 *   GET  /api/v1/whatsapp/me        my WhatsApp opt-in
 *   PUT  /api/v1/whatsapp/me        opt in / out of WhatsApp updates
 */
const User = require('../models/User.model');
const whatsapp = require('../services/whatsapp.service');

const verifyWebhook = (req, res) => {
  const { verifyToken } = whatsapp.cfg();
  if (verifyToken && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === verifyToken) {
    return res.status(200).type('text/plain').send(String(req.query['hub.challenge'] || ''));
  }
  return res.sendStatus(403);
};

const receiveWebhook = async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  if (!whatsapp.verifySignature(raw, req.get('x-hub-signature-256'))) return res.sendStatus(401);
  // Acknowledge at once (Meta retries slow endpoints), then process.
  res.sendStatus(200);
  try {
    const result = await whatsapp.handleWebhook(JSON.parse(raw.toString('utf8') || '{}'));
    if (result.statuses || result.optOuts) console.log(`[whatsapp] webhook: ${result.statuses} status update(s), ${result.optOuts} opt-out(s)`);
  } catch (err) {
    console.error('[whatsapp] webhook processing failed:', err.message);
  }
};

const view = (u) => ({ opted_in: Boolean(u?.whatsapp?.opted_in), number: u?.whatsapp?.number || null, opted_in_at: u?.whatsapp?.opted_in_at || null });

const getMyWhatsApp = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('whatsapp phone').lean();
    res.json({ success: true, data: { ...view(user), suggested_number: user?.phone || null } });
  } catch (err) { next(err); }
};

const updateMyWhatsApp = async (req, res, next) => {
  try {
    const optIn = req.body?.opted_in === true;
    const update = optIn ? { 'whatsapp.opted_in': true, 'whatsapp.opted_in_at': new Date(), 'whatsapp.opted_out_at': null } : { 'whatsapp.opted_in': false, 'whatsapp.opted_out_at': new Date() };
    if (optIn) {
      const number = whatsapp.toWaNumber(req.body?.number);
      if (!number) return res.status(400).json({ success: false, message: 'Enter the WhatsApp number to receive updates on, e.g. 677 12 34 56.' });
      update['whatsapp.number'] = number;
    }
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { returnDocument: 'after' }).select('whatsapp').lean();
    res.json({ success: true, data: view(user) });
  } catch (err) { next(err); }
};

module.exports = { verifyWebhook, receiveWebhook, getMyWhatsApp, updateMyWhatsApp };
