/**
 * utils/emailTemplates.js
 * Aura Market — Premium Email Templates
 * Professional design with logo, clean aesthetic, minimal colors
 */

const WEB_URL = process.env.WEB_CLIENT_URL || 'https://aura-market-com.vercel.app/';
const LOGO_URL = process.env.EMAIL_LOGO_URL || 'https://aura-market-com.vercel.app/icon-512.png';
const SUPPORT_EMAIL = process.env.EMAIL_USER || 'info@audienceaura.org';

// App brand colors (Darker, Premium palette)
const COLORS = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f4f4f4',
  border: '#eeeeee',
  textPrimary: '#111111',
  textSecondary: '#444444',
  accent: '#a30ba3', // Deeper Magenta
  accentDark: '#800880', // Darker Purple
  accentGlow: 'rgba(163, 11, 163, 0.04)', // Subtle brand tint
  gradient: 'linear-gradient(135deg, #a30ba3 0%, #600660 100%)',
  footerBg: '#1a051a', // Very dark purple for footer
};

/* ─── Premium Email Wrapper ─── */
const wrap = (title, heading, body) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${COLORS.bgSecondary}; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; color: ${COLORS.textPrimary}; line-height: 1.5; font-size: 13px; padding: 0; -webkit-font-smoothing: antialiased; }
    
    .email-wrapper { width: 100%; padding: 20px 10px; background: ${COLORS.bgSecondary}; }
    .email-container { max-width: 540px; width: 100%; margin: 0 auto; background: ${COLORS.bgPrimary}; border: 1px solid ${COLORS.border}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
    
    .header { padding: 20px 24px; background: ${COLORS.gradient}; display: flex; align-items: center; gap: 10px; color: #ffffff; }
    .header-logo { height: 28px; width: 28px; border-radius: 6px; border: 1.5px solid rgba(255,255,255,0.2); background: #ffffff; padding: 2px; object-fit: contain; }
    .header-title { color: #ffffff; font-size: 15px; font-weight: 900; letter-spacing: -1px; margin: 0; text-transform: none; }
    
    .content { padding: 24px; }
    .content h2 { font-size: 18px; color: ${COLORS.textPrimary}; margin-bottom: 14px; font-weight: 900; letter-spacing: -0.8px; line-height: 1.1; }
    .content p { font-size: 13px; color: ${COLORS.textSecondary}; margin-bottom: 12px; line-height: 1.6; }
    .content strong { color: ${COLORS.textPrimary}; font-weight: 800; }
    
    .card { background: ${COLORS.accentGlow}; border: 1px solid rgba(163, 11, 163, 0.08); border-radius: 10px; padding: 14px; margin: 16px 0; }
    .card-row { display: flex; justify-content: space-between; padding: 8px 0; align-items: center; }
    .card-row:not(:last-child) { border-bottom: 1px solid rgba(163, 11, 163, 0.05); }
    .card-label { color: ${COLORS.textSecondary}; font-weight: 900; text-transform: uppercase; font-size: 9px; letter-spacing: 0.15em; }
    .card-value { color: ${COLORS.textPrimary}; font-weight: 800; text-align: right; font-size: 12px; letter-spacing: -0.02em; }
    
    .role-badge { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; color: ${COLORS.accentDark}; }
    
    .status-badge { display: inline-block; padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; background: #ffffff; color: ${COLORS.accentDark}; border: 1px solid rgba(163, 11, 163, 0.15); }
    
    .btn { display: inline-block; background: ${COLORS.accent}; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin: 12px 0; transition: all 0.2s ease; border: none; text-align: center; box-shadow: 0 4px 10px rgba(163, 11, 163, 0.15); }
    .btn:hover { background: ${COLORS.accentDark}; transform: translateY(-1px); }
    
    .table-products { width: 100%; margin: 16px 0; border-collapse: separate; border-spacing: 0; font-size: 12px; border: 1px solid ${COLORS.border}; border-radius: 10px; overflow: hidden; }
    .table-products thead { background: ${COLORS.bgSecondary}; }
    .table-products th { padding: 10px; text-align: left; font-weight: 900; color: ${COLORS.textPrimary}; font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid ${COLORS.border}; }
    .table-products td { padding: 10px; border-bottom: 1px solid ${COLORS.border}; color: ${COLORS.textSecondary}; font-weight: 500; }
    .table-products td.number { text-align: center; font-weight: 800; }
    .table-products td.amount { text-align: right; font-weight: 900; color: ${COLORS.textPrimary}; letter-spacing: -0.02em; }
    .table-products tbody tr:last-child td { border-bottom: none; }
    
    .footer { padding: 32px 24px; text-align: center; background: ${COLORS.footerBg}; color: #ffffff; }
    .footer p { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); margin: 6px 0; }
    .footer a { color: #ffffff; text-decoration: none; font-weight: 900; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 1px; }
    .footer-brand { font-size: 13px; font-weight: 900; color: #ffffff; margin-bottom: 10px !important; letter-spacing: -0.8px; text-transform: none; }
    
    .highlight { background: ${COLORS.accentGlow}; border-left: 3px solid ${COLORS.accent}; padding: 12px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .highlight p { margin: 0; font-size: 12.5px; color: ${COLORS.textPrimary}; font-weight: 600; }
    
    .qr-container { text-align: center; margin: 16px 0; padding: 14px; border: 1.5px dashed rgba(163, 11, 163, 0.15); border-radius: 12px; background: #ffffff; }
    .qr-image { width: 100px; height: 100px; margin-bottom: 8px; border-radius: 8px; }
    .qr-text { font-size: 10px; color: ${COLORS.textSecondary}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; max-width: 180px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <img src="${LOGO_URL}" alt="Aura" class="header-logo" />
        <h1 class="header-title">Aura Market</h1>
      </div>
      <div class="content">
        <h2>${heading}</h2>
        ${body}
      </div>
      <div class="footer">
        <p class="footer-brand">Aura Market</p>
        <p>Questions? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
        <p>© ${new Date().getFullYear()} Aura Market • Audience Aura Org</p>
      </div>
    </div>
  </div>
</body>
</html>`;

/* ─── Welcome / Sign Up (new template) ─── */
const welcomeEmail = ({ user, webUrl }) => {
  const baseUrl = webUrl || WEB_URL;
  const subject = '🎉 Welcome to Aura Market';
  const body = `
    <p>Hi <strong>${user.name || 'there'}</strong>,</p>
    <p>Welcome to Aura Market! Your account is active and ready for use.</p>
    
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
  const html = wrap(subject, 'Welcome to Aura', body);
  return { subject, html, text: `Welcome to Aura Market, ${user.name}!` };
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
  const label = status.replace(/_/g, ' ').toUpperCase();
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
  const subject = `📦 Delivery Update — ${status.replace(/_/g, ' ').toUpperCase()}`;
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
    <p>Order status updated to <strong>${status.replace(/_/g, ' ').toUpperCase()}</strong>.</p>
    
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
