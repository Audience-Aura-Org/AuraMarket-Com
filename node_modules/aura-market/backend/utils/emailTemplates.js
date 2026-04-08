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
    body { background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2c2c2c; line-height: 1.6; }
    .wrapper { background: #fafafa; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    
    .header { background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%); padding: 40px 32px; text-align: center; border-bottom: 1px solid rgba(233,69,96,0.1); }
    .header-logo { height: 32px; margin-bottom: 16px; }
    .header-title { color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0; }
    .header-subtitle { color: #adb5bd; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin-top: 8px; }
    
    .content { padding: 40px 32px; }
    .content h2 { font-size: 20px; color: #0f0f23; margin-bottom: 16px; font-weight: 700; letter-spacing: -0.3px; }
    .content p { font-size: 14px; color: #555555; margin-bottom: 16px; line-height: 1.8; }
    .content strong { color: #0f0f23; font-weight: 600; }
    
    .card { background: #fafafa; border: 1px solid #e8e8e8; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .card-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
    .card-label { color: #666666; font-weight: 500; }
    .card-value { color: #0f0f23; font-weight: 700; text-align: right; }
    .card-divider { border-top: 1px solid #e8e8e8; margin: 12px 0; }
    
    .status-badge { display: inline-block; padding: 6px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-pending { background: #fef3cd; color: #856404; }
    .badge-processing { background: #cfe2ff; color: #084298; }
    .badge-placed { background: #d1e7dd; color: #0f5132; }
    .badge-shipped { background: #d1e7dd; color: #0f5132; }
    .badge-delivered { background: #d1e7dd; color: #0f5132; }
    .badge-completed { background: #d1e7dd; color: #0f5132; }
    .badge-refunded { background: #e2e3e5; color: #404245; }
    .badge-failed { background: #f8d7da; color: #842029; }
    
    .btn { display: inline-block; background: #e94560; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; text-transform: uppercase; margin: 20px 0; transition: background 0.2s; }
    .btn:hover { background: #d63a52; }
    
    .table-products { width: 100%; margin: 20px 0; border-collapse: collapse; font-size: 13px; }
    .table-products thead { background: #f5f5f5; }
    .table-products th { padding: 12px; text-align: left; font-weight: 700; color: #666666; text-transform: uppercase; letter-spacing: 0.3px; font-size: 11px; }
    .table-products td { padding: 12px; border-bottom: 1px solid #f0f0f0; color: #555555; }
    .table-products td.number { text-align: center; }
    .table-products td.amount { text-align: right; font-weight: 600; color: #0f0f23; }
    .table-products tbody tr:last-child td { border-bottom: none; }
    
    .divider { border: none; border-top: 1px solid #e8e8e8; margin: 24px 0; }
    .spacer { height: 8px; }
    
    .footer { background: #f5f5f5; padding: 24px 32px; text-align: center; border-top: 1px solid #e8e8e8; }
    .footer p { font-size: 12px; color: #888888; margin: 4px 0; }
    .footer a { color: #e94560; text-decoration: none; font-weight: 600; }
    
    .highlight { background: #fef9f3; border-left: 3px solid #e94560; padding: 16px; margin: 20px 0; border-radius: 4px; }
    .highlight p { margin: 0; font-size: 13px; color: #555555; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="${LOGO_URL}" alt="Aura Market" class="header-logo" />
        <h1 class="header-title">Aura Market</h1>
        <p class="header-subtitle">Precision Commerce</p>
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
