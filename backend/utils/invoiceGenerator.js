const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLORS = {
  ink: '#14110f',
  muted: '#6f6a66',
  faint: '#f6f2ef',
  line: '#eadfd8',
  accent: '#e05c2a',
  accentDark: '#b93f18',
  black: '#0f0d0c',
  green: '#15803d',
  red: '#b91c1c',
};

const money = (value = 0) => `${Number(value || 0).toLocaleString('en-US')} XAF`;
const clean = (value, fallback = '-') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).replace(/\s+/g, ' ').trim();
};

const resolveFont = (filename) => {
  const candidates = [
    path.join(__dirname, '..', 'assets', 'fonts', filename),
    path.join(__dirname, '..', 'public', 'fonts', filename),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
};

const registerFonts = (doc) => {
  const regular = resolveFont('Poppins-Regular.ttf');
  const medium = resolveFont('Poppins-Medium.ttf');
  const semibold = resolveFont('Poppins-SemiBold.ttf');
  const bold = resolveFont('Poppins-Bold.ttf');

  if (regular) doc.registerFont('Poppins', regular);
  if (medium) doc.registerFont('Poppins-Medium', medium);
  if (semibold) doc.registerFont('Poppins-SemiBold', semibold);
  if (bold) doc.registerFont('Poppins-Bold', bold);

  return {
    regular: regular ? 'Poppins' : 'Helvetica',
    medium: medium ? 'Poppins-Medium' : 'Helvetica',
    semibold: semibold ? 'Poppins-SemiBold' : 'Helvetica-Bold',
    bold: bold ? 'Poppins-Bold' : 'Helvetica-Bold',
  };
};

const setFont = (doc, fonts, weight = 'regular', size = 10, color = COLORS.ink) => {
  doc.font(fonts[weight] || fonts.regular).fontSize(size).fillColor(color);
};

const drawRoundedPanel = (doc, x, y, w, h, fill = '#ffffff', stroke = COLORS.line) => {
  doc.save();
  doc.roundedRect(x, y, w, h, 14).fill(fill);
  doc.roundedRect(x, y, w, h, 14).strokeColor(stroke).lineWidth(0.8).stroke();
  doc.restore();
};

const drawHeader = (doc, fonts, invoice) => {
  doc.save();
  doc.rect(0, 0, PAGE_W, 138).fill(COLORS.black);
  doc.rect(0, 132, PAGE_W, 6).fill(COLORS.accent);

  doc.circle(MARGIN + 23, 50, 23).fill(COLORS.accent);
  setFont(doc, fonts, 'bold', 18, '#ffffff');
  doc.text('AD', MARGIN + 9, 39, { width: 32, align: 'center' });

  setFont(doc, fonts, 'bold', 24, '#ffffff');
  doc.text('Aura Dime', MARGIN + 58, 30, { width: 260 });
  setFont(doc, fonts, 'medium', 8, '#d8d2ce');
  doc.text('Premium marketplace invoice', MARGIN + 60, 62, { width: 260 });
  doc.text('auradime.com', MARGIN + 60, 78, { width: 260 });

  setFont(doc, fonts, 'semibold', 9, '#f4e8e1');
  doc.text('COMMERCIAL INVOICE', PAGE_W - MARGIN - 190, 33, { width: 190, align: 'right' });
  setFont(doc, fonts, 'bold', 16, '#ffffff');
  doc.text(invoice.number, PAGE_W - MARGIN - 190, 52, { width: 190, align: 'right' });
  setFont(doc, fonts, 'regular', 8, '#d8d2ce');
  doc.text(`Issued ${invoice.date}`, PAGE_W - MARGIN - 190, 78, { width: 190, align: 'right' });

  doc.restore();
};

const drawFooter = (doc, fonts) => {
  const y = PAGE_H - 58;
  doc.save();
  doc.rect(0, y, PAGE_W, 58).fill(COLORS.black);
  setFont(doc, fonts, 'regular', 7.5, '#b9b2ad');
  doc.text(
    'Thank you for shopping with Auradime. Keep this invoice for your records. Support: support@auradime.com',
    MARGIN,
    y + 22,
    { width: CONTENT_W, align: 'center' }
  );
  doc.restore();
};

const drawBadge = (doc, fonts, label, value, x, y, w, color = COLORS.accent) => {
  drawRoundedPanel(doc, x, y, w, 48, '#ffffff');
  setFont(doc, fonts, 'semibold', 6.8, COLORS.muted);
  doc.text(label.toUpperCase(), x + 12, y + 11, { width: w - 24 });
  setFont(doc, fonts, 'bold', 10, color);
  doc.text(value, x + 12, y + 25, { width: w - 24, ellipsis: true });
};

const drawPartyBlock = (doc, fonts, title, lines, x, y, w) => {
  drawRoundedPanel(doc, x, y, w, 102, '#ffffff');
  setFont(doc, fonts, 'semibold', 7.2, COLORS.accent);
  doc.text(title.toUpperCase(), x + 16, y + 14, { width: w - 32 });
  setFont(doc, fonts, 'bold', 11, COLORS.ink);
  doc.text(lines[0], x + 16, y + 32, { width: w - 32, ellipsis: true });
  setFont(doc, fonts, 'regular', 8.2, COLORS.muted);
  doc.text(lines.slice(1).filter(Boolean).join('\n'), x + 16, y + 50, {
    width: w - 32,
    lineGap: 2,
    height: 42,
    ellipsis: true,
  });
};

const ensureSpace = (doc, fonts, y, needed) => {
  if (y + needed < PAGE_H - 78) return y;
  drawFooter(doc, fonts);
  doc.addPage({ margin: MARGIN, size: 'A4' });
  setFont(doc, fonts, 'bold', 10, COLORS.ink);
  doc.text('Auradime invoice continued', MARGIN, 28, { width: CONTENT_W });
  doc.moveTo(MARGIN, 48).lineTo(PAGE_W - MARGIN, 48).strokeColor(COLORS.line).lineWidth(0.8).stroke();
  return 68;
};

const drawTableHeader = (doc, fonts, y) => {
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 8).fill(COLORS.black);
  setFont(doc, fonts, 'semibold', 7.5, '#ffffff');
  doc.text('ITEM', MARGIN + 14, y + 10, { width: 250 });
  doc.text('QTY', MARGIN + 302, y + 10, { width: 42, align: 'right' });
  doc.text('PRICE', MARGIN + 360, y + 10, { width: 70, align: 'right' });
  doc.text('TOTAL', MARGIN + 442, y + 10, { width: CONTENT_W - 456, align: 'right' });
  return y + 34;
};

const drawTotals = (doc, fonts, order, y) => {
  const w = 240;
  const x = PAGE_W - MARGIN - w;
  drawRoundedPanel(doc, x, y, w, 120, '#ffffff');

  const rows = [
    ['Subtotal', money(order.subtotal)],
    ['Shipping', money(order.shipping_fee)],
    ['Total', money(order.total_amount), true],
  ];

  let rowY = y + 18;
  rows.forEach(([label, value, strong]) => {
    setFont(doc, fonts, strong ? 'bold' : 'regular', strong ? 11 : 8.5, strong ? COLORS.accent : COLORS.muted);
    doc.text(label, x + 16, rowY, { width: 86 });
    setFont(doc, fonts, strong ? 'bold' : 'semibold', strong ? 12 : 9, strong ? COLORS.accent : COLORS.ink);
    doc.text(value, x + 102, rowY - (strong ? 1 : 0), { width: w - 118, align: 'right' });
    rowY += strong ? 26 : 22;
    if (!strong) {
      doc.moveTo(x + 16, rowY - 8).lineTo(x + w - 16, rowY - 8).strokeColor(COLORS.line).lineWidth(0.6).stroke();
    }
  });

  setFont(doc, fonts, 'regular', 7.5, COLORS.muted);
  doc.text(`Payment method: ${clean(order.payment_method).replace(/_/g, ' ')}`, x + 16, y + 96, {
    width: w - 32,
    align: 'right',
  });
};

const generateInvoice = (order, callback) => {
  const doc = new PDFDocument({
    margin: MARGIN,
    size: 'A4',
    bufferPages: true,
    info: {
      Title: `Auradime Invoice ${order?._id || ''}`,
      Author: 'Auradime',
      Subject: 'Order invoice',
      Creator: 'Auradime',
      Producer: 'Auradime',
    },
  });
  const fonts = registerFonts(doc);
  const buffers = [];

  doc.on('data', (chunk) => buffers.push(chunk));
  doc.on('end', () => callback(Buffer.concat(buffers)));

  const invoice = {
    number: `INV-${order._id.toString().slice(-8).toUpperCase()}`,
    date: new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
  };

  const customer = order.customer_id || {};
  const vendor = order.vendor_id || {};
  const address = order.shipping_address || {};
  const paymentStatus = clean(order.payment_status, 'pending').toUpperCase();
  const orderStatus = clean(order.order_status, 'placed').replace(/_/g, ' ').toUpperCase();

  doc.rect(0, 0, PAGE_W, PAGE_H).fill('#ffffff');
  drawHeader(doc, fonts, invoice);

  let y = 160;
  const badgeW = (CONTENT_W - 24) / 3;
  drawBadge(doc, fonts, 'Order', `#${order._id.toString().slice(-8).toUpperCase()}`, MARGIN, y, badgeW);
  drawBadge(doc, fonts, 'Payment', paymentStatus, MARGIN + badgeW + 12, y, badgeW, paymentStatus === 'PAID' ? COLORS.green : COLORS.accent);
  drawBadge(doc, fonts, 'Fulfilment', orderStatus, MARGIN + (badgeW + 12) * 2, y, badgeW);
  y += 66;

  const colW = (CONTENT_W - 16) / 2;
  const customerLines = [
    clean(customer.name, 'Customer'),
    clean(customer.email || address.email),
    clean(customer.phone || address.phone),
  ];
  const deliveryLines = [
    clean(address.full_name || customer.name, 'Recipient'),
    clean(address.street || address.address || order.delivery_description),
    clean([address.quartier, address.city, address.region].filter(Boolean).join(', ')),
    clean(address.country, 'Cameroon'),
  ];
  drawPartyBlock(doc, fonts, 'Bill to', customerLines, MARGIN, y, colW);
  drawPartyBlock(doc, fonts, 'Deliver to', deliveryLines, MARGIN + colW + 16, y, colW);
  y += 124;

  setFont(doc, fonts, 'bold', 14, COLORS.ink);
  doc.text('Order items', MARGIN, y, { width: CONTENT_W });
  setFont(doc, fonts, 'regular', 8, COLORS.muted);
  doc.text('Prices are locked from the completed checkout.', MARGIN, y + 19, { width: CONTENT_W });
  y += 42;
  y = drawTableHeader(doc, fonts, y);

  const products = Array.isArray(order.products) ? order.products : [];
  if (!products.length) {
    drawRoundedPanel(doc, MARGIN, y, CONTENT_W, 48, COLORS.faint);
    setFont(doc, fonts, 'regular', 9, COLORS.muted);
    doc.text('No line items were attached to this order.', MARGIN + 14, y + 18, { width: CONTENT_W - 28 });
    y += 62;
  }

  products.forEach((item, index) => {
    const rowH = 50;
    y = ensureSpace(doc, fonts, y, rowH + 12);
    doc.roundedRect(MARGIN, y, CONTENT_W, rowH, 10).fill(index % 2 === 0 ? '#ffffff' : COLORS.faint);
    doc.roundedRect(MARGIN, y, CONTENT_W, rowH, 10).strokeColor(COLORS.line).lineWidth(0.5).stroke();

    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const lineTotal = qty * price;
    const variant = item.variant && typeof item.variant === 'object'
      ? Object.entries(item.variant).map(([key, value]) => `${key}: ${value}`).join(', ')
      : '';

    setFont(doc, fonts, 'semibold', 9.5, COLORS.ink);
    doc.text(clean(item.name || item.product_id?.name, 'Product'), MARGIN + 14, y + 11, {
      width: 250,
      ellipsis: true,
    });
    if (variant) {
      setFont(doc, fonts, 'regular', 7.2, COLORS.muted);
      doc.text(variant, MARGIN + 14, y + 28, { width: 250, ellipsis: true });
    }

    setFont(doc, fonts, 'regular', 9, COLORS.ink);
    doc.text(String(qty), MARGIN + 302, y + 18, { width: 42, align: 'right' });
    doc.text(money(price), MARGIN + 350, y + 18, { width: 86, align: 'right' });
    setFont(doc, fonts, 'bold', 9, COLORS.ink);
    doc.text(money(lineTotal), MARGIN + 442, y + 18, { width: CONTENT_W - 456, align: 'right' });
    y += rowH + 8;
  });

  y = ensureSpace(doc, fonts, y, 150);
  drawTotals(doc, fonts, order, y + 4);

  drawRoundedPanel(doc, MARGIN, y + 4, CONTENT_W - 264, 120, COLORS.faint);
  setFont(doc, fonts, 'semibold', 8, COLORS.accent);
  doc.text('NOTES', MARGIN + 16, y + 20, { width: CONTENT_W - 296 });
  setFont(doc, fonts, 'regular', 8.2, COLORS.muted);
  doc.text(
    'This invoice confirms your Auradime marketplace transaction. If a refund, dispute, or delivery update occurs, the order page remains the source of truth.',
    MARGIN + 16,
    y + 40,
    { width: CONTENT_W - 296, lineGap: 3 }
  );

  drawFooter(doc, fonts);
  doc.end();
};

module.exports = { generateInvoice };
