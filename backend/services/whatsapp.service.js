/**
 * services/whatsapp.service.js
 * WhatsApp Business Platform (Meta Cloud API) — template messages + webhooks.
 *
 * Env:
 *   WHATSAPP_TOKEN            permanent System User access token
 *   WHATSAPP_PHONE_NUMBER_ID  the sending number's ID (WhatsApp Manager → API setup)
 *   WHATSAPP_APP_SECRET       Meta app secret: verifies webhook signatures
 *   WHATSAPP_VERIFY_TOKEN     any random string, also pasted into Meta's webhook form
 *   WHATSAPP_API_VERSION      Graph API version (default v23.0)
 * Without WHATSAPP_TOKEN/PHONE_NUMBER_ID the service runs in dry-run mode: it logs
 * and records messages as "dry_run" but sends nothing.
 */
const crypto = require('crypto');
const WhatsAppMessage = require('../models/WhatsAppMessage.model');
const { TEMPLATES } = require('../constants/whatsappTemplates');

const cfg = () => ({
  token: process.env.WHATSAPP_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  appSecret: process.env.WHATSAPP_APP_SECRET || '',
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
  version: process.env.WHATSAPP_API_VERSION || 'v23.0',
});
const isLive = () => Boolean(cfg().token && cfg().phoneNumberId);

/** Cameroon mobile → "2376XXXXXXXX"; other full international numbers pass through. Null if unusable. */
const toWaNumber = (phone) => {
  const d = String(phone || '').replace(/\D/g, '').replace(/^00/, '');
  if (!d) return null;
  if (/^6\d{8}$/.test(d)) return `237${d}`;
  if (/^2376\d{8}$/.test(d)) return d;
  return d.length >= 10 && d.length <= 15 && !d.startsWith('0') ? d : null;
};

/**
 * Send an approved template. Never throws: returns { ok, dryRun, id, error }.
 * @param {{ to, template, params: string[], language?: 'en'|'fr', userId?, notificationId? }} msg
 */
const sendTemplate = async ({ to, template, params = [], language = 'en', userId = null, notificationId = null }) => {
  const number = toWaNumber(to);
  if (!number) return { ok: false, error: 'invalid_number' };
  if (!TEMPLATES[template]) return { ok: false, error: 'unknown_template' };
  const lang = language === 'fr' ? 'fr' : 'en';
  const record = { user_id: userId, to: number, template, language: lang, notification_id: notificationId };

  if (!isLive()) {
    console.log(`[whatsapp:dry-run] ${template} → ${number.replace(/\d{4}$/, '••••')} | ${params.map((p) => String(p).slice(0, 40)).join(' | ')}`);
    await WhatsAppMessage.create({ ...record, status: 'dry_run' }).catch(() => {});
    return { ok: true, dryRun: true };
  }

  const { token, phoneNumberId, version } = cfg();
  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: number,
        type: 'template',
        template: {
          name: template,
          language: { code: lang },
          components: params.length ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text).slice(0, 1000) || '-' })) }] : [],
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = body?.error ? `${body.error.code || res.status}: ${body.error.message}` : `HTTP ${res.status}`;
      await WhatsAppMessage.create({ ...record, status: 'failed', error }).catch(() => {});
      console.error(`[whatsapp] ${template} failed: ${error}`);
      return { ok: false, error };
    }
    const id = body?.messages?.[0]?.id || null;
    await WhatsAppMessage.create({ ...record, status: 'accepted', wa_message_id: id }).catch(() => {});
    return { ok: true, id };
  } catch (err) {
    await WhatsAppMessage.create({ ...record, status: 'failed', error: err.message }).catch(() => {});
    return { ok: false, error: err.message };
  }
};

/** Meta signs webhook bodies with the app secret (X-Hub-Signature-256: sha256=<hex>). */
const verifySignature = (rawBody, header) => {
  const { appSecret } = cfg();
  if (!appSecret) return process.env.NODE_ENV !== 'production'; // never accept unsigned webhooks in production
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(String(header || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const STATUS_RANK = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: 4 };
const OPT_OUT = /^\s*(stop|arr[eê]t|stop all|unsubscribe|d[ée]sabonner)\s*$/i;

/** Applies a webhook payload: message statuses and STOP opt-outs. Returns counts for logging. */
const handleWebhook = async (payload) => {
  const User = require('../models/User.model');
  let statuses = 0;
  let optOuts = 0;
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const s of value.statuses || []) {
        const msg = await WhatsAppMessage.findOne({ wa_message_id: s.id });
        if (!msg) continue;
        // Webhooks can arrive out of order: never move a message backwards (read → delivered).
        if (s.status === 'failed' || (STATUS_RANK[s.status] ?? -1) > (STATUS_RANK[msg.status] ?? -1)) {
          msg.status = s.status;
          msg.status_at = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();
          if (s.errors?.length) msg.error = s.errors.map((e) => `${e.code}: ${e.title}`).join('; ');
          if (s.pricing) msg.pricing = s.pricing;
          await msg.save();
          statuses++;
        }
      }
      for (const m of value.messages || []) {
        if (m.type === 'text' && OPT_OUT.test(m.text?.body || '')) {
          const r = await User.updateMany({ 'whatsapp.number': toWaNumber(m.from), 'whatsapp.opted_in': true },
            { $set: { 'whatsapp.opted_in': false, 'whatsapp.opted_out_at': new Date() } });
          optOuts += r.modifiedCount || 0;
        }
      }
    }
  }
  return { statuses, optOuts };
};

module.exports = { sendTemplate, verifySignature, handleWebhook, toWaNumber, isLive, cfg };
