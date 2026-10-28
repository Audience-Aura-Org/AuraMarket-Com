/**
 * Submit and check Auradime's WhatsApp message templates (Meta Graph API).
 *
 *   node scripts/whatsapp-templates.js --status    # list our templates and their review status
 *   node scripts/whatsapp-templates.js --submit    # create any missing template/language
 *
 * Needs WHATSAPP_TOKEN (whatsapp_business_management) and WHATSAPP_BUSINESS_ACCOUNT_ID
 * (WhatsApp Manager → API setup → "WhatsApp Business Account ID").
 * Template text and samples come from constants/whatsappTemplates.js.
 */
require('dotenv').config({ quiet: true });
const { TEMPLATES } = require('../constants/whatsappTemplates');

const TOKEN = process.env.WHATSAPP_TOKEN;
const WABA = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const V = process.env.WHATSAPP_API_VERSION || 'v23.0';
const FOOTER = { en: 'Reply STOP to stop these messages', fr: 'Répondez STOP pour ne plus recevoir ces messages' };

const graph = async (path, options = {}) => {
  const res = await fetch(`https://graph.facebook.com/${V}/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.error_user_msg || body?.error?.message || `HTTP ${res.status}`);
  return body;
};

const existing = async () => {
  const names = Object.keys(TEMPLATES);
  const out = [];
  let url = `${WABA}/message_templates?fields=name,language,status,category,rejected_reason&limit=100`;
  while (url) {
    const page = await graph(url);
    out.push(...(page.data || []).filter((t) => names.includes(t.name)));
    url = page.paging?.next ? page.paging.next.replace(`https://graph.facebook.com/${V}/`, '') : null;
  }
  return out;
};

(async () => {
  if (!TOKEN || !WABA) {
    console.error('Set WHATSAPP_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID in backend/.env first.');
    process.exit(1);
  }
  const have = await existing();
  if (process.argv.includes('--submit')) {
    for (const [name, tpl] of Object.entries(TEMPLATES)) {
      for (const [language, text] of Object.entries(tpl.body)) {
        if (have.some((t) => t.name === name && t.language === language)) { console.log(`skip   ${name} (${language}) — already submitted`); continue; }
        const created = await graph(`${WABA}/message_templates`, {
          method: 'POST',
          body: JSON.stringify({
            name, language, category: tpl.category,
            components: [
              { type: 'BODY', text, example: { body_text: [tpl.example] } },
              { type: 'FOOTER', text: FOOTER[language] },
            ],
          }),
        }).catch((err) => ({ error: err.message }));
        console.log(created.error ? `FAILED ${name} (${language}): ${created.error}` : `sent   ${name} (${language}) → ${created.status || 'PENDING'}`);
      }
    }
  }
  for (const t of await existing()) console.log(`${t.status.padEnd(9)} ${t.name} (${t.language})${t.rejected_reason && t.rejected_reason !== 'NONE' ? ` — ${t.rejected_reason}` : ''}`);
})().catch((err) => { console.error(err.message); process.exit(1); });
