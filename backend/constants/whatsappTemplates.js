/**
 * WhatsApp message templates (Meta WhatsApp Business Platform).
 *
 * Business-initiated messages must use templates approved by Meta. Create each one
 * in WhatsApp Manager → Message templates with EXACTLY this name, category
 * "Utility", and the body text below (variables are {{1}}, {{2}}, …), in English
 * and French. The `params` function turns a notification into the variables.
 *
 * Meta rejects templates that start or end with a variable, or that are mostly
 * variables: every body below opens and closes with fixed text.
 */
const WEB = () => (process.env.WEB_CLIENT_URL && !/localhost/.test(process.env.WEB_CLIENT_URL) ? process.env.WEB_CLIENT_URL : 'https://auradime.com').replace(/\/+$/, '');
const clip = (s, n) => (String(s || '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ''));
const link = (path) => (path ? `${WEB()}${path.startsWith('/') ? path : `/${path}`}` : WEB());

const TEMPLATES = {
  auradime_update: {
    category: 'UTILITY',
    body: {
      en: 'Auradime update: {{1}}\n\n{{2}}\n\nSee the details here: {{3}}\n\nThank you for using Auradime.',
      fr: 'Mise à jour Auradime : {{1}}\n\n{{2}}\n\nVoir les détails ici : {{3}}\n\nMerci d’utiliser Auradime.',
    },
    example: ['Order #A6D79B78 is on its way', 'Your order from Mama Ngozi Boutique has left the store. The rider expects to arrive before 4 PM.', 'https://auradime.com/orders/123'],
    params: (n) => [clip(n.title, 60), clip(n.message, 700), link(n.metadata?.link)],
  },
  auradime_delivery_link: {
    category: 'UTILITY',
    body: {
      en: 'Hello, {{1}} is delivering your package {{2}}. Follow it here: {{3}}\n\nPlease keep your phone on so the rider can reach you.',
      fr: 'Bonjour, {{1}} livre votre colis {{2}}. Suivez-le ici : {{3}}\n\nGardez votre téléphone allumé pour que le livreur puisse vous joindre.',
    },
    example: ['FastShip', 'AURA-K7Q2M9XP', 'https://auradime.com/delivery/track?t=abc'],
    params: (n) => [clip(n.agency, 60), clip(n.reference, 40), n.link],
  },
};

/** Notification types sent on WhatsApp (to opted-in users). Chat and promotions stay off: cost and consent. */
const WHATSAPP_CATEGORIES = /order|payment|wallet|deposit|withdrawal|payout|refund|subscription|logistics|p2p|shipment|delivery|dispute|escrow/;
const templateForNotification = (type) => (WHATSAPP_CATEGORIES.test(String(type || '')) && !/message|chat/.test(String(type || '')) ? 'auradime_update' : null);

module.exports = { TEMPLATES, templateForNotification };
