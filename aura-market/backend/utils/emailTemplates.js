/**
 * utils/emailTemplates.js
 * Aura Market — Centralized Email HTML Templates
 * Covers: Order placed, payment confirmed, shipment created/status changed,
 *         refund requested/approved, delivery confirmed.
 */

const WEB_URL = process.env.WEB_CLIENT_URL || 'https://auramarket.com';

/* ─── Shared layout wrapper ─── */
const wrap = (title, body) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#f5f5f5; font-family:'Segoe UI',Arial,sans-serif; color:#333; }
    .container { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%); padding:32px 40px; text-align:center; }
    .header img { height:40px; margin-bottom:12px; }
    .header h1 { margin:0; color:#e94560; font-size:22px; font-weight:700; letter-spacing:.5px; }
    .header p  { margin:6px 0 0; color:#aaa; font-size:13px; }
    .body { padding:32px 40px; }
    .body h2 { margin:0 0 8px; font-size:18px; color:#1a1a2e; }
    .body p  { margin:0 0 16px; line-height:1.7; color:#555; font-size:14px; }
    .info-box { background:#f9f9f9; border-left:4px solid #e94560; border-radius:6px; padding:16px 20px; margin:16px 0; }
    .info-box p { margin:4px 0; font-size:14px; }
    .info-box strong { color:#1a1a2e; }
    .status-badge { display:inline-block; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
    .status-placed       { background:#e3f2fd; color:#1565c0; }
    .status-processing   { background:#fff8e1; color:#f57f17; }
    .status-shipped      { background:#e8f5e9; color:#2e7d32; }
    .status-delivered    { background:#e8f5e9; color:#1b5e20; }
    .status-completed    { background:#e8f5e9; color:#1b5e20; }
    .status-refund_pending  { background:#fce4ec; color:#b71c1c; }
    .status-refunded     { background:#ede7f6; color:#4527a0; }
    .status-cancelled    { background:#ffebee; color:#c62828; }
    .status-pending      { background:#fff3e0; color:#e65100; }
    .status-picked_up    { background:#e3f2fd; color:#0d47a1; }
    .status-in_transit   { background:#f3e5f5; color:#6a1b9a; }
    .status-out_for_delivery { background:#e8f5e9; color:#2e7d32; }
    .status-failed       { background:#ffebee; color:#c62828; }
    .btn { display:inline-block; background:#e94560; color:#fff!important; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:700; font-size:14px; margin:8px 0; }
    .divider { border:none; border-top:1px solid #eee; margin:24px 0; }
    .footer { background:#f9f9f9; padding:20px 40px; text-align:center; }
    .footer p { margin:0; font-size:12px; color:#999; line-height:1.8; }
    .footer a { color:#e94560; text-decoration:none; }
    table.products { width:100%; border-collapse:collapse; margin:16px 0; }
    table.products th { background:#f5f5f5; text-align:left; padding:10px 12px; font-size:12px; color:#888; text-transform:uppercase; }
    table.products td { padding:10px 12px; border-bottom:1px solid #f0f0f0; font-size:13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Aura Market</h1>
      <p>Your Premium Shopping Destination</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>Questions? <a href="mailto:info@audienceaura.org">info@audienceaura.org</a></p>
      <p style="margin-top:8px;">© ${new Date().getFullYear()} Aura Market · Audience Aura Org</p>
    </div>
  </div>
</body>
</html>`;

/* ─── Helper: product rows ─── */
const productRows = (products = []) =>
  products.map(p => `
    <tr>
      <td>${p.name}</td>
      <td style="text-align:center;">${p.quantity}</td>
      <td style="text-align:right;">₦${(p.price * p.quantity).toLocaleString()}</td>
    </tr>`).join('');

/* ─── Helper: status badge ─── */
const badge = (status) =>
  `<span class="status-badge status-${status}">${status.replace(/_/g, ' ')}</span>`;


/* ═══════════════════════════════════════════════
   ORDER PLACED  (sent to customer)
   ═══════════════════════════════════════════════ */
const orderPlaced = ({ order, customer }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const products = order.products || [];
  const subject = `✅ Order Confirmed — #${ref}`;
  const html = wrap(subject, `
    <h2>Your order is confirmed! 🎉</h2>
    <p>Hi <strong>${customer.name || 'Valued Customer'}</strong>, thanks for shopping with Aura Market. We've received your order and it's now being processed.</p>
    <div class="info-box">
      <p><strong>Order Reference:</strong> #${ref}</p>
      <p><strong>Status:</strong> ${badge('placed')}</p>
      <p><strong>Payment Method:</strong> ${order.payment_method?.replace(/_/g, ' ')}</p>
      <p><strong>Total:</strong> ₦${order.total_amount?.toLocaleString()}</p>
    </div>
    <table class="products">
      <thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Subtotal</th></tr></thead>
      <tbody>${productRows(products)}</tbody>
    </table>
    <hr class="divider"/>
    <p>You'll receive another update once your order is shipped. <a class="btn" href="${WEB_URL}/orders">View Order</a></p>
  `);
  return { subject, html, text: `Order #${ref} confirmed. Total: ₦${order.total_amount?.toLocaleString()}.` };
};


/* ═══════════════════════════════════════════════
   NEW ORDER ALERT  (sent to vendor)
   ═══════════════════════════════════════════════ */
const newOrderForVendor = ({ order, vendor }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `🛒 New Order Received — #${ref}`;
  const html = wrap(subject, `
    <h2>You have a new order! 🛍️</h2>
    <p>Hi <strong>${vendor.store_name || 'Vendor'}</strong>, a customer just placed an order from your store.</p>
    <div class="info-box">
      <p><strong>Order Reference:</strong> #${ref}</p>
      <p><strong>Status:</strong> ${badge('placed')}</p>
      <p><strong>Payment Method:</strong> ${order.payment_method?.replace(/_/g, ' ')}</p>
      <p><strong>Order Total:</strong> ₦${order.total_amount?.toLocaleString()}</p>
    </div>
    <table class="products">
      <thead><tr><th>Item</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Subtotal</th></tr></thead>
      <tbody>${productRows(order.products)}</tbody>
    </table>
    <a class="btn" href="${WEB_URL}/vendor/orders">Manage Orders</a>
  `);
  return { subject, html, text: `New order #${ref} placed at your store.` };
};


/* ═══════════════════════════════════════════════
   PAYMENT CONFIRMED  (customer)
   ═══════════════════════════════════════════════ */
const paymentConfirmed = ({ order, customer }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `💳 Payment Confirmed — #${ref}`;
  const html = wrap(subject, `
    <h2>Payment received! 💳</h2>
    <p>Hi <strong>${customer.name || 'Valued Customer'}</strong>, your payment for Order <strong>#${ref}</strong> has been successfully confirmed.</p>
    <div class="info-box">
      <p><strong>Order Reference:</strong> #${ref}</p>
      <p><strong>Amount Paid:</strong> ₦${order.total_amount?.toLocaleString()}</p>
      <p><strong>Status:</strong> ${badge('processing')}</p>
    </div>
    <p>Your order is now in processing and will be dispatched soon.</p>
    <a class="btn" href="${WEB_URL}/orders">Track Your Order</a>
  `);
  return { subject, html, text: `Payment confirmed for Order #${ref}.` };
};


/* ═══════════════════════════════════════════════
   SHIPMENT CREATED  (logistics firm)
   ═══════════════════════════════════════════════ */
const shipmentAssigned = ({ shipment, order, firm }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const track = shipment.tracking_code;
  const subject = `📦 New Shipment Assigned — ${track}`;
  const html = wrap(subject, `
    <h2>New delivery assignment! 🚚</h2>
    <p>Hi <strong>${firm.company_name || 'Logistics Partner'}</strong>, a new shipment has been assigned to your company.</p>
    <div class="info-box">
      <p><strong>Tracking Code:</strong> ${track}</p>
      <p><strong>Order Reference:</strong> #${ref}</p>
      <p><strong>Status:</strong> ${badge('pending')}</p>
      <p><strong>Delivery Fee:</strong> ₦${shipment.price?.toLocaleString()}</p>
    </div>
    <div class="info-box">
      <p><strong>Pickup Address:</strong><br/>
        ${shipment.pickup_address?.street || ''}, ${shipment.pickup_address?.city || ''}<br/>
        ${shipment.pickup_address?.region || ''}
      </p>
      <p style="margin-top:12px;"><strong>Delivery Address:</strong><br/>
        ${shipment.delivery_address?.street || ''}, ${shipment.delivery_address?.city || ''}<br/>
        Quartier: ${shipment.delivery_address?.quartier || ''}
      </p>
    </div>
    ${shipment.delivery_description ? `<p><strong>Note:</strong> ${shipment.delivery_description}</p>` : ''}
    <a class="btn" href="${WEB_URL}/logistics/shipments">View Shipments</a>
  `);
  return { subject, html, text: `Shipment ${track} assigned. Order #${ref}.` };
};


/* ═══════════════════════════════════════════════
   SHIPMENT STATUS CHANGED  (customer + vendor)
   ═══════════════════════════════════════════════ */
const shipmentStatusChanged = ({ shipment, order, recipient, status }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const track = shipment.tracking_code;

  const statusMessages = {
    picked_up:        'Your order has been picked up from the vendor and is on its way!',
    in_transit:       'Your order is currently in transit.',
    out_for_delivery: 'Your order is out for delivery — expect it soon!',
    delivered:        'Your order has been delivered successfully. Enjoy! 🎉',
    failed:           'Unfortunately, our courier was unable to deliver your order. We will reattempt delivery.',
  };

  const msg = statusMessages[status] || `Your shipment status has been updated to: ${status}.`;
  const subject = `📦 Shipment Update — ${status.replace(/_/g, ' ').toUpperCase()} [${track}]`;
  const html = wrap(subject, `
    <h2>Shipment Status Update</h2>
    <p>Hi <strong>${recipient.name || 'there'}</strong>,</p>
    <p>${msg}</p>
    <div class="info-box">
      <p><strong>Tracking Code:</strong> ${track}</p>
      <p><strong>Order Reference:</strong> #${ref}</p>
      <p><strong>New Status:</strong> ${badge(status)}</p>
      ${shipment.proof_of_delivery?.receiver_name ? `<p><strong>Received By:</strong> ${shipment.proof_of_delivery.receiver_name}</p>` : ''}
    </div>
    <a class="btn" href="${WEB_URL}/orders">View Order Details</a>
  `);
  return { subject, html, text: `Shipment ${track} is now ${status} (Order #${ref}).` };
};


/* ═══════════════════════════════════════════════
   REFUND REQUESTED  (vendor)
   ═══════════════════════════════════════════════ */
const refundRequested = ({ order, vendor, reason }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `⚠️ Refund Request — Order #${ref}`;
  const html = wrap(subject, `
    <h2>A customer has requested a refund</h2>
    <p>Hi <strong>${vendor.store_name || 'Vendor'}</strong>, a refund has been requested for Order <strong>#${ref}</strong>.</p>
    <div class="info-box">
      <p><strong>Order Reference:</strong> #${ref}</p>
      <p><strong>Amount:</strong> ₦${order.total_amount?.toLocaleString()}</p>
      <p><strong>Reason:</strong> ${reason || 'Not specified'}</p>
      <p><strong>Status:</strong> ${badge('refund_pending')}</p>
    </div>
    <p>Please review the request and approve or reject it from your dashboard.</p>
    <a class="btn" href="${WEB_URL}/vendor/orders">Review Request</a>
  `);
  return { subject, html, text: `Refund requested for Order #${ref}.` };
};


/* ═══════════════════════════════════════════════
   REFUND APPROVED  (customer)
   ═══════════════════════════════════════════════ */
const refundApproved = ({ order, customer }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `✅ Refund Approved — Order #${ref}`;
  const html = wrap(subject, `
    <h2>Your refund has been approved! 💸</h2>
    <p>Hi <strong>${customer.name || 'Valued Customer'}</strong>, your refund for Order <strong>#${ref}</strong> has been approved and funds have been returned to your wallet.</p>
    <div class="info-box">
      <p><strong>Order Reference:</strong> #${ref}</p>
      <p><strong>Refunded Amount:</strong> ₦${order.total_amount?.toLocaleString()}</p>
      <p><strong>Status:</strong> ${badge('refunded')}</p>
    </div>
    <p>The refunded amount should be reflected in your wallet immediately.</p>
    <a class="btn" href="${WEB_URL}/wallet">View Wallet</a>
  `);
  return { subject, html, text: `Refund approved for Order #${ref}.` };
};


/* ═══════════════════════════════════════════════
   ORDER COMPLETED / ESCROW RELEASED  (vendor)
   ═══════════════════════════════════════════════ */
const orderCompleted = ({ order, vendor }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `🎉 Order Completed & Payment Released — #${ref}`;
  const html = wrap(subject, `
    <h2>Payment released to your wallet! 🎉</h2>
    <p>Hi <strong>${vendor.store_name || 'Vendor'}</strong>, delivery has been confirmed and your payment for Order <strong>#${ref}</strong> has been released.</p>
    <div class="info-box">
      <p><strong>Order Reference:</strong> #${ref}</p>
      <p><strong>Amount:</strong> ₦${order.total_amount?.toLocaleString()}</p>
      <p><strong>Status:</strong> ${badge('completed')}</p>
    </div>
    <a class="btn" href="${WEB_URL}/vendor/wallet">View Wallet</a>
  `);
  return { subject, html, text: `Order #${ref} completed. Payment released.` };
};

/* ═══════════════════════════════════════════════
   ORDER STATUS UPDATE  (customer)
   ═══════════════════════════════════════════════ */
const orderStatusUpdated = ({ order, customer }) => {
  const ref = order._id.toString().slice(-6).toUpperCase();
  const subject = `📋 Order Update — #${ref}`;
  const html = wrap(subject, `
    <h2>Your order status has changed</h2>
    <p>Hi <strong>${customer.name || 'Valued Customer'}</strong>, your Order <strong>#${ref}</strong> status has been updated.</p>
    <div class="info-box">
      <p><strong>Order Reference:</strong> #${ref}</p>
      <p><strong>New Status:</strong> ${badge(order.order_status)}</p>
    </div>
    <a class="btn" href="${WEB_URL}/orders">View Order</a>
  `);
  return { subject, html, text: `Order #${ref} status updated to ${order.order_status}.` };
};


module.exports = {
  orderPlaced,
  newOrderForVendor,
  paymentConfirmed,
  shipmentAssigned,
  shipmentStatusChanged,
  refundRequested,
  refundApproved,
  orderCompleted,
  orderStatusUpdated,
};
