const PDFDocument = require('pdfkit');

/**
 * utils/invoiceGenerator.js
 * Generates a PDF invoice for an order — focused on product order and details.
 */

const generateInvoice = (order, callback) => {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  let buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    callback(Buffer.concat(buffers));
  });

  const ACCENT = '#e05c2a';
  const DARK   = '#111111';
  const GREY   = '#666666';
  const LIGHT  = '#f5f5f5';
  const W      = 495; // usable width (595 - 2*50)

  // ── HEADER ────────────────────────────────────────────────────────────────
  doc.rect(0, 0, 595, 90).fill(DARK);
  doc.fillColor('#ffffff')
     .fontSize(22).font('Helvetica-Bold')
     .text('AuraMarket', 50, 28);
  doc.fillColor(ACCENT)
     .fontSize(8).font('Helvetica')
     .text('OFFICIAL TAX INVOICE', 50, 56);
  doc.fillColor('#aaaaaa')
     .fontSize(7)
     .text('auramarket.com  ·  Yaoundé, Cameroon', 50, 70);

  // Invoice meta (top-right)
  const invoiceNum = `INV-${order._id.toString().slice(-8).toUpperCase()}`;
  const orderDate  = new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
     .text(invoiceNum, 400, 28, { width: 145, align: 'right' });
  doc.fillColor('#aaaaaa').fontSize(7).font('Helvetica')
     .text(`Date: ${orderDate}`, 400, 44, { width: 145, align: 'right' })
     .text(`Status: ${(order.payment_status || 'pending').toUpperCase()}`, 400, 56, { width: 145, align: 'right' });

  // ── BILL TO / SHIP TO ─────────────────────────────────────────────────────
  let y = 112;
  doc.fillColor(GREY).fontSize(7).font('Helvetica-Bold')
     .text('BILL TO', 50, y)
     .text('SHIP TO', 300, y);

  y += 14;
  const customerName = order.customer_id?.name || 'Customer';
  const addr = order.shipping_address || {};

  doc.fillColor(DARK).fontSize(9).font('Helvetica-Bold')
     .text(customerName, 50, y)
     .text(addr.full_name || customerName, 300, y);

  doc.fillColor(GREY).fontSize(8).font('Helvetica');
  y += 13;
  doc.text(order.customer_id?.email || '', 50, y)
     .text(addr.street || addr.address || '', 300, y);
  y += 11;
  doc.text(order.customer_id?.phone || '', 50, y)
     .text(`${addr.quartier || ''}${addr.city ? ', ' + addr.city : ''}`, 300, y);
  y += 11;
  doc.text('', 50, y)
     .text(addr.country || 'Cameroon', 300, y);

  // ── DIVIDER ───────────────────────────────────────────────────────────────
  y += 20;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e0e0e0').lineWidth(1).stroke();

  // ── PRODUCTS TABLE HEADER ─────────────────────────────────────────────────
  y += 12;
  doc.rect(50, y, W, 22).fill(DARK);
  doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
     .text('PRODUCT', 58, y + 7)
     .text('QTY', 340, y + 7, { width: 40, align: 'right' })
     .text('UNIT PRICE', 388, y + 7, { width: 65, align: 'right' })
     .text('SUBTOTAL', 460, y + 7, { width: 78, align: 'right' });

  // ── PRODUCTS TABLE ROWS ───────────────────────────────────────────────────
  y += 22;
  doc.font('Helvetica').fontSize(8.5);
  let rowAlt = false;
  (order.products || []).forEach((item) => {
    const rowH = 26;
    if (rowAlt) {
      doc.rect(50, y, W, rowH).fill(LIGHT);
    }
    const name  = item.name || 'Product';
    const qty   = item.quantity || 1;
    const price = Number(item.price || 0);
    const total = price * qty;

    doc.fillColor(DARK)
       .text(name, 58, y + 8, { width: 270, ellipsis: true })
       .text(String(qty), 340, y + 8, { width: 40, align: 'right' })
       .text(`${price.toLocaleString()} XAF`, 388, y + 8, { width: 65, align: 'right' })
       .text(`${total.toLocaleString()} XAF`, 460, y + 8, { width: 78, align: 'right' });

    y += rowH;
    rowAlt = !rowAlt;
  });

  // ── TOTALS ────────────────────────────────────────────────────────────────
  y += 10;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
  y += 12;

  const subtotal = Number(order.subtotal  || 0);
  const shipping = Number(order.shipping_fee || 0);
  const total    = Number(order.total_amount || 0);

  const drawTotalRow = (label, value, bold = false, color = DARK) => {
    doc.fillColor(GREY).fontSize(8).font('Helvetica')
       .text(label, 350, y, { width: 100, align: 'right' });
    doc.fillColor(color).fontSize(bold ? 10 : 8).font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(`${value.toLocaleString()} XAF`, 458, bold ? y - 1 : y, { width: 80, align: 'right' });
    y += bold ? 22 : 17;
  };

  drawTotalRow('Subtotal', subtotal);
  drawTotalRow('Shipping Fee', shipping);
  doc.moveTo(350, y - 4).lineTo(545, y - 4).strokeColor('#cccccc').lineWidth(0.5).stroke();
  y += 4;
  drawTotalRow('TOTAL DUE', total, true, ACCENT);

  // ── PAYMENT METHOD ────────────────────────────────────────────────────────
  y += 4;
  doc.fillColor(GREY).fontSize(7.5).font('Helvetica')
     .text(`Payment Method: ${(order.payment_method || '').replace(/_/g, ' ').toUpperCase()}`, 350, y, { width: 190, align: 'right' });

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const pageH = doc.page.height;
  doc.rect(0, pageH - 50, 595, 50).fill(DARK);
  doc.fillColor('#aaaaaa').fontSize(7.5).font('Helvetica')
     .text('Thank you for shopping with AuraMarket. This is your official invoice — please retain for your records.', 50, pageH - 32, { width: 495, align: 'center' });

  doc.end();
};

module.exports = { generateInvoice };
