/**
 * utils/emailTemplates.js
 * Auradime — Premium Email Templates
 * Professional design with logo, clean aesthetic, minimal colors
 */

// Never let localhost slip into a live email — always fall back to the prod domain.
const sanitizeUrl = (url) => {
  if (!url) return 'https://auradime.com';
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(String(url))) return 'https://auradime.com';
  return String(url).replace(/\/+$/, '');
};

// Notification text can carry user content (chat messages, store names): escape before it reaches HTML.
const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const WEB_URL = sanitizeUrl(process.env.WEB_CLIENT_URL || 'https://auradime.com');
const LOGO_URL = process.env.EMAIL_LOGO_URL || 'https://auradime.com/icon-512.png';
// Contact address shown to recipients: the monitored reply inbox, not the no-reply sender.
const SUPPORT_EMAIL = process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER || 'support@auradime.com';

// Auradime — brand aligned with app & PDF invoice (full-width email layout)
const COLORS = {
  bgOuter:      '#f4f5f7',
  bgPrimary:    '#ffffff',
  bgSecondary:  '#f8fafc',
  border:       '#e5e7eb',
  textPrimary:  '#111827',
  textSecondary: '#4b5563',
  textMuted:    '#6b7280',
  accent:       '#5B21B6', // dark purple primary accent
  accentDark:   '#4C1D95', // deeper purple
  accentSoft:   '#F3E8FF', // light purple background
  gradient:     '#5B21B6', // use primary accent for gradient
  footerBg:     '#f8fafc',
  stripe:       '#5B21B6',
};
/* Detail rows are written as <div class="card-row"><span class="card-label">…</span><span class="card-value">…</span></div>.
 * Outlook ignores flexbox and phones stacked them, so render each one as a two-column table row. */
const CARD_ROW = /<div class="card-row">\s*<span class="card-label">([\s\S]*?)<\/span>\s*<span class="card-value"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/g;
const tableizeCardRows = (body = '') => body
  .replace(/<div class="card-divider"><\/div>/g, '')
  .replace(CARD_ROW, (_, label, value) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card-row-t"><tr><td class="card-label" style="width:38%;padding:10px 12px 10px 0;color:${COLORS.textSecondary};font-size:12px;font-weight:500;vertical-align:top;">${label}</td><td class="card-value" align="right" style="padding:10px 0;color:${COLORS.textPrimary};font-size:12px;font-weight:600;text-align:right;vertical-align:top;">${value}</td></tr></table>`);

/* ─── Premium Email Wrapper ─── */
const wrap = (title, heading, body) => `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, #bodyTable { margin: 0 !important; padding: 0 !important; width: 100% !important; background: ${COLORS.bgOuter}; font-family: 'Poppins', Arial, Helvetica, sans-serif !important; color: ${COLORS.textPrimary}; -webkit-font-smoothing: antialiased; }
    table, td, p, a, span, div, h1, h2, h3, h4, h5, h6, strong, em, th, button { font-family: 'Poppins', Arial, Helvetica, sans-serif !important; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; }
    table { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { padding: 0; }
    a { color: ${COLORS.accent}; }

    .header-band { background: ${COLORS.gradient}; padding: 0; }
    .header-inner { padding: 5px 14px 6px; }
    @media only screen and (min-width: 600px) {
      .header-inner { padding: 7px 20px 8px !important; }
    }
    .logo-img { height: 36px; width: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.35); box-shadow: 0 3px 8px rgba(0,0,0,0.12); }
    .header-title { color: #ffffff; font-size: 15px; font-weight: 700; letter-spacing: -0.2px; margin: 0; line-height: 1.1; }
    .header-sub { color: rgba(255,255,255,0.85); font-size: 10px; margin: 2px 0 0; font-weight: 500; }

    .accent-stripe { height: 2px; background: ${COLORS.stripe}; font-size: 0; line-height: 0; }

    .content-shell { width: 100% !important; max-width: 100% !important; background: ${COLORS.bgPrimary}; }
    .content-td { padding: 28px 20px 20px; background: ${COLORS.bgPrimary}; }
    @media only screen and (min-width: 600px) {
      .content-td { padding: 36px 48px 28px !important; }
    }
    .content-td h2 { font-size: 21px; color: ${COLORS.textPrimary}; margin: 0 0 10px; font-weight: 700; letter-spacing: -0.4px; line-height: 1.22; }
    .content-td p  { font-size: 13px; color: ${COLORS.textSecondary}; margin: 0 0 14px; line-height: 1.6; }
    .content-td strong { color: ${COLORS.textPrimary}; font-weight: 600; }

    .card { background: ${COLORS.accentSoft}; border: 1px solid #e9d5ff; border-radius: 14px; padding: 4px 16px; margin: 18px 0; }
    .card-row-t td { padding: 10px 0; border-top: 1px solid #ead9fb; vertical-align: top; font-size: 12px; line-height: 1.45; }
    .card .card-row-t:first-child td { border-top: 0; }
    td.card-label { color: ${COLORS.textSecondary}; font-weight: 500; width: 38%; padding-right: 12px !important; }
    td.card-value { color: ${COLORS.textPrimary}; font-weight: 600; text-align: right; word-break: break-word; }
    .card-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; }
    .card-row:not(:last-child) { border-bottom: 1px solid #f3e8ff; }
    .card-divider { height: 1px; background: #f3e8ff; margin: 0; }
    .card-label { color: ${COLORS.textSecondary}; font-weight: 500; font-size: 12px; }
    .card-value { color: ${COLORS.textPrimary}; font-weight: 600; font-size: 12px; text-align: right; }

    .role-badge { font-size: 10px; font-weight: 600; color: ${COLORS.accent}; background: ${COLORS.accentSoft}; padding: 2px 8px; border-radius: 20px; }

    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; }
    .badge-placed    { background: #e0f2fe; color: #0369a1; }
    .badge-processing{ background: #fef9c3; color: #854d0e; }
    .badge-shipped   { background: #e0e7ff; color: #4338ca; }
    .badge-delivered { background: #dcfce7; color: #166534; }
    .badge-completed { background: #dcfce7; color: #166534; }
    .badge-pending   { background: #fef3c7; color: #92400e; }
    .badge-refunded  { background: #f3e8ff; color: #7e22ce; }
    .badge-failed    { background: #fee2e2; color: #991b1b; }

    .btn { display: inline-block; background: ${COLORS.accent}; color: #ffffff !important; text-decoration: none; padding: 13px 28px; border-radius: 12px; font-weight: 600; font-size: 13px; margin: 16px 0; border: none; text-align: center; box-shadow: 0 6px 20px rgba(91, 33, 182, 0.22); font-family: 'Poppins', Arial, Helvetica, sans-serif !important; }

    .table-products { width: 100% !important; max-width: 100%; margin: 18px 0; border-collapse: collapse; font-size: 13px; border: 1px solid ${COLORS.border}; border-radius: 12px; overflow: hidden; }
    .table-products thead { background: #fafafa; }
    .table-products th { padding: 11px 14px; text-align: left; font-weight: 600; color: ${COLORS.textSecondary}; font-size: 11px; border-bottom: 1px solid ${COLORS.border}; }
    .table-products td { padding: 11px 14px; border-bottom: 1px solid ${COLORS.border}; color: ${COLORS.textPrimary}; font-size: 13px; }
    .table-products td.number { text-align: center; }
    .table-products td.amount { text-align: right; font-weight: 600; color: ${COLORS.accent}; white-space: nowrap; }
    .table-products tbody tr:last-child td { border-bottom: none; }

    .footer-td { padding: 32px 24px; text-align: center; background: ${COLORS.footerBg}; border-top: 1px solid ${COLORS.border}; }
    .footer-td p { font-size: 11px; color: ${COLORS.textMuted}; margin: 5px 0; font-family: 'Poppins', Arial, Helvetica, sans-serif !important; }
    .footer-td a { color: ${COLORS.accent}; text-decoration: none; font-weight: 600; }
    .footer-brand { font-size: 13px; font-weight: 700; color: ${COLORS.textPrimary}; margin-bottom: 8px !important; letter-spacing: -0.3px; }

    .highlight { background: ${COLORS.accentSoft}; border-left: 4px solid ${COLORS.accent}; padding: 13px 16px; margin: 18px 0; border-radius: 0 12px 12px 0; }
    .highlight p { margin: 0; font-size: 12px; color: ${COLORS.textPrimary}; font-weight: 500; }

    .qr-container { text-align: center; margin: 20px 0; padding: 18px; border: 1.5px dashed #e9d5ff; border-radius: 14px; background: ${COLORS.bgSecondary}; }
    .qr-image { width: 100px; height: 100px; margin: 0 auto 8px; border-radius: 8px; }
    .qr-text { font-size: 10px; color: ${COLORS.textSecondary}; font-weight: 500; max-width: 200px; margin: 0 auto; }

    @media only screen and (max-width: 600px) {
      .content-td { padding: 22px 16px 16px !important; }
      .content-td h2 { font-size: 19px !important; }
      .table-products th, .table-products td { padding: 10px 10px !important; }
      .header-inner { padding: 7px 14px 8px !important; }
      .footer-td  { padding: 22px 16px !important; }
      .btn        { display: block !important; text-align: center !important; width: 100% !important; box-sizing: border-box !important; }
      table[width="100%"] { max-width: 100% !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bgOuter};font-family:'Poppins',Arial,Helvetica,sans-serif !important;">
  <!--AURA_PREHEADER-->
  <table id="bodyTable" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0;padding:0;width:100%;background:${COLORS.bgOuter};font-family:'Poppins',Arial,Helvetica,sans-serif !important;">
    <tr>
      <td align="center" valign="top" style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:100%;margin:0;background:${COLORS.bgPrimary};">
          <tr>
            <td class="header-band" style="padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td class="header-inner">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;">
                      <tr>
                        <td style="width:44px;vertical-align:middle;">
                          <img src="${LOGO_URL}" alt="Auradime" class="logo-img" width="36" height="36" style="height:36px;width:36px;border-radius:10px;border:1px solid rgba(255,255,255,0.35);box-shadow:0 3px 8px rgba(0,0,0,0.12);" />
                        </td>
                        <td style="vertical-align:middle;padding-left:10px;">
                          <p class="header-title">Auradime</p>
                          <p class="header-sub">Commerce &bull; logistics &bull; fulfilment</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div class="accent-stripe" style="height:2px;background:${COLORS.stripe};font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td class="content-td content-shell">
              <h2>${heading}</h2>
              <!--AURA_HIGHLIGHT-->
              ${tableizeCardRows(body)}
            </td>
          </tr>
          <tr>
            <td class="footer-td">
              <p class="footer-brand">Auradime</p>
              <p>Questions? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
              <p>&copy; ${new Date().getFullYear()} Auradime &bull; Audience Aura Org</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/* ─── Notification highlight ───
 * Puts the notification's own text where the recipient sees it without opening
 * the email: the inbox preview line (hidden preheader) and a highlight block at
 * the top of the body. "Sender: text" messages render as a quoted message.
 * The block is skipped when the template body already shows the message.
 */
const PREHEADER_PAD = '&#847;&zwnj;&nbsp;'.repeat(40); // stops clients pulling body text into the preview

/** Hidden first line that inboxes and phone notifications show as the preview. */
const preheaderHtml = (text) => `<div style="display:none;font-size:1px;color:${COLORS.bgOuter};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200))}${PREHEADER_PAD}</div>`;

/* ─── What an email is about ───
 * Gives the sender name ("Auradime Security") and the header line, from the
 * notification type when known, else from the subject. Order matters: the
 * first match wins.
 */
const EMAIL_CATEGORIES = [
  ['Security', /security|verif|code|password|sign.?in|log.?in|otp/i],
  ['Deposits', /deposit|top.?up/i],
  ['Withdrawals', /withdraw|payout/i],
  ['Refunds', /refund/i],
  ['Subscriptions', /subscription|plan|trial/i],
  ['Payments', /payment|wallet|paid|charge|receipt|transaction/i],
  ['Messages', /message|chat|replied|reply/i],
  ['Delivery', /deliver|shipment|logistics|p2p|tracking|rider|pickup|package|parcel/i],
  ['Orders', /order|purchase|dispute|escrow/i],
];
const emailCategory = ({ category, subject } = {}) => {
  for (const source of [category, subject]) {
    if (!source) continue;
    const hit = EMAIL_CATEGORIES.find(([, re]) => re.test(String(source)));
    if (hit) return hit[0];
  }
  return null;
};

const withNotificationHighlight = (html, { message } = {}) => {
  if (!html || !message) return html;
  const text = String(message).trim();
  const escaped = escapeHtml(text);
  const preheader = preheaderHtml(text);

  const sender = text.match(/^([^:\n]{1,60}):\s+([\s\S]+)$/);
  const block = html.includes(escaped) ? '' : sender
    ? `<div class="highlight" style="background:${COLORS.accentSoft};border-left:4px solid ${COLORS.accent};padding:13px 16px;margin:4px 0 18px;border-radius:0 12px 12px 0;"><p style="margin:0 0 4px;font-size:11px;font-weight:600;color:${COLORS.accent};">${escapeHtml(sender[1])}</p><p style="margin:0;font-size:14px;line-height:1.55;color:${COLORS.textPrimary};font-weight:500;white-space:pre-line;">${escapeHtml(sender[2])}</p></div>`
    : `<div class="highlight" style="background:${COLORS.accentSoft};border-left:4px solid ${COLORS.accent};padding:13px 16px;margin:4px 0 18px;border-radius:0 12px 12px 0;"><p style="margin:0;font-size:14px;line-height:1.55;color:${COLORS.textPrimary};font-weight:500;white-space:pre-line;">${escaped}</p></div>`;

  return html.replace('<!--AURA_PREHEADER-->', preheader).replace('<!--AURA_HIGHLIGHT-->', block);
};

/** Subject that carries the gist: "Order #AB12CD34 · Amina: is size 42 available?" */
const notificationSubject = (title, message, max = 110) => {
  const head = String(title || 'Auradime update').trim();
  const gist = String(message || '').replace(/\s+/g, ' ').trim();
  if (!gist || head.toLowerCase().includes(gist.toLowerCase()) || gist.toLowerCase().startsWith(head.toLowerCase())) {
    return head.length > max ? `${head.slice(0, max - 1)}…` : head;
  }
  const subject = `${head} · ${gist}`;
  return subject.length > max ? `${subject.slice(0, max - 1).trimEnd()}…` : subject;
};

/* ─── Welcome / Sign Up (new template) ─── */
const welcomeEmail = ({ user, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const subject = '🎉 Welcome to Auradime';
  const body = `
    <p>Hi <strong>${user.name || 'there'}</strong>,</p>
    <p>Welcome to Auradime! Your account is active and ready for use.</p>
    
    <div class="card">
      ${user.email || user.phone ? `<div class="card-row">
        <span class="card-label">${user.email ? 'Email' : 'Phone'}</span>
        <span class="card-value">${escapeHtml(user.email || user.phone)}</span>
      </div>` : ''}
      <div class="card-row">
        <span class="card-label">Account</span>
        <span class="card-value"><span class="role-badge">${String(user.role || 'customer').replace(/^\w/, c => c.toUpperCase())}</span></span>
      </div>
    </div>
    
    ${user.role === 'vendor' ? `<a href="${baseUrl}/vendor/dashboard" class="btn">Go to Dashboard</a>` : `<a href="${baseUrl}/discovery" class="btn">Start Shopping</a>`}
  `;
  const html = wrap(subject, 'Welcome to Auradime', body);
  return { subject, html, text: `Welcome to Auradime, ${user.name}!` };
};

/* ─── Password Reset ─── */
const passwordReset = ({ user, resetLink, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const subject = '🔐 Reset Your Password';
  const body = `
    <p>Hi <strong>${user.name || 'there'}</strong>,</p>
    <p>Tap below to reset your password. This link expires in 1 hour.</p>
    
    <a href="${resetLink}" class="btn">Reset Password</a>
    
    <p style="font-size: 10px; color: #888888; margin-top: 18px;">If you didn't request this, please ignore this email.</p>
  `;
  const html = wrap(subject, 'Reset Your Password', body);
  return { subject, html, text: `Reset your password: ${resetLink}` };
};

const otpEmail = ({ otp, email, expiresMinutes = 10 }) => {
  const subject = `${otp} is your Auradime verification code`;
  const body = `
    <p>Use this code to verify <strong>${email}</strong> and continue into Auradime.</p>

    <div style="background:${COLORS.accentSoft};border:1px solid #e9d5ff;border-radius:14px;margin:20px 0;padding:22px;text-align:center;">
      <div style="font-size:30px;font-weight:800;letter-spacing:7px;color:${COLORS.accentDark};font-family:'Poppins',Arial,sans-serif;">${otp}</div>
      <p style="font-size:12px;color:${COLORS.textMuted};margin:9px 0 0;">Expires in ${expiresMinutes} minutes</p>
    </div>

    <p>If you did not request this code, you can safely ignore this email.</p>
  `;
  const html = wrap(subject, 'Verify your email', body);
  // Code first: it is what the phone notification and inbox preview show.
  return { subject, html, text: `${otp} is your verification code for ${email}. It expires in ${expiresMinutes} minutes.` };
};

/* ─── Shared order / logistics helpers ─── */
const orderRef = (order) => {
  if (!order?._id) return 'N/A';
  return order._id.toString().slice(-6).toUpperCase();
};

const productCount = (products = []) =>
  (products || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

const formatAddress = (address = {}) => {
  if (!address || typeof address !== 'object') return 'Not provided';
  const parts = [
    address.name,
    address.street,
    address.quartier,
    address.city,
    address.region,
    address.phone,
  ].filter(Boolean);
  return parts.join(', ') || 'Not provided';
};

const resolveVendorName = (order = {}) => {
  if (typeof order.vendor_name === 'string' && order.vendor_name) return order.vendor_name;
  if (typeof order.vendor_id === 'object' && order.vendor_id?.store_name) return order.vendor_id.store_name;
  return 'Vendor';
};

const resolveCustomerName = (order = {}, fallback = 'Valued Customer') => {
  if (typeof order.customer_name === 'string' && order.customer_name) return order.customer_name;
  if (typeof order.customer_id === 'object' && order.customer_id?.name) return order.customer_id.name;
  if (order.shipping_address?.name) return order.shipping_address.name;
  return fallback;
};

const resolveCustomerPhone = (order = {}) =>
  order.shipping_address?.phone || order.shipping_address?.contact_phone ||
  (typeof order.customer_id === 'object' ? order.customer_id?.phone : null) || null;

const resolveTrackingCode = (shipment, order) =>
  shipment?.tracking_code ||
  order?.tracking_number ||
  order?.tracking_code ||
  `ORD-${orderRef(order)}`;

const resolveLogisticsName = (shipment = {}, order = {}) => {
  if (typeof order.logistics_name === 'string' && order.logistics_name) return order.logistics_name;
  if (typeof shipment?.logistics_id === 'object' && shipment.logistics_id?.company_name) {
    return shipment.logistics_id.company_name;
  }
  return null;
};

const orderSummaryCard = ({
  order,
  status,
  extraRows = [],
  includeProducts = false,
}) => {
  const ref = orderRef(order);
  const rows = [
    `<div class="card-row"><span class="card-label">Order Ref</span><span class="card-value">#${ref}</span></div>`,
    status
      ? `<div class="card-row"><span class="card-label">Status</span><span class="card-value">${badge(status)}</span></div>`
      : '',
    `<div class="card-row"><span class="card-label">Items</span><span class="card-value">${productCount(order.products || [])} item(s)</span></div>`,
    `<div class="card-row"><span class="card-label">Total</span><span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span></div>`,
    ...extraRows,
  ].filter(Boolean).join('');

  return `
    <div class="card">${rows}</div>
    ${includeProducts ? formatProducts(order.products || []) : ''}
  `;
};

const logisticsRouteCard = ({ order, shipment }) => {
  const pickup = shipment?.pickup_address || order.vendor_id?.pickup_address || order.pickup_address;
  const delivery = shipment?.delivery_address || order.shipping_address;
  const tracking = resolveTrackingCode(shipment, order);

  return `
    <div class="card">
      <div class="card-row"><span class="card-label">Tracking</span><span class="card-value">${tracking}</span></div>
      <div class="card-row"><span class="card-label">Customer</span><span class="card-value">${resolveCustomerName(order)}</span></div>
      <div class="card-row"><span class="card-label">Vendor</span><span class="card-value">${resolveVendorName(order)}</span></div>
      <div class="card-row"><span class="card-label">Pickup</span><span class="card-value" style="text-align:right;">${formatAddress(pickup)}</span></div>
      <div class="card-row"><span class="card-label">Delivery</span><span class="card-value" style="text-align:right;">${formatAddress(delivery)}</span></div>
    </div>
  `;
};

const dashboardButton = (href, label = 'View Details') =>
  href ? `<div style="text-align: center; margin-top: 32px;"><a href="${href}" class="btn">${label}</a></div>` : '';

/* ─── Product Helper ─── */
const formatProducts = (products = []) => {
  if (!products.length) return '';
  const rows = products.map(p => `
    <tr>
      <td>${escapeHtml(p.name || 'Product')}</td>
      <td class="number">${p.quantity || 1}</td>
      <td class="amount">XAF ${((p.price || 0) * (p.quantity || 1)).toLocaleString()}</td>
    </tr>`).join('');
  return `
    <table class="table-products">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
};

const getBadgeClass = (status) => {
  const map = {
    'placed': 'badge-placed',
    'processing': 'badge-processing',
    'shipped': 'badge-shipped',
    'delivered': 'badge-delivered',
    'completed': 'badge-completed',
    'pending': 'badge-pending',
    'refunded': 'badge-refunded',
    'failed': 'badge-failed',
    'picked_up': 'badge-shipped',
    'in_transit': 'badge-shipped',
    'out_for_delivery': 'badge-shipped',
    'refund_pending': 'badge-pending',
    'paid': 'badge-delivered',
    'confirmed': 'badge-delivered',
    'accepted': 'badge-processing',
    'preparing': 'badge-processing',
    'ready': 'badge-shipped',
    'assigned': 'badge-shipped',
    'cancelled': 'badge-failed',
    'rejected': 'badge-failed',
    'refund_approved': 'badge-refunded',
    'partially_refunded': 'badge-refunded',
  };
  return map[status] || 'badge-pending';
};

const badge = (status) => {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `<span class="status-badge ${getBadgeClass(status)}">${label}</span>`;
};

const qrSection = (qrCode) => {
  if (!qrCode) return '';
  return `
    <div class="qr-container">
      <img src="${qrCode}" alt="Scan to Track" class="qr-image" />
      <p class="qr-text">Scan this code to track your order on your mobile device</p>
    </div>
  `;
};

/* ─── ORDER PLACED (Customer) ─── */
const orderPlaced = ({ order, customer, qrCode, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = orderRef(order);
  const subject = `✅ Order Confirmed — #${ref}`;
  const body = `
    <p>Hi <strong>${customer?.name || resolveCustomerName(order)}</strong>,</p>
    <p>Your order has been confirmed and is being prepared by <strong>${resolveVendorName(order)}</strong>.</p>
    
    ${orderSummaryCard({
      order,
      status: order.order_status || 'placed',
      extraRows: [
        `<div class="card-row"><span class="card-label">Vendor</span><span class="card-value">${resolveVendorName(order)}</span></div>`,
        `<div class="card-row"><span class="card-label">Delivery To</span><span class="card-value" style="text-align:right;">${formatAddress(order.shipping_address)}</span></div>`,
      ],
      includeProducts: true,
    })}
    
    ${qrSection(qrCode)}
    ${dashboardButton(`${baseUrl}/orders/${order._id}`, 'Track Order')}
  `;
  const html = wrap(subject, 'Order Confirmed', body);
  return {
    subject,
    html,
    text: `Order #${ref} confirmed with ${productCount(order.products || [])} item(s). Total: XAF ${(order.total_amount || 0).toLocaleString()}. Vendor: ${resolveVendorName(order)}.`,
  };
};

/* ─── PAYMENT CONFIRMED (Customer) ─── */
const paymentConfirmed = ({ order, customer, qrCode, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = orderRef(order);
  const subject = `💳 Payment Confirmed — #${ref}`;
  const body = `
    <p>Hi <strong>${customer?.name || resolveCustomerName(order)}</strong>,</p>
    <p>Payment received for your order from <strong>${resolveVendorName(order)}</strong>. Fulfillment is now in progress.</p>
    
    ${orderSummaryCard({
      order,
      status: order.order_status || 'processing',
      extraRows: [
        `<div class="card-row"><span class="card-label">Vendor</span><span class="card-value">${resolveVendorName(order)}</span></div>`,
        `<div class="card-row"><span class="card-label">Payment</span><span class="card-value">${badge(order.payment_status || 'paid')}</span></div>`,
      ],
      includeProducts: true,
    })}
    
    ${qrSection(qrCode)}
    ${dashboardButton(`${baseUrl}/orders/${order._id}`, 'Track Order')}
  `;
  const html = wrap(subject, 'Payment Received', body);
  return {
    subject,
    html,
    text: `Payment confirmed for Order #${ref}. ${productCount(order.products || [])} item(s), total XAF ${(order.total_amount || 0).toLocaleString()}.`,
  };
};

/* ─── SHIPMENT STATUS CHANGED (Customer) ─── */
const shipmentStatusChanged = ({ shipment, order, recipient, status, webUrl, dashboardLink }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = orderRef(order);
  const track = resolveTrackingCode(shipment, order);
  const normalizedStatus = status || shipment?.status || order?.order_status || 'updated';
  const logisticsName = resolveLogisticsName(shipment, order);
  
  const messages = {
    'picked_up': 'Your order has been picked up and is on its way to you!',
    'in_transit': 'Your order is currently in transit.',
    'out_for_delivery': 'Your delivery is out for delivery. Expect it soon!',
    'delivered': 'Your order has been delivered. Thank you for shopping!',
    'failed': 'We had trouble delivering your order. We\'ll attempt again shortly.',
    'assigned': 'A carrier has been assigned to your order.',
    'pending': 'Your shipment is awaiting pickup.',
  };
  
  const msg = messages[normalizedStatus] || `Your shipment status has been updated to: ${normalizedStatus.replace(/_/g, ' ')}.`;
  const subject = `📦 Delivery Update — ${normalizedStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
  const body = `
    <p>Hi <strong>${recipient?.name || resolveCustomerName(order)}</strong>,</p>
    <p>${msg}</p>
    
    <div class="card">
      <div class="card-row"><span class="card-label">Order Ref</span><span class="card-value">#${ref}</span></div>
      <div class="card-row"><span class="card-label">Tracking</span><span class="card-value">${track}</span></div>
      <div class="card-row"><span class="card-label">Status</span><span class="card-value">${badge(normalizedStatus)}</span></div>
      <div class="card-row"><span class="card-label">Vendor</span><span class="card-value">${resolveVendorName(order)}</span></div>
      ${logisticsName ? `<div class="card-row"><span class="card-label">Carrier</span><span class="card-value">${logisticsName}</span></div>` : ''}
      <div class="card-row"><span class="card-label">Items</span><span class="card-value">${productCount(order.products || [])} item(s)</span></div>
      <div class="card-row"><span class="card-label">Delivery To</span><span class="card-value" style="text-align:right;">${formatAddress(shipment?.delivery_address || order.shipping_address)}</span></div>
    </div>
    
    ${formatProducts(order.products || [])}
    ${dashboardButton(dashboardLink || `${baseUrl}/orders/${order._id}`, 'Track Shipment')}
  `;
  const html = wrap(subject, 'Shipment Update', body);
  return {
    subject,
    html,
    text: `Order #${ref} / ${track} is now ${normalizedStatus}. ${productCount(order.products || [])} item(s) for ${resolveCustomerName(order)}.`,
  };
};

/* ─── REFUND APPROVED (Customer) ─── */
const refundApproved = ({ order, customer, webUrl }) => {
  const baseUrl = sanitizeUrl(webUrl || WEB_URL);
  const ref = orderRef(order);
  const subject = `✅ Refund Approved — #${ref}`;
  const body = `
    <p>Hi <strong>${customer?.name || resolveCustomerName(order) || 'there'}</strong>,</p>
    <p>Your refund for Order <strong>#${ref}</strong> has been approved and credited to your Auradime wallet.</p>

    ${orderSummaryCard({
      order,
      status: 'refunded',
      extraRows: [
        `<div class="card-row"><span class="card-label">Refund Amount</span><span class="card-value" style="color:${COLORS.accent};font-weight:700;">XAF ${(order.total_amount || 0).toLocaleString()}</span></div>`,
        `<div class="card-row"><span class="card-label">Vendor</span><span class="card-value">${resolveVendorName(order)}</span></div>`,
      ],
      includeProducts: true,
    })}

    <p style="font-size:12px;color:${COLORS.textMuted};margin-top:4px;">Funds are available in your wallet and can be used for future purchases or withdrawn at any time.</p>
    ${dashboardButton(`${baseUrl}/wallet`, 'View Wallet')}
  `;
  const html = wrap(subject, 'Refund Approved', body);
  return { subject, html, text: `Refund of XAF ${(order.total_amount || 0).toLocaleString()} approved for Order #${ref}. Funds credited to your wallet.` };
};

/* ─── ORDER COMPLETED / ESCROW RELEASED (Vendor) ─── */
const orderCompleted = ({ order, vendor, webUrl }) => {
  const baseUrl = sanitizeUrl(webUrl || WEB_URL);
  const ref = orderRef(order);
  const subject = `🎉 Order Completed & Payment Released — #${ref}`;
  const body = `
    <p>Hi <strong>${vendor?.store_name || resolveVendorName(order) || 'there'}</strong>,</p>
    <p>Great news — Order <strong>#${ref}</strong> is complete and funds have been released to your wallet.</p>

    ${orderSummaryCard({
      order,
      status: 'completed',
      extraRows: [
        `<div class="card-row"><span class="card-label">Customer</span><span class="card-value">${resolveCustomerName(order)}</span></div>`,
        `<div class="card-row"><span class="card-label">Amount Released</span><span class="card-value" style="color:${COLORS.accent};font-weight:700;">XAF ${(order.total_amount || 0).toLocaleString()}</span></div>`,
        `<div class="card-row"><span class="card-label">Payment</span><span class="card-value">${badge('completed')}</span></div>`,
        order.shipping_address ? `<div class="card-row"><span class="card-label">Delivered To</span><span class="card-value" style="text-align:right;">${formatAddress(order.shipping_address)}</span></div>` : '',
      ].filter(Boolean),
      includeProducts: true,
    })}

    ${dashboardButton(`${baseUrl}/vendor/wallet`, 'View Wallet')}
  `;
  const html = wrap(subject, 'Payment Released', body);
  return { subject, html, text: `Order #${ref} completed. XAF ${(order.total_amount || 0).toLocaleString()} released to your wallet. Customer: ${resolveCustomerName(order)}.` };
};

/* ─── NEW ORDER FOR VENDOR ─── */
const newOrderForVendor = ({ order, vendor, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = orderRef(order);
  const subject = `🛒 New Order Received — #${ref}`;
  const body = `
    <p>Hi <strong>${vendor?.store_name || resolveVendorName(order)}</strong>,</p>
    <p>You have a new order from <strong>${resolveCustomerName(order)}</strong>. Please prepare it for shipment.</p>
    
    ${orderSummaryCard({
      order,
      status: order.order_status || 'placed',
      extraRows: [
        `<div class="card-row"><span class="card-label">Customer</span><span class="card-value">${resolveCustomerName(order)}</span></div>`,
        `<div class="card-row"><span class="card-label">Phone</span><span class="card-value">${resolveCustomerPhone(order) || 'Not provided'}</span></div>`,
        `<div class="card-row"><span class="card-label">Delivery To</span><span class="card-value" style="text-align:right;">${formatAddress(order.shipping_address)}</span></div>`,
        `<div class="card-row"><span class="card-label">Payment</span><span class="card-value">${badge(order.payment_status || 'pending')}</span></div>`,
      ],
      includeProducts: true,
    })}
    
    ${dashboardButton(`${baseUrl}/vendor/orders?orderId=${order._id}`, 'Manage Order')}
  `;
  const html = wrap(subject, 'New Order', body);
  return {
    subject,
    html,
    text: `New order #${ref} from ${resolveCustomerName(order)}. ${productCount(order.products || [])} item(s), total XAF ${(order.total_amount || 0).toLocaleString()}.`,
  };
};

/* ─── SHIPMENT ASSIGNED (Logistics) ─── */
const shipmentAssigned = ({ shipment, order, logistics, firm, webUrl, dashboardLink }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = orderRef(order);
  const track = resolveTrackingCode(shipment, order);
  const subject = `📦 New Shipment Assigned — ${track}`;
  const firmInfo = logistics || firm || {};
  
  const body = `
    <p>Hi <strong>${firmInfo.company_name || 'Partner'}</strong>,</p>
    <p>A new delivery assignment is ready for pickup from <strong>${resolveVendorName(order)}</strong>.</p>
    
    ${orderSummaryCard({
      order,
      status: shipment?.status || order.order_status || 'assigned',
      extraRows: [
        `<div class="card-row"><span class="card-label">Delivery Fee</span><span class="card-value">XAF ${(shipment?.price || order.shipping_fee || 0).toLocaleString()}</span></div>`,
      ],
    })}

    ${logisticsRouteCard({ order, shipment })}
    ${formatProducts(order.products || [])}
    ${dashboardButton(dashboardLink || `${baseUrl}/logistics/manifests`, 'View Assignment')}
  `;
  const html = wrap(subject, 'New Assignment', body);
  return {
    subject,
    html,
    text: `Shipment ${track} assigned for Order #${ref}. Customer: ${resolveCustomerName(order)}. Pickup from ${resolveVendorName(order)}.`,
  };
};

/* ─── SHIPMENT CLOSED (Logistics) ─── */
const logisticsShipmentClosed = ({ order, shipment, logistics, webUrl, dashboardLink, message }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = orderRef(order);
  const track = resolveTrackingCode(shipment, order);
  const subject = `✅ Shipment Closed — ${track}`;
  const firmInfo = logistics || {};

  const body = `
    <p>Hi <strong>${firmInfo.company_name || 'Partner'}</strong>,</p>
    <p>${message ? escapeHtml(message) : `Shipment for Order #${ref} has been confirmed delivered and settled.`}</p>

    ${orderSummaryCard({
      order,
      status: 'delivered',
      extraRows: [
        `<div class="card-row"><span class="card-label">Tracking</span><span class="card-value">${track}</span></div>`,
        `<div class="card-row"><span class="card-label">Customer</span><span class="card-value">${resolveCustomerName(order)}</span></div>`,
        `<div class="card-row"><span class="card-label">Vendor</span><span class="card-value">${resolveVendorName(order)}</span></div>`,
      ],
    })}

    ${dashboardButton(dashboardLink || `${baseUrl}/logistics/manifests`, 'View Manifests')}
  `;
  const html = wrap(subject, 'Shipment Closed', body);
  return {
    subject,
    html,
    text: `Shipment ${track} for Order #${ref} is closed. Customer: ${resolveCustomerName(order)}.`,
  };
};

/* ─── DELIVERY CONFIRMATION (Customer) ─── */
const deliveryConfirmationRequest = ({ order, customer, webUrl, dashboardLink, message }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = orderRef(order);
  const subject = `📬 Confirm Delivery — Order #${ref}`;
  const body = `
    <p>Hi <strong>${customer?.name || resolveCustomerName(order)}</strong>,</p>
    <p>${message ? escapeHtml(message) : `Order #${ref} was delivered. Please confirm receipt to release funds to the vendor.`}</p>

    ${orderSummaryCard({
      order,
      status: 'delivered',
      extraRows: [
        `<div class="card-row"><span class="card-label">Vendor</span><span class="card-value">${resolveVendorName(order)}</span></div>`,
        `<div class="card-row"><span class="card-label">Items</span><span class="card-value">${productCount(order.products || [])} item(s)</span></div>`,
      ],
      includeProducts: true,
    })}

    ${dashboardButton(dashboardLink || `${baseUrl}/orders/${order._id}`, 'Confirm Delivery')}
  `;
  const html = wrap(subject, 'Confirm Delivery', body);
  return {
    subject,
    html,
    text: `Order #${ref} was delivered. Confirm receipt for ${resolveVendorName(order)}.`,
  };
};

/* ─── Generic fallback for order/logistics alerts ─── */
const orderNotificationFallback = ({ title, message, link, webUrl, order }) => {
  const baseUrl = webUrl || WEB_URL;
  const body = `
    ${message ? '' : '<p>You have a new update on Auradime.</p>'}
    ${order ? orderSummaryCard({ order, status: order.order_status || 'updated' }) : ''}
    ${dashboardButton(link || baseUrl, 'View Details')}
  `;
  const html = wrap(escapeHtml(title || 'Auradime Update'), escapeHtml(title || 'Notification'), body);
  return { subject: title || 'Auradime Update', html, text: message || title || 'Auradime update' };
};

/* ─── REFUND REQUESTED (Vendor) ─── */
const refundRequested = ({ order, vendor, reason, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `⚠️ Refund Request — #${ref}`;
  const body = `
    <p>Hi <strong>${vendor.store_name || 'Vendor'}</strong>,</p>
    <p>A customer has requested a refund for their order. Please review and take action.</p>
    
    <div class="card">
      <div class="card-row">
        <span class="card-label">Order Reference</span>
        <span class="card-value">#${ref}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Amount</span>
        <span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span>
      </div>
      <div class="card-divider"></div>
      <div class="card-row">
        <span class="card-label">Reason</span>
        <span class="card-value" style="text-align: right;">${reason || 'Not specified'}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Status</span>
        <span class="card-value">${badge('refund_pending')}</span>
      </div>
    </div>
    
    <a href="${baseUrl}/vendor/orders" class="btn">Review Request</a>
  `;
  const html = wrap(subject, '⚠️ Refund Request', body);
  return { subject, html, text: `Refund requested for Order #${ref}.` };
};

/* ─── ORDER STATUS UPDATED (Customer) ─── */
const orderStatusUpdated = ({ order, customer, qrCode, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = orderRef(order);
  const subject = `📋 Order Update — #${ref}`;
  const status = order.order_status || 'updated';
  
  const body = `
    <p>Hi <strong>${customer?.name || resolveCustomerName(order)}</strong>,</p>
    <p>Order status updated to <strong>${status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong> for your purchase from <strong>${resolveVendorName(order)}</strong>.</p>
    
    ${orderSummaryCard({
      order,
      status,
      extraRows: [
        `<div class="card-row"><span class="card-label">Vendor</span><span class="card-value">${resolveVendorName(order)}</span></div>`,
        `<div class="card-row"><span class="card-label">Delivery To</span><span class="card-value" style="text-align:right;">${formatAddress(order.shipping_address)}</span></div>`,
      ],
      includeProducts: true,
    })}
    
    ${qrSection(qrCode)}
    ${dashboardButton(`${baseUrl}/orders/${order._id}`, 'View Order')}
  `;
  const html = wrap(subject, 'Order Update', body);
  return {
    subject,
    html,
    text: `Order #${ref} status updated to ${status}. ${productCount(order.products || [])} item(s) from ${resolveVendorName(order)}.`,
  };
};

/* ─── ADMIN NOTIFICATION (Platform Admins) ─── */
const adminNotification = ({ title, message, orderDetails, metadata, link, webUrl }) => {
  const baseUrl = sanitizeUrl(webUrl || WEB_URL);
  const subject = `🔔 [Admin] ${title}`;

  const orderSection = orderDetails ? `
    ${orderSummaryCard({
      order: orderDetails,
      status: orderDetails.order_status || 'pending',
      extraRows: [
        `<div class="card-row"><span class="card-label">Customer</span><span class="card-value">${resolveCustomerName(orderDetails)}</span></div>`,
        `<div class="card-row"><span class="card-label">Vendor</span><span class="card-value">${resolveVendorName(orderDetails)}</span></div>`,
        `<div class="card-row"><span class="card-label">Payment</span><span class="card-value">${badge(orderDetails.payment_status || 'pending')}</span></div>`,
        orderDetails.shipping_address ? `<div class="card-row"><span class="card-label">Delivery To</span><span class="card-value" style="text-align:right;">${formatAddress(orderDetails.shipping_address)}</span></div>` : '',
      ].filter(Boolean),
      includeProducts: true,
    })}
  ` : '';

  // Render safe scalar metadata fields as extra detail rows
  const metaRows = metadata
    ? Object.entries(metadata)
        .filter(([k, v]) => !['sender_id', 'senderId', 'senderData', 'shipment', 'link'].includes(k) && v != null && typeof v !== 'object')
        .map(([k, v]) => `<div class="card-row"><span class="card-label">${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span><span class="card-value">${escapeHtml(v)}</span></div>`)
        .join('')
    : '';
  const metaSection = metaRows ? `<div class="card">${metaRows}</div>` : '';

  const actionLink = sanitizeUrl(link) || `${baseUrl}/admin`;

  const body = `
    <div class="highlight"><p><strong>Platform Admin Alert</strong> — this notification was sent automatically by the Auradime system.</p></div>
    <p>${message ? escapeHtml(message) : 'A platform event requires your attention.'}</p>
    ${orderSection}
    ${metaSection}
    ${dashboardButton(actionLink, 'Open Admin Panel')}
  `;
  const html = wrap(subject, `Admin: ${title}`, body);
  return { subject, html, text: `[Admin] ${title}: ${message}` };
};

module.exports = {
  preheaderHtml,
  emailCategory,
  welcomeEmail,
  otpEmail,
  passwordReset,
  orderPlaced,
  paymentConfirmed,
  shipmentStatusChanged,
  refundApproved,
  orderCompleted,
  newOrderForVendor,
  shipmentAssigned,
  logisticsShipmentClosed,
  deliveryConfirmationRequest,
  orderNotificationFallback,
  withNotificationHighlight,
  notificationSubject,
  escapeHtml,
  refundRequested,
  orderStatusUpdated,
  adminNotification,
  sanitizeUrl,
  wrap,
  orderRef,
  resolveCustomerName,
  resolveVendorName,
};
