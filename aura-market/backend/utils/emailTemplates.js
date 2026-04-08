/**
 * utils/emailTemplates.js
 * Aura Market — Premium Email Templates
 * Professional design with logo, clean aesthetic, minimal colors
 */

const WEB_URL = process.env.WEB_CLIENT_URL || 'https://auramarket.com';
const LOGO_URL = 'https://aura-market-frontend.s3.eu-north-1.amazonaws.com/logo-white.png';

/* ─── Premium Email Wrapper ─── */
const wrap = (title, heading, body) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: linear-gradient(135deg, #f5f5f7 0%, #fafafa 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif; color: #1d1d1f; line-height: 1.6; }
    .wrapper { background: linear-gradient(135deg, #f5f5f7 0%, #fafafa 100%); padding: 30px 16px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.08); border: 1px solid rgba(233,69,96,0.1); }
    
    .header { background: linear-gradient(135deg, #e94560 0%, #d4365a 100%); padding: 48px 32px; text-align: center; position: relative; }
    .header::before { content: ''; position: absolute; top: 0; right: 0; width: 200px; height: 200px; background: rgba(255,255,255,0.1); border-radius: 50%; transform: translate(100px, -50px); }
    .header-logo { height: 36px; margin-bottom: 20px; position: relative; z-index: 1; }
    .header-title { color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.8px; margin: 0; position: relative; z-index: 1; }
    .header-subtitle { color: rgba(255,255,255,0.9); font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-top: 12px; font-weight: 600; position: relative; z-index: 1; }
    
    .content { padding: 48px 40px; }
    .content h2 { font-size: 22px; color: #1d1d1f; margin-bottom: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .content p { font-size: 15px; color: #333333; margin-bottom: 18px; line-height: 1.8; }
    .content strong { color: #1d1d1f; font-weight: 700; }
    
    .card { background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%); border: 1.5px solid #e8e8e8; border-radius: 10px; padding: 24px; margin: 24px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
    .card:hover { border-color: #e94560; box-shadow: 0 4px 16px rgba(233,69,96,0.12); }
    .card-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 15px; align-items: baseline; }
    .card-label { color: #666666; font-weight: 600; font-size: 14px; }
    .card-value { color: #1d1d1f; font-weight: 800; text-align: right; }
    .card-divider { border-top: 1.5px solid #f0f0f0; margin: 16px 0; }
    
    .status-badge { display: inline-block; padding: 8px 16px; border-radius: 50px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; }
    .badge-pending { background: #fef3cd; color: #856404; }
    .badge-processing { background: #cfe2ff; color: #084298; }
    .badge-placed { background: #d1e7dd; color: #0f5132; }
    .badge-shipped { background: #cfe2ff; color: #084298; }
    .badge-delivered { background: #d1e7dd; color: #0f5132; }
    .badge-completed { background: #d1e7dd; color: #0f5132; }
    .badge-refunded { background: #e2e3e5; color: #404245; }
    .badge-failed { background: #f8d7da; color: #842029; }
    
    .btn { display: inline-block; background: linear-gradient(135deg, #e94560 0%, #d4365a 100%); color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 800; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; margin: 24px 0; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(233,69,96,0.3); border: none; cursor: pointer; }
    .btn:hover { background: linear-gradient(135deg, #d4365a 0%, #b92c4a 100%); box-shadow: 0 8px 24px rgba(233,69,96,0.4); transform: translateY(-2px); }
    
    .table-products { width: 100%; margin: 24px 0; border-collapse: collapse; font-size: 14px; }
    .table-products thead { background: linear-gradient(135deg, #f0f0f0 0%, #fafafa 100%); }
    .table-products th { padding: 14px 12px; text-align: left; font-weight: 800; color: #1d1d1f; text-transform: uppercase; letter-spacing: 0.5px; font-size: 12px; border-bottom: 2px solid #e8e8e8; }
    .table-products td { padding: 13px 12px; border-bottom: 1px solid #f0f0f0; color: #555555; }
    .table-products td.number { text-align: center; font-weight: 600; }
    .table-products td.amount { text-align: right; font-weight: 700; color: #e94560; }
    .table-products tbody tr:last-child td { border-bottom: none; }
    .table-products tbody tr:hover { background: #f9fafb; }
    
    .divider { border: none; border-top: 1.5px solid #e8e8e8; margin: 28px 0; }
    .spacer { height: 8px; }
    
    .footer { background: linear-gradient(135deg, #f5f5f7 0%, #fafafa 100%); padding: 32px 40px; text-align: center; border-top: 1.5px solid #e8e8e8; }
    .footer p { font-size: 12px; color: #888888; margin: 6px 0; }
    .footer a { color: #e94560; text-decoration: none; font-weight: 700; }
    
    .highlight { background: linear-gradient(135deg, #fff8f0 0%, #fffaf5 100%); border-left: 4px solid #e94560; padding: 18px; margin: 24px 0; border-radius: 8px; }
    .highlight p { margin: 0; font-size: 14px; color: #555555; line-height: 1.7; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="${LOGO_URL}" alt="Aura Market" class="header-logo" />
        <h1 class="header-title">Aura Market</h1>
        <p class="header-subtitle">Premium Commerce Platform</p>
      </div>
      <div class="content">
        <h2>${heading}</h2>
        ${body}
      </div>
      <div class="footer">
        <p>Questions? <a href="mailto:support@auramarket.com">support@auramarket.com</a></p>
        <p style="margin-top: 8px; opacity: 0.7;">© ${new Date().getFullYear()} Aura Market • Audience Aura Org</p>
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

/* ─── ORDER PLACED (Customer) ─── */
const orderPlaced = ({ order, customer }) => {
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
    
    ${formatProducts(order.products || [])}
    
    <a href="${WEB_URL}/orders" class="btn">View Order</a>
    
    <p style="margin-top: 20px; font-size: 13px; color: #888888;">You'll receive a tracking number once your order ships.</p>
  `;
  const html = wrap(subject, '✅ Order Confirmed', body);
  return { subject, html, text: `Order #${ref} confirmed. Total: XAF ${(order.total_amount || 0).toLocaleString()}.` };
};

/* ─── PAYMENT CONFIRMED (Customer) ─── */
const paymentConfirmed = ({ order, customer }) => {
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
    
    <a href="${WEB_URL}/orders" class="btn">Track Order</a>
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
const shipmentAssigned = ({ shipment, order, firm }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const track = shipment.tracking_code;
  const subject = `📦 New Shipment Assigned — ${track}`;
  const body = `
    <p>Hi <strong>${firm.company_name || 'Logistics Partner'}</strong>,</p>
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
        <span class="card-value">XAF ${(shipment.price || 0).toLocaleString()}</span>
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
};
