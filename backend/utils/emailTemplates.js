/**
 * utils/emailTemplates.js
 * Aura Market — Premium Email Templates
 * Professional design with logo, clean aesthetic, minimal colors
 */

const WEB_URL = process.env.WEB_CLIENT_URL || 'https://aura-market-com.vercel.app/';
const LOGO_URL = process.env.EMAIL_LOGO_URL || 'https://aura-market-com.vercel.app/logo-white.png';

// App brand colors
const COLORS = {
  accent: '#f20df2',        // Primary magenta
  accentLight: '#f472b6',   // Light pink
  accentGlow: 'rgba(242, 13, 242, 0.12)',
  bgPrimary: '#ffffff',
  bgSecondary: '#f8f5f8',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
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
    body { background: ${COLORS.accentGlow}; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif; color: ${COLORS.textPrimary}; line-height: 1.6; font-size: 16px; padding: 0; }
    
    .email-wrapper { width: 100%; background: linear-gradient(180deg, ${COLORS.accent} 0%, ${COLORS.accentLight} 100%); padding: 40px 16px; }
    .email-container { max-width: 600px; width: 100%; margin: 0 auto; background: ${COLORS.bgPrimary}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    
    .header { background: linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.accentLight} 100%); padding: 24px 32px; text-align: center; position: relative; }
    .header::before { content: ''; position: absolute; top: -30%; right: -10%; width: 200px; height: 200px; background: rgba(255,255,255,0.1); border-radius: 50%; }
    .header::after { content: ''; position: absolute; bottom: -20%; left: -5%; width: 150px; height: 150px; background: rgba(255,255,255,0.08); border-radius: 50%; }
    .header-content { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 12px; }
    .header-logo { height: 36px; }
    .header-title { color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; margin: 0; font-family: 'Poppins', sans-serif; }
    .header-subtitle { display: none; }
    
    .content { padding: 40px 32px; }
    .content h2 { font-size: 24px; color: ${COLORS.textPrimary}; margin-bottom: 20px; font-weight: 800; letter-spacing: -0.5px; font-family: 'Poppins', sans-serif; }
    .content p { font-size: 15px; color: ${COLORS.textSecondary}; margin-bottom: 16px; line-height: 1.7; font-family: 'Poppins', sans-serif; }
    .content strong { color: ${COLORS.textPrimary}; font-weight: 700; font-family: 'Poppins', sans-serif; }
    
    .card { background: ${COLORS.bgPrimary}; border: 1px solid ${COLORS.accentGlow}; border-radius: 16px; padding: 24px; margin: 24px 0; box-shadow: 0 4px 20px rgba(242,13,242,0.08); }
    .card-row { display: flex; justify-content: space-between; padding: 14px 0; font-size: 15px; align-items: center; font-family: 'Poppins', sans-serif; }
    .card-row:not(:last-child) { border-bottom: 1px solid ${COLORS.accentGlow}; }
    .card-label { color: ${COLORS.textSecondary}; font-weight: 600; font-size: 14px; font-family: 'Poppins', sans-serif; }
    .card-value { color: ${COLORS.textPrimary}; font-weight: 700; text-align: right; font-family: 'Poppins', sans-serif; }
    .card-value.accent { color: ${COLORS.accent}; }
    
    .status-badge { display: inline-block; padding: 8px 16px; border-radius: 50px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; font-family: 'Poppins', sans-serif; }
    .badge-pending { background: #fef3cd; color: #856404; }
    .badge-processing { background: ${COLORS.accentGlow}; color: ${COLORS.accent}; }
    .badge-placed { background: ${COLORS.accentGlow}; color: ${COLORS.accent}; }
    .badge-shipped { background: ${COLORS.accentGlow}; color: ${COLORS.accent}; }
    .badge-delivered { background: #d1e7dd; color: #0f5132; }
    .badge-completed { background: #d1e7dd; color: #0f5132; }
    .badge-refunded { background: #e2e3e5; color: #404245; }
    .badge-failed { background: #f8d7da; color: #842029; }
    
    .btn { display: inline-block; background: linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.accentLight} 100%); color: #ffffff !important; text-decoration: none; padding: 12px 32px; border-radius: 12px; font-weight: 600; font-size: 15px; text-transform: capitalize; margin: 24px 0; transition: all 0.3s ease; box-shadow: 0 4px 20px rgba(242,13,242,0.3); border: none; cursor: pointer; font-family: 'Poppins', sans-serif; }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(242,13,242,0.4); }
    
    .table-products { width: 100%; margin: 24px 0; border-collapse: collapse; font-size: 14px; font-family: 'Poppins', sans-serif; border-radius: 12px; overflow: hidden; }
    .table-products thead { background: linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.accentLight} 100%); }
    .table-products th { padding: 16px; text-align: left; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; font-family: 'Poppins', sans-serif; }
    .table-products td { padding: 16px; border-bottom: 1px solid ${COLORS.accentGlow}; color: ${COLORS.textSecondary}; font-family: 'Poppins', sans-serif; background: ${COLORS.bgPrimary}; }
    .table-products td.number { text-align: center; font-weight: 600; }
    .table-products td.amount { text-align: right; font-weight: 700; color: ${COLORS.accent}; }
    .table-products tbody tr:last-child td { border-bottom: none; }
    .table-products tbody tr:hover td { background: ${COLORS.bgSecondary}; }
    
    .footer { background: ${COLORS.textPrimary}; padding: 32px; text-align: center; font-family: 'Poppins', sans-serif; }
    .footer p { font-size: 13px; color: rgba(255,255,255,0.7); margin: 6px 0; font-family: 'Poppins', sans-serif; }
    .footer a { color: ${COLORS.accentLight}; text-decoration: none; font-weight: 700; font-family: 'Poppins', sans-serif; }
    .footer-brand { font-size: 18px; font-weight: 800; color: #ffffff; margin-bottom: 8px !important; }
    
    .highlight { background: ${COLORS.accentGlow}; border-left: 4px solid ${COLORS.accent}; padding: 20px; margin: 24px 0; border-radius: 0 12px 12px 0; font-family: 'Poppins', sans-serif; }
    .highlight p { margin: 0; font-size: 14px; color: ${COLORS.textSecondary}; line-height: 1.7; font-family: 'Poppins', sans-serif; }
    
    .qr-container { text-align: center; margin: 32px 0; padding: 24px; background: ${COLORS.bgSecondary}; border-radius: 20px; border: 2px dashed ${COLORS.accentGlow}; }
    .qr-image { width: 160px; height: 160px; margin-bottom: 12px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
    .qr-text { font-size: 13px; color: ${COLORS.textSecondary}; font-weight: 500; font-family: 'Poppins', sans-serif; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <div class="header-content">
          <img src="${LOGO_URL}" alt="Aura Market" class="header-logo" onerror="this.style.display='none'" />
          <h1 class="header-title">Aura Market</h1>
          <p class="header-subtitle">Premium Commerce Platform</p>
        </div>
      </div>
      <div class="content">
        <h2>${heading}</h2>
        ${body}
      </div>
      <div class="footer">
        <p class="footer-brand">Aura Market</p>
        <p>Questions? <a href="mailto:support@auramarket.com">support@auramarket.com</a></p>
        <p>© ${new Date().getFullYear()} Aura Market • Audience Aura Org</p>
      </div>
    </div>
  </div>
</body>
</html>`;

/* ─── Welcome / Sign Up (new template) ─── */
const welcomeEmail = ({ user }) => {
  const subject = '🎉 Welcome to Aura Market';
  const body = `
    <p>Hi <strong>${user.name || 'there'}</strong>,</p>
    <p>Welcome to Aura Market! Your account has been successfully created and you're ready to start shopping or selling on our platform.</p>
    
    <div class="card">
      <div class="card-row">
        <span class="card-label">Account Email</span>
        <span class="card-value">${user.email}</span>
      </div>
      <div class="card-divider"></div>
      <div class="card-row">
        <span class="card-label">Account Type</span>
        <span class="card-value" style="text-transform: capitalize;">${user.role || 'Customer'}</span>
      </div>
    </div>
    
    ${user.role === 'vendor' ? `<p><strong>Ready to start selling?</strong> Complete your store setup to begin listing products and reaching customers worldwide.</p><a href="${WEB_URL}/vendor/dashboard" class="btn">Complete Setup</a>` : `<p><strong>Ready to shop?</strong> Explore our curated collection of premium products from verified vendors.</p><a href="${WEB_URL}/discovery" class="btn">Start Shopping</a>`}
    
    <p style="margin-top: 24px; font-size: 13px; color: #888888;">If you didn't create this account, please ignore this email.</p>
  `;
  const html = wrap(subject, '✨ Welcome to Aura Market', body);
  return { subject, html, text: `Welcome to Aura Market, ${user.name}!` };
};

/* ─── Password Reset ─── */
const passwordReset = ({ user, resetLink }) => {
  const subject = '🔐 Reset Your Password';
  const body = `
    <p>Hi <strong>${user.name || 'there'}</strong>,</p>
    <p>We received a request to reset your password. Click the button below to set a new password. This link expires in 1 hour.</p>
    
    <div class="highlight">
      <p><strong>If you didn't request this,</strong> your account may be at risk. Please contact support immediately.</p>
    </div>
    
    <a href="${resetLink}" class="btn">Reset Password</a>
    
    <p style="font-size: 13px; color: #888888; margin-top: 20px;">Or copy and paste this link:<br/><code style="word-break: break-all; color: #666666;">${resetLink}</code></p>
  `;
  const html = wrap(subject, 'Password Reset Request', body);
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
const orderPlaced = ({ order, customer, qrCode }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `✅ Order Confirmed — #${ref}`;
  const body = `
    <p>Hi <strong>${customer.name || 'Valued Customer'}</strong>,</p>
    <p>Thank you for your order! We've received it and it's being prepared for shipment.</p>
    
    <div class="card">
      <div class="card-row">
        <span class="card-label">Order Reference</span>
        <span class="card-value">#${ref}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Status</span>
        <span class="card-value">${badge('placed')}</span>
      </div>
      <div class="card-divider"></div>
      <div class="card-row">
        <span class="card-label">Payment Method</span>
        <span class="card-value">${(order.payment_method || '').replace(/_/g, ' ')}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Order Total</span>
        <span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span>
      </div>
    </div>
    
    ${qrSection(qrCode)}
    
    ${formatProducts(order.products || [])}
    
    <a href="${WEB_URL}/orders" class="btn">View Order Details</a>
    
    <p style="margin-top: 20px; font-size: 13px; color: #888888;">You'll receive a tracking number once your order ships.</p>
  `;
  const html = wrap(subject, '✅ Order Confirmed', body);
  return { subject, html, text: `Order #${ref} confirmed. Total: XAF ${(order.total_amount || 0).toLocaleString()}.` };
};

/* ─── PAYMENT CONFIRMED (Customer) ─── */
const paymentConfirmed = ({ order, customer, qrCode }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `💳 Payment Confirmed — #${ref}`;
  const body = `
    <p>Hi <strong>${customer.name || 'Valued Customer'}</strong>,</p>
    <p>Your payment has been successfully received. Your order is now being processed and packaged for shipment.</p>
    
    <div class="card">
      <div class="card-row">
        <span class="card-label">Order Reference</span>
        <span class="card-value">#${ref}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Amount Paid</span>
        <span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span>
      </div>
      <div class="card-divider"></div>
      <div class="card-row">
        <span class="card-label">Status</span>
        <span class="card-value">${badge('processing')}</span>
      </div>
    </div>
    
    ${qrSection(qrCode)}
    
    <a href="${WEB_URL}/orders" class="btn">Track Your Order</a>
  `;
  const html = wrap(subject, '💳 Payment Received', body);
  return { subject, html, text: `Payment confirmed for Order #${ref}.` };
};

/* ─── SHIPMENT STATUS CHANGED (Customer) ─── */
const shipmentStatusChanged = ({ shipment, order, recipient, status }) => {
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
      <div class="card-row">
        <span class="card-label">Tracking Code</span>
        <span class="card-value">${track}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Order Reference</span>
        <span class="card-value">#${ref}</span>
      </div>
      <div class="card-divider"></div>
      <div class="card-row">
        <span class="card-label">Current Status</span>
        <span class="card-value">${badge(status)}</span>
      </div>
    </div>
    
    <a href="${WEB_URL}/orders" class="btn">View Details</a>
  `;
  const html = wrap(subject, '📦 Shipment Update', body);
  return { subject, html, text: `Shipment ${track} is now ${status}.` };
};

/* ─── REFUND APPROVED (Customer) ─── */
const refundApproved = ({ order, customer }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `✅ Refund Approved — #${ref}`;
  const body = `
    <p>Hi <strong>${customer.name || 'Valued Customer'}</strong>,</p>
    <p>Your refund has been approved and the funds have been returned to your wallet.</p>
    
    <div class="card">
      <div class="card-row">
        <span class="card-label">Order Reference</span>
        <span class="card-value">#${ref}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Refunded Amount</span>
        <span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span>
      </div>
      <div class="card-divider"></div>
      <div class="card-row">
        <span class="card-label">Status</span>
        <span class="card-value">${badge('refunded')}</span>
      </div>
    </div>
    
    <a href="${WEB_URL}/wallet" class="btn">View Wallet</a>
  `;
  const html = wrap(subject, '✅ Refund Processed', body);
  return { subject, html, text: `Refund approved for Order #${ref}.` };
};

/* ─── ORDER COMPLETED / ESCROW RELEASED (Vendor) ─── */
const orderCompleted = ({ order, vendor }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `🎉 Order Completed & Payment Released — #${ref}`;
  const body = `
    <p>Hi <strong>${vendor.store_name || 'Vendor'}</strong>,</p>
    <p>Delivery has been confirmed! Your payment for this order has been released to your wallet.</p>
    
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
        <span class="card-label">Status</span>
        <span class="card-value">${badge('completed')}</span>
      </div>
    </div>
    
    <a href="${WEB_URL}/vendor/wallet" class="btn">View Wallet</a>
  `;
  const html = wrap(subject, '🎉 Payment Released', body);
  return { subject, html, text: `Order #${ref} completed. Payment released.` };
};

/* ─── NEW ORDER FOR VENDOR ─── */
const newOrderForVendor = ({ order, vendor }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `🛒 New Order Received — #${ref}`;
  const body = `
    <p>Hi <strong>${vendor.store_name || 'Vendor'}</strong>,</p>
    <p>A customer just placed a new order from your store! Please review and prepare for shipment.</p>
    
    <div class="card">
      <div class="card-row">
        <span class="card-label">Order Reference</span>
        <span class="card-value">#${ref}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Order Total</span>
        <span class="card-value">XAF ${(order.total_amount || 0).toLocaleString()}</span>
      </div>
      <div class="card-divider"></div>
      <div class="card-row">
        <span class="card-label">Status</span>
        <span class="card-value">${badge('placed')}</span>
      </div>
    </div>
    
    ${formatProducts(order.products || [])}
    
    <a href="${WEB_URL}/vendor/orders" class="btn">Manage Orders</a>
  `;
  const html = wrap(subject, '🛒 New Order', body);
  return { subject, html, text: `New order #${ref} received.` };
};

/* ─── SHIPMENT ASSIGNED (Logistics) ─── */
const shipmentAssigned = ({ shipment, order, logistics, firm }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const track = shipment?.tracking_code || `ORD-${ref}`;
  const subject = `📦 New Shipment Assigned — ${track}`;
  const firmInfo = logistics || firm || {};
  
  const body = `
    <p>Hi <strong>${firmInfo.company_name || 'Logistics Partner'}</strong>,</p>
    <p>A new delivery assignment has been created for your company. Please pick up and deliver according to the details below.</p>
    
    <div class="card">
      <div class="card-row">
        <span class="card-label">Tracking Code</span>
        <span class="card-value" style="font-family: monospace;">${track}</span>
      </div>
      <div class="card-row">
        <span class="card-label">Order Reference</span>
        <span class="card-value">#${ref}</span>
      </div>
      <div class="card-divider"></div>
      <div class="card-row">
        <span class="card-label">Delivery Fee</span>
        <span class="card-value">XAF ${(shipment?.price || order.shipping_fee || 0).toLocaleString()}</span>
      </div>
    </div>
    
    <a href="${WEB_URL}/logistics/shipments" class="btn">View Shipments</a>
  `;
  const html = wrap(subject, '📦 New Delivery Assignment', body);
  return { subject, html, text: `Shipment ${track} assigned.` };
};

/* ─── REFUND REQUESTED (Vendor) ─── */
const refundRequested = ({ order, vendor, reason }) => {
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
    
    <a href="${WEB_URL}/vendor/orders" class="btn">Review Request</a>
  `;
  const html = wrap(subject, '⚠️ Refund Request', body);
  return { subject, html, text: `Refund requested for Order #${ref}.` };
};

/* ─── ORDER STATUS UPDATED (Customer) ─── */
const orderStatusUpdated = ({ order, customer, qrCode }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `📋 Order Update — #${ref}`;
  const status = order.order_status || 'updated';
  
  const body = `
    <p>Hi <strong>${customer.name || 'Valued Customer'}</strong>,</p>
    <p>Your order status has been updated to <strong>${status.replace(/_/g, ' ').toUpperCase()}</strong>.</p>
    
    <div class="card">
      <div class="card-row">
        <span class="card-label">Order Reference</span>
        <span class="card-value">#${ref}</span>
      </div>
      <div class="card-row">
        <span class="card-label">New Status</span>
        <span class="card-value">${badge(status)}</span>
      </div>
    </div>
    
    ${qrSection(qrCode)}
    
    <a href="${WEB_URL}/orders" class="btn">View Order Details</a>
  `;
  const html = wrap(subject, '📋 Order Update', body);
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
