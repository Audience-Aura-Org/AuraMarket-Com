const PDFDocument = require('pdfkit');

/**
 * utils/invoiceGenerator.js
 * Full-width A4 invoice — edge-to-edge brand bands, wide content grid, optional overflow pages.
 */

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;
const HEADER_H = 96;
const FOOTER_H = 52;
const ACCENT = '#e05c2a';
const INK = '#111111';
const MUTED = '#5c5c5c';
const LINE = '#e8e8e8';
const PANEL = '#f7f7f8';

const drawFullBleedHeader = (doc, { invoiceNum, orderDate, paymentStatus }) => {
  doc.save();
  doc.rect(0, 0, PAGE_W, HEADER_H - 4).fill('#0c0c0c');
  doc.rect(0, HEADER_H - 4, PAGE_W, 4).fill(ACCENT);

  doc.fillColor('#ffffff')
    .fontSize(26)
    .font('Helvetica-Bold')
    .text('Aura Dime', MARGIN, 30, { width: 280 });

  doc.fillColor(ACCENT)
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .text('COMMERCIAL INVOICE', MARGIN, 62, { width: 280 });

  doc.fillColor('#9a9a9a')
    .fontSize(7)
    .font('Helvetica')
    .text('auradime.com  ·  Yaoundé, Cameroon', MARGIN, 76, { width: 280 });

  const rightX = PAGE_W - MARGIN - 200;
  doc.fillColor('#ffffff')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(invoiceNum, rightX, 30, { width: 200, align: 'right' });
  doc.fillColor('#c4c4c4')
    .fontSize(7.5)
    .font('Helvetica')
    .text(`Issued ${orderDate}`, rightX, 46, { width: 200, align: 'right' })
    .text(`Payment: ${(paymentStatus || 'pending').toUpperCase()}`, rightX, 58, { width: 200, align: 'right' });
  doc.restore();
};

const drawContinuationHeader = (doc, invoiceNum) => {
  doc.rect(0, 0, PAGE_W, 36).fill('#0c0c0c');
  doc.rect(0, 32, PAGE_W, 4).fill(ACCENT);
  doc.fillColor('#ffffff')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`Auradime  ·  ${invoiceNum}  ·  continued`, MARGIN, 12, { width: CONTENT_W });
};

const drawFooter = (doc) => {
  const y0 = PAGE_H - FOOTER_H;
  doc.rect(0, y0, PAGE_W, FOOTER_H).fill('#0c0c0c');
  doc.fillColor('#8a8a8a')
    .fontSize(7)
    .font('Helvetica')
    .text(
      'Thank you for shopping with Auradime. This document is your official invoice — retain for your records.',
      MARGIN,
      y0 + 18,
      { width: CONTENT_W, align: 'center' }
    );
};

const drawTableColumnHeader = (doc, y) => {
  doc.rect(MARGIN, y, CONTENT_W, 26).fill(INK);
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
  doc.text('DESCRIPTION', MARGIN + 10, y + 9, { width: 280 });
  doc.text('QTY', MARGIN + 300, y + 9, { width: 44, align: 'right' });
  doc.text('UNIT', MARGIN + 352, y + 9, { width: 72, align: 'right' });
  doc.text('AMOUNT', MARGIN + 432, y + 9, { width: CONTENT_W - 442, align: 'right' });
  return y + 26;
};

const ensureSpace = (doc, y, need, invoiceMeta) => {
  const limit = PAGE_H - FOOTER_H - 24;
  if (y + need <= limit) return y;
  doc.addPage({ margin: MARGIN, size: 'A4' });
  drawContinuationHeader(doc, invoiceMeta.invoiceNum);
  return drawTableColumnHeader(doc, 44);
};

const generateInvoice = (order, callback) => {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });

  const buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    callback(Buffer.concat(buffers));
  });

  const invoiceNum = `INV-${order._id.toString().slice(-8).toUpperCase()}`;
  const orderDate = new Date(order.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const invoiceMeta = { invoiceNum };

  drawFullBleedHeader(doc, {
    invoiceNum,
    orderDate,
    paymentStatus: order.payment_status,
  });

  let y = HEADER_H + 20;

  // ── BILL / SHIP full width two-column ───────────────────────────────────
  const colW = (CONTENT_W - 16) / 2;
  doc.fillColor(MUTED).fontSize(7).font('Helvetica-Bold').text('BILL TO', MARGIN, y).text('DELIVER TO', MARGIN + colW + 16, y);
  y += 14;

  const customerName = order.customer_id?.name || 'Customer';
  const addr = order.shipping_address || {};

  doc.fillColor(INK)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(customerName, MARGIN, y, { width: colW })
    .text(addr.full_name || customerName, MARGIN + colW + 16, y, { width: colW });
  y += 14;

  doc.fillColor(MUTED).fontSize(8.5).font('Helvetica');
  doc.text(order.customer_id?.email || '—', MARGIN, y, { width: colW });
  doc.text(addr.street || addr.address || '—', MARGIN + colW + 16, y, { width: colW });
  y += 12;
  doc.text(order.customer_id?.phone || '—', MARGIN, y, { width: colW });
  const cityLine = [addr.quartier, addr.city].filter(Boolean).join(', ') || '—';
  doc.text(cityLine, MARGIN + colW + 16, y, { width: colW });
  y += 12;
  doc.text('', MARGIN, y, { width: colW });
  doc.text(addr.country || 'Cameroon', MARGIN + colW + 16, y, { width: colW });
  y += 22;

  // Order strip (full content width)
  doc.rect(MARGIN, y, CONTENT_W, 36).fill(PANEL);
  doc.strokeColor(LINE).lineWidth(0.5).rect(MARGIN, y, CONTENT_W, 36).stroke();
  const stripMid = y + 11;
  doc.fillColor(MUTED).fontSize(7).font('Helvetica-Bold').text('ORDER REF', MARGIN + 12, stripMid);
  doc.fillColor(INK).fontSize(11).font('Helvetica-Bold').text(`#${order._id.toString().slice(-8).toUpperCase()}`, MARGIN + 12, stripMid + 10);
  doc.fillColor(MUTED).fontSize(7).font('Helvetica-Bold').text('ORDER STATUS', MARGIN + 220, stripMid);
  doc.fillColor(ACCENT).fontSize(10).font('Helvetica-Bold').text(
    (order.order_status || 'placed').replace(/_/g, ' ').toUpperCase(),
    MARGIN + 220,
    stripMid + 10,
    { width: CONTENT_W - 232 }
  );
  if (order.tracking_number) {
    doc.fillColor(MUTED).fontSize(7).font('Helvetica-Bold').text('TRACKING', MARGIN + 400, stripMid);
    doc.fillColor(INK).fontSize(9).font('Helvetica').text(order.tracking_number, MARGIN + 400, stripMid + 10, { width: 150 });
  }
  y += 48;

  // ── LINE ITEMS (full width table) ───────────────────────────────────────
  const rowH = 28;
  y = drawTableColumnHeader(doc, y);

  let rowAlt = false;
  (order.products || []).forEach((item) => {
    y = ensureSpace(doc, y, rowH + 8, invoiceMeta);
    if (rowAlt) {
      doc.rect(MARGIN, y, CONTENT_W, rowH).fill('#fafafa');
    }
    const name =
      item.name ||
      (typeof item.product_id === 'object' && item.product_id?.name) ||
      'Product';
    const qty = item.quantity || 1;
    const price = Number(item.price || 0);
    const total = price * qty;

    doc.fillColor(INK)
      .font('Helvetica')
      .fontSize(9)
      .text(name, MARGIN + 10, y + 9, { width: 275, ellipsis: true })
      .text(String(qty), MARGIN + 300, y + 9, { width: 44, align: 'right' })
      .text(`${price.toLocaleString()}`, MARGIN + 352, y + 9, { width: 72, align: 'right' })
      .font('Helvetica-Bold')
      .fillColor(INK)
      .text(`${total.toLocaleString()} XAF`, MARGIN + 432, y + 9, { width: CONTENT_W - 442, align: 'right' });
    y += rowH;
    rowAlt = !rowAlt;
  });

  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).strokeColor(LINE).lineWidth(0.5).stroke();
  y += 14;

  // ── TOTALS (right block, full-width row alignment) ─────────────────────
  y = ensureSpace(doc, y, 120, invoiceMeta);
  const totalsW = 220;
  const totalsX = MARGIN + CONTENT_W - totalsW;

  const subtotal = Number(order.subtotal || 0);
  const shipping = Number(order.shipping_fee || 0);
  const total = Number(order.total_amount || 0);

  const line = (label, val, opt = {}) => {
    doc.fillColor(MUTED).fontSize(8).font('Helvetica').text(label, totalsX, y, { width: 90, align: 'left' });
    doc.fillColor(opt.bold ? ACCENT : INK)
      .font(opt.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(opt.bold ? 11 : 8.5)
      .text(`${val.toLocaleString()} XAF`, totalsX + 95, opt.bold ? y - 1 : y, { width: totalsW - 100, align: 'right' });
    y += opt.bold ? 22 : 16;
  };

  line('Subtotal', subtotal);
  line('Shipping', shipping);
  doc.moveTo(totalsX, y).lineTo(MARGIN + CONTENT_W, y).strokeColor(LINE).lineWidth(0.5).stroke();
  y += 8;
  line('TOTAL', total, { bold: true });

  y += 6;
  doc.fillColor(MUTED)
    .fontSize(7.5)
    .font('Helvetica')
    .text(
      `Payment method: ${(order.payment_method || '—').replace(/_/g, ' ')}`,
      totalsX,
      y,
      { width: totalsW, align: 'right' }
    );

  // Notes (left side, full remaining width above footer)
  y += 28;
  y = Math.min(y, PAGE_H - FOOTER_H - 72);
  doc.fillColor(MUTED).fontSize(7).font('Helvetica-Bold').text('NOTES', MARGIN, y);
  y += 10;
  doc.fillColor(MUTED)
    .font('Helvetica')
    .fontSize(8)
    .text(
      'Prices in XAF. For support, contact info@audienceaura.org with your order reference.',
      MARGIN,
      y,
      { width: totalsX - MARGIN - 24, lineGap: 2 }
    );

  drawFooter(doc);

  doc.end();
};

module.exports = { generateInvoice };
