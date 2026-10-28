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

// One template per transaction topic. A single generic "update: {{1}}" template was
// reclassified as Marketing by Meta (it could carry anything); fixed wording tied to
// an order / payment / delivery / account keeps these in the Utility category.
const summary = (n) => clip(n.message || n.title, 600);
const TEMPLATES = {
  auradime_order_update: {
    category: 'UTILITY',
    body: {
      en: 'There is an update on your Auradime order: {{1}}\n\nView your order: {{2}}\n\nThank you for shopping with Auradime.',
      fr: 'Votre commande Auradime a été mise à jour : {{1}}\n\nVoir votre commande : {{2}}\n\nMerci pour votre achat sur Auradime.',
    },
    example: ['Order #A6D79B78 from Mama Ngozi Boutique has left the store and will arrive before 4 PM.', 'https://auradime.com/orders/123'],
    params: (n) => [summary(n), link(n.metadata?.link || '/orders')],
  },
  auradime_payment_update: {
    category: 'UTILITY',
    body: {
      en: 'Payment notice for your Auradime account: {{1}}\n\nView your wallet: {{2}}\n\nThis is an automatic notice about your own transaction.',
      fr: 'Avis de paiement pour votre compte Auradime : {{1}}\n\nVoir votre portefeuille : {{2}}\n\nCeci est un avis automatique concernant votre propre transaction.',
    },
    example: ['We received your payment of 31,500 XAF for order #A6D79B78.', 'https://auradime.com/wallet'],
    params: (n) => [summary(n), link(n.metadata?.link || '/wallet')],
  },
  auradime_delivery_update: {
    category: 'UTILITY',
    body: {
      en: 'Update on your Auradime delivery: {{1}}\n\nTrack your delivery: {{2}}\n\nPlease keep your phone on so the rider can reach you.',
      fr: 'Mise à jour de votre livraison Auradime : {{1}}\n\nSuivre votre livraison : {{2}}\n\nGardez votre téléphone allumé pour que le livreur puisse vous joindre.',
    },
    example: ['Delivery AURA-K7Q2M9XP is out for delivery.', 'https://auradime.com/delivery/track?code=AURA-K7Q2M9XP'],
    params: (n) => [summary(n), link(n.metadata?.link || '/delivery/history')],
  },
  // Wording about passwords or codes makes Meta read this as Authentication (rejected
  // as INCORRECT_CATEGORY), so it only describes the account change.
  auradime_security_notice: {
    category: 'UTILITY',
    body: {
      en: 'Security notice for your Auradime account: {{1}}\n\nReview your account activity here: {{2}}\n\nContact Auradime support if you did not make this change.',
      fr: 'Avis de sécurité pour votre compte Auradime : {{1}}\n\nConsultez l’activité de votre compte ici : {{2}}\n\nContactez le support Auradime si vous n’êtes pas à l’origine de ce changement.',
    },
    example: ['Your account was signed in from a new device.', 'https://auradime.com/account'],
    params: (n) => [summary(n), link(n.metadata?.link || '/account')],
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
const TOPICS = [
  [/security/, 'auradime_security_notice'],
  [/payment|wallet|deposit|withdrawal|payout|subscription/, 'auradime_payment_update'],
  [/logistics|p2p|shipment|delivery/, 'auradime_delivery_update'],
  [/order|refund|dispute|escrow/, 'auradime_order_update'],
];
const templateForNotification = (type) => {
  const t = String(type || '');
  if (/message|chat/.test(t)) return null;
  return TOPICS.find(([re]) => re.test(t))?.[1] || null;
};

module.exports = { TEMPLATES, templateForNotification };
