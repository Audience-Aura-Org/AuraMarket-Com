/**
 * utils/emailTemplates.js
 * Aura Market — Premium Email Templates
 * Professional design with logo, clean aesthetic, minimal colors
 */

const WEB_URL = process.env.WEB_CLIENT_URL || 'https://auradime.com/';
const LOGO_URL = process.env.EMAIL_LOGO_URL || 'https://auradime.com/icon-512.png';
const SUPPORT_EMAIL = process.env.EMAIL_USER || 'support@auradime.com';

// Aura Market — brand aligned with app & PDF invoice (full-width email layout)
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
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, #bodyTable { margin: 0 !important; padding: 0 !important; width: 100% !important; background: ${COLORS.bgOuter}; font-family: 'DM Sans', 'Poppins', -apple-system, BlinkMacSystemFont, Arial, sans-serif; color: ${COLORS.textPrimary}; -webkit-font-smoothing: antialiased; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; display: block; }
    table { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { padding: 0; }
    a { color: ${COLORS.accent}; }

    .header-band { background: ${COLORS.gradient}; padding: 0; }
    .header-inner { padding: 20px 16px 24px; }
    @media only screen and (min-width: 600px) {
      .header-inner { padding: 28px 32px 32px !important; }
    }
    .logo-img { height: 40px; width: 40px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.35); box-shadow: 0 4px 14px rgba(0,0,0,0.12); }
    .header-title { color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.6px; margin: 0; line-height: 1.15; }
    .header-sub { color: rgba(255,255,255,0.88); font-size: 13px; margin: 8px 0 0; font-weight: 500; }

    .accent-stripe { height: 4px; background: ${COLORS.stripe}; font-size: 0; line-height: 0; }

    .content-shell { width: 100% !important; max-width: 100% !important; background: ${COLORS.bgPrimary}; }
    .content-td { padding: 28px 20px 20px; background: ${COLORS.bgPrimary}; }
    @media only screen and (min-width: 600px) {
      .content-td { padding: 36px 48px 28px !important; }
    }
    .content-td h2 { font-size: 24px; color: ${COLORS.textPrimary}; margin: 0 0 12px; font-weight: 700; letter-spacing: -0.6px; line-height: 1.2; }
    .content-td p  { font-size: 15px; color: ${COLORS.textSecondary}; margin: 0 0 16px; line-height: 1.65; }
    .content-td strong { color: ${COLORS.textPrimary}; font-weight: 600; }

    .card { background: ${COLORS.accentSoft}; border: 1px solid #e9d5ff; border-radius: 14px; padding: 6px 18px; margin: 20px 0; }
    .card-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; }
    .card-row:not(:last-child) { border-bottom: 1px solid #f3e8ff; }
    .card-divider { height: 1px; background: #f3e8ff; margin: 0; }
    .card-label { color: ${COLORS.textSecondary}; font-weight: 500; font-size: 13px; }
    .card-value { color: ${COLORS.textPrimary}; font-weight: 600; font-size: 13px; text-align: right; }

    .role-badge { font-size: 11px; font-weight: 600; color: ${COLORS.accent}; background: ${COLORS.accentSoft}; padding: 2px 8px; border-radius: 20px; }

    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-placed    { background: #e0f2fe; color: #0369a1; }
    .badge-processing{ background: #fef9c3; color: #854d0e; }
    .badge-shipped   { background: #e0e7ff; color: #4338ca; }
    .badge-delivered { background: #dcfce7; color: #166534; }
    .badge-completed { background: #dcfce7; color: #166534; }
    .badge-pending   { background: #fef3c7; color: #92400e; }
    .badge-refunded  { background: #f3e8ff; color: #7e22ce; }
    .badge-failed    { background: #fee2e2; color: #991b1b; }

    .btn { display: inline-block; background: ${COLORS.accent}; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 14px; margin: 18px 0; border: none; text-align: center; box-shadow: 0 6px 20px rgba(91, 33, 182, 0.22); font-family: 'DM Sans', 'Poppins', Arial, sans-serif; }

    .table-products { width: 100% !important; max-width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 14px; border: 1px solid ${COLORS.border}; border-radius: 12px; overflow: hidden; }
    .table-products thead { background: #fafafa; }
    .table-products th { padding: 12px 16px; text-align: left; font-weight: 600; color: ${COLORS.textSecondary}; font-size: 12px; border-bottom: 1px solid ${COLORS.border}; }
    .table-products td { padding: 12px 16px; border-bottom: 1px solid ${COLORS.border}; color: ${COLORS.textPrimary}; font-size: 14px; }
    .table-products td.number { text-align: center; }
    .table-products td.amount { text-align: right; font-weight: 600; color: ${COLORS.accent}; }
    .table-products tbody tr:last-child td { border-bottom: none; }

    .footer-td { padding: 32px 24px; text-align: center; background: ${COLORS.footerBg}; border-top: 1px solid ${COLORS.border}; }
    .footer-td p { font-size: 13px; color: ${COLORS.textMuted}; margin: 6px 0; font-family: 'DM Sans', 'Poppins', Arial, sans-serif; }
    .footer-td a { color: ${COLORS.accent}; text-decoration: none; font-weight: 600; }
    .footer-brand { font-size: 15px; font-weight: 700; color: ${COLORS.textPrimary}; margin-bottom: 10px !important; letter-spacing: -0.5px; }

    .highlight { background: ${COLORS.accentSoft}; border-left: 4px solid ${COLORS.accent}; padding: 14px 18px; margin: 20px 0; border-radius: 0 12px 12px 0; }
    .highlight p { margin: 0; font-size: 13px; color: ${COLORS.textPrimary}; font-weight: 500; }

    .qr-container { text-align: center; margin: 20px 0; padding: 18px; border: 1.5px dashed #e9d5ff; border-radius: 14px; background: ${COLORS.bgSecondary}; }
    .qr-image { width: 100px; height: 100px; margin: 0 auto 8px; border-radius: 8px; }
    .qr-text { font-size: 11px; color: ${COLORS.textSecondary}; font-weight: 500; max-width: 200px; margin: 0 auto; }

    @media only screen and (max-width: 600px) {
      .content-td { padding: 22px 16px 16px !important; }
      .header-inner { padding: 22px 16px 26px !important; }
      .footer-td  { padding: 22px 16px !important; }
      .card-row   { flex-direction: column; align-items: flex-start; gap: 4px; }
      .card-value { text-align: left !important; }
      .btn        { display: block !important; text-align: center !important; width: 100% !important; box-sizing: border-box !important; }
      table[width="100%"] { max-width: 100% !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bgOuter};">
  <table id="bodyTable" width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0;padding:0;width:100%;background:${COLORS.bgOuter};">
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
                        <td style="width:52px;vertical-align:middle;">
                          <img src="${LOGO_URL}" alt="Auradime" class="logo-img" width="40" height="40" />
                        </td>
                        <td style="vertical-align:middle;padding-left:14px;">
                          <p class="header-title">Auradime</p>
                          <p class="header-sub">Commerce &bull; logistics &bull; fulfilment</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div class="accent-stripe" style="height:4px;background:${COLORS.stripe};font-size:0;line-height:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td class="content-td content-shell">
              <h2>${heading}</h2>
              ${body}
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

/* ─── Welcome / Sign Up (new template) ─── */
const welcomeEmail = ({ user, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const subject = '🎉 Welcome to Auradime';
  const body = `
    <p>Hi <strong>${user.name || 'there'}</strong>,</p>
    <p>Welcome to Auradime! Your account is active and ready for use.</p>
    
    <div class="card">
      <div class="card-row">
        <span class="card-label">Email</span>
        <span class="card-value">${user.email}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Role</span>
        <span class="card-value"><span class="role-badge">${user.role || 'Customer'}</span></span>
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
    
    <p style="font-size: 11px; color: #888888; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
  `;
  const html = wrap(subject, 'Reset Your Password', body);
  return { subject, html, text: `Reset your password: ${resetLink}` };
};

/* ─── Product Helper ─── */
const formatProducts = (products = []) => {
  if (!products.length) return '';
  const rows = products.map(p => `
    <tr>
      <td>${p.name || 'Product'}</td>
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
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `✅ Order Confirmed — #${ref}`;
  const body = `
    <p>Hi <strong>${customer.name || 'there'}</strong>,</p>
    <p>Your order has been confirmed and is being prepared.</p>
    
    <div class="card">
      <div class="card-row"><span class="card-label">Ref</span><span class="card-value">#${ref}</span></div>
      <div class="card-row"><span class="card-label">Status</span><span class="card-value">${badge('placed')}</span></div>
      <div class="card-row"><span class="card-label">Total</span><span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span></div>
    </div>
    
    ${qrSection(qrCode)}
    ${formatProducts(order.products || [])}
    
    <a href="${baseUrl}/orders" class="btn">View Order</a>
  `;
  const html = wrap(subject, 'Order Confirmed', body);
  return { subject, html, text: `Order #${ref} confirmed. Total: XAF ${(order.total_amount || 0).toLocaleString()}.` };
};

/* ─── PAYMENT CONFIRMED (Customer) ─── */
const paymentConfirmed = ({ order, customer, qrCode, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `💳 Payment Confirmed — #${ref}`;
  const body = `
    <p>Hi <strong>${customer.name || 'there'}</strong>,</p>
    <p>Payment received. Your order is now in processing.</p>
    
    <div class="card">
      <div class="card-row"><span class="card-label">Ref</span><span class="card-value">#${ref}</span></div>
      <div class="card-row"><span class="card-label">Amount</span><span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span></div>
    </div>
    
    <a href="${baseUrl}/orders" class="btn">Track Order</a>
  `;
  const html = wrap(subject, 'Payment Received', body);
  return { subject, html, text: `Payment confirmed for Order #${ref}.` };
};

/* ─── SHIPMENT STATUS CHANGED (Customer) ─── */
const shipmentStatusChanged = ({ shipment, order, recipient, status, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = order._id.toString().slice(-6).toUpperCase();
  const track = shipment.tracking_code;
  
  const messages = {
    'picked_up': 'Your order has been picked up and is on its way to you!',
    'in_transit': 'Your order is currently in transit.',
    'out_for_delivery': 'Your delivery is out for delivery. Expect it soon!',
    'delivered': 'Your order has been delivered. Thank you for shopping!',
    'failed': 'We had trouble delivering your order. We\'ll attempt again shortly.',
  };
  
  const msg = messages[status] || `Your shipment status has been updated to: ${status}.`;
  const subject = `📦 Delivery Update — ${status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
  const body = `
    <p>Hi <strong>${recipient.name || 'there'}</strong>,</p>
    <p>${msg}</p>
    
    <div class="card">
      <div class="card-row"><span class="card-label">Track</span><span class="card-value">${track}</span></div>
      <div class="card-row"><span class="card-label">Status</span><span class="card-value">${badge(status)}</span></div>
    </div>
    
    <a href="${baseUrl}/orders" class="btn">View Details</a>
  `;
  const html = wrap(subject, 'Shipment Update', body);
  return { subject, html, text: `Shipment ${track} is now ${status}.` };
};

/* ─── REFUND APPROVED (Customer) ─── */
const refundApproved = ({ order, customer, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `✅ Refund Approved — #${ref}`;
  const body = `
    <p>Hi <strong>${customer.name || 'there'}</strong>,</p>
    <p>Your refund has been processed and returned to your wallet.</p>
    
    <div class="card">
      <div class="card-row"><span class="card-label">Amount</span><span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span></div>
    </div>
    
    <a href="${baseUrl}/wallet" class="btn">View Wallet</a>
  `;
  const html = wrap(subject, 'Refund Processed', body);
  return { subject, html, text: `Refund approved for Order #${ref}.` };
};

/* ─── ORDER COMPLETED / ESCROW RELEASED (Vendor) ─── */
const orderCompleted = ({ order, vendor, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `🎉 Order Completed & Payment Released — #${ref}`;
  const body = `
    <p>Hi <strong>${vendor.store_name || 'there'}</strong>,</p>
    <p>Order completed! Funds have been released to your wallet.</p>
    
    <div class="card">
      <div class="card-row"><span class="card-label">Ref</span><span class="card-value">#${ref}</span></div>
      <div class="card-row"><span class="card-label">Amount</span><span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span></div>
    </div>
    
    <a href="${baseUrl}/vendor/wallet" class="btn">View Wallet</a>
  `;
  const html = wrap(subject, 'Payment Released', body);
  return { subject, html, text: `Order #${ref} completed. Payment released.` };
};

/* ─── NEW ORDER FOR VENDOR ─── */
const newOrderForVendor = ({ order, vendor, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `🛒 New Order Received — #${ref}`;
  const body = `
    <p>Hi <strong>${vendor.store_name || 'there'}</strong>,</p>
    <p>You have a new order! Please prepare it for shipment.</p>
    
    <div class="card">
      <div class="card-row"><span class="card-label">Ref</span><span class="card-value">#${ref}</span></div>
      <div class="card-row"><span class="card-label">Total</span><span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span></div>
    </div>
    
    ${formatProducts(order.products || [])}
    <a href="${baseUrl}/vendor/orders" class="btn">Manage Order</a>
  `;
  const html = wrap(subject, 'New Order', body);
  return { subject, html, text: `New order #${ref} received.` };
};

/* ─── SHIPMENT ASSIGNED (Logistics) ─── */
const shipmentAssigned = ({ shipment, order, logistics, firm, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const ref = order._id.toString().slice(-6).toUpperCase();
  const track = shipment?.tracking_code || `ORD-${ref}`;
  const subject = `📦 New Shipment Assigned — ${track}`;
  const firmInfo = logistics || firm || {};
  
  const body = `
    <p>Hi <strong>${firmInfo.company_name || 'Partner'}</strong>,</p>
    <p>A new delivery assignment is ready for pickup.</p>
    
    <div class="card">
      <div class="card-row"><span class="card-label">Track</span><span class="card-value">${track}</span></div>
      <div class="card-row"><span class="card-label">Fee</span><span class="card-value">XAF ${(shipment?.price || order.shipping_fee || 0).toLocaleString()}</span></div>
    </div>
    
    <a href="${baseUrl}/logistics/shipments" class="btn">View Assignment</a>
  `;
  const html = wrap(subject, 'New Assignment', body);
  return { subject, html, text: `Shipment ${track} assigned.` };
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
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `📋 Order Update — #${ref}`;
  const status = order.order_status || 'updated';
  
  const body = `
    <p>Hi <strong>${customer.name || 'there'}</strong>,</p>
    <p>Order status updated to <strong>${status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong>.</p>
    
    <div class="card">
      <div class="card-row"><span class="card-label">Ref</span><span class="card-value">#${ref}</span></div>
      <div class="card-row"><span class="card-label">Status</span><span class="card-value">${badge(status)}</span></div>
    </div>
    
    ${qrSection(qrCode)}
    <a href="${baseUrl}/orders" class="btn">View Details</a>
  `;
  const html = wrap(subject, 'Order Update', body);
  return { subject, html, text: `Order #${ref} status updated to ${status}.` };
};

module.exports = {
  welcomeEmail,
  passwordReset,
  orderPlaced,
  paymentConfirmed,
  shipmentStatusChanged,
  refundApproved,
  orderCompleted,
  newOrderForVendor,
  shipmentAssigned,
  refundRequested,
  orderStatusUpdated,
  wrap,
};
