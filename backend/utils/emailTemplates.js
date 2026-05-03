/**
 * utils/emailTemplates.js
 * Aura Market — Premium Email Templates
 * Professional design with logo, clean aesthetic, minimal colors
 */

const WEB_URL = process.env.WEB_CLIENT_URL || 'https://aura-market-com.vercel.app/';
const LOGO_URL = process.env.EMAIL_LOGO_URL || 'https://aura-market-com.vercel.app/icon-512.png';
const SUPPORT_EMAIL = process.env.EMAIL_USER || 'info@audienceaura.org';

// App brand colors (Minimalist structure with brand accents)
const COLORS = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f5f5f5',
  border: '#e5e5e5',
  textPrimary: '#111111',
  textSecondary: '#666666',
  accent: '#f20df2', // Primary magenta
  accentDark: '#d90bd9',
  accentGlow: 'rgba(242, 13, 242, 0.08)', // Subtle brand tint
};

/* ─── Premium Email Wrapper ─── */
const wrap = (title, heading, body) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${COLORS.bgSecondary}; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; color: ${COLORS.textPrimary}; line-height: 1.6; font-size: 13px; padding: 0; -webkit-font-smoothing: antialiased; }
    
    .email-wrapper { width: 100%; padding: 40px 16px; background: ${COLORS.bgSecondary}; }
    .email-container { max-width: 540px; width: 100%; margin: 0 auto; background: ${COLORS.bgPrimary}; border: 1px solid ${COLORS.accentGlow}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px ${COLORS.accentGlow}; }
    
    .header { padding: 24px; border-bottom: 1px solid ${COLORS.accentGlow}; display: flex; align-items: center; gap: 12px; background: ${COLORS.bgPrimary}; }
    .header-logo { height: 32px; width: 32px; border-radius: 50%; border: 1px solid ${COLORS.border}; object-fit: cover; }
    .header-title { color: ${COLORS.textPrimary}; font-size: 16px; font-weight: 700; letter-spacing: -0.3px; margin: 0; }
    
    .content { padding: 32px; }
    .content h2 { font-size: 18px; color: ${COLORS.textPrimary}; margin-bottom: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .content p { font-size: 13px; color: ${COLORS.textSecondary}; margin-bottom: 16px; line-height: 1.6; }
    .content strong { color: ${COLORS.textPrimary}; font-weight: 600; }
    
    .card { background: ${COLORS.bgPrimary}; border: 1px solid ${COLORS.accentGlow}; border-radius: 8px; padding: 16px; margin: 24px 0; }
    .card-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 13px; align-items: center; }
    .card-row:not(:last-child) { border-bottom: 1px solid ${COLORS.border}; }
    .card-label { color: ${COLORS.textSecondary}; font-weight: 500; }
    .card-value { color: ${COLORS.textPrimary}; font-weight: 600; text-align: right; }
    
    .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: ${COLORS.accentGlow}; color: ${COLORS.accentDark}; border: 1px solid rgba(242, 13, 242, 0.2); }
    
    .btn { display: inline-block; background: ${COLORS.accent}; color: #ffffff !important; text-decoration: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; font-size: 13px; margin: 24px 0; transition: background 0.2s ease; border: 1px solid ${COLORS.accent}; text-align: center; }
    .btn:hover { background: ${COLORS.accentDark}; border-color: ${COLORS.accentDark}; }
    
    .table-products { width: 100%; margin: 24px 0; border-collapse: collapse; font-size: 13px; border: 1px solid ${COLORS.accentGlow}; border-radius: 8px; overflow: hidden; }
    .table-products thead { background: ${COLORS.accentGlow}; border-bottom: 1px solid ${COLORS.accentGlow}; }
    .table-products th { padding: 10px 14px; text-align: left; font-weight: 600; color: ${COLORS.textPrimary}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .table-products td { padding: 14px; border-bottom: 1px solid ${COLORS.border}; color: ${COLORS.textSecondary}; }
    .table-products td.number { text-align: center; }
    .table-products td.amount { text-align: right; font-weight: 600; color: ${COLORS.textPrimary}; }
    .table-products tbody tr:last-child td { border-bottom: none; }
    
    .footer { border-top: 1px solid ${COLORS.accentGlow}; padding: 20px; text-align: center; background: ${COLORS.bgPrimary}; }
    .footer p { font-size: 11px; color: ${COLORS.textSecondary}; margin: 4px 0; }
    .footer a { color: ${COLORS.accentDark}; text-decoration: none; font-weight: 600; }
    .footer-brand { font-size: 13px; font-weight: 700; color: ${COLORS.textPrimary}; margin-bottom: 6px !important; letter-spacing: -0.2px; }
    
    .highlight { background: ${COLORS.accentGlow}; border-left: 3px solid ${COLORS.accent}; padding: 14px; margin: 24px 0; border-radius: 0 6px 6px 0; }
    .highlight p { margin: 0; font-size: 13px; color: ${COLORS.textPrimary}; }
    
    .qr-container { text-align: center; margin: 24px 0; padding: 20px; border: 1px dashed ${COLORS.accent}; border-radius: 8px; background: ${COLORS.accentGlow}; }
    .qr-image { width: 120px; height: 120px; margin-bottom: 10px; border-radius: 6px; }
    .qr-text { font-size: 11px; color: ${COLORS.accentDark}; font-weight: 600; }
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
        <span class="card-label">Type</span>
        <span class="card-value" style="text-transform: capitalize;">${user.role || 'Customer'}</span>
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
